"""Importa cinco años de agregados nacionales del ICFES por examen.

Uso: python scripts/import_annual.py _site/annual.json
Instalación: python -m pip install -r scripts/requirements.txt

metrics.global y cada entrada de metrics.modules contienen meanScore y evaluated
de una sola fila nacional de puntaje; no se suman módulos, sedes ni regiones.
Los cinco módulos genéricos son obligatorios. Se incluyen también los específicos
que tengan fila nacional. Un global ausente se representa con null. Si hay
varias filas nacionales para un indicador, no se infiere una cifra única.
"""

import argparse
import json
import math
import os
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryFile
from urllib.parse import parse_qs, urldefrag, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

ROOT = "https://www.icfes.gov.co/evaluaciones-icfes/"
SOURCES = {
    "pro": ROOT + "acerca-del-examen-saber-pro/resultados-del-examen-saber-pro/",
    "tyt": ROOT + "examen-saber-tyt/resultados-examen-saber-tyt/",
}
FIELDS = {
    "examen", "agregacion", "medida agregacion", "cantidadevaluados",
    "nombre prueba", "promedio global", "promedio prueba",
}
GENERIC = {
    "lectura critica", "comunicacion escrita", "competencias ciudadanas",
    "razonamiento cuantitativo", "ingles",
}


@lru_cache(maxsize=2048)
def norm(value):
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", text))


def official(url):
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in {"www.icfes.gov.co", "icfes.gov.co"}:
        raise ValueError(f"URL no oficial HTTPS: {url}")
    return url


def discover(html, source, exam):
    exam_pattern = "pro" if exam == "pro" else r"(?:tyt|t y t|t t)"
    label = re.compile(rf"resultados agregados de saber {exam_pattern} (?:de )?(20\d\d)\b")
    by_year = defaultdict(set)
    for a in BeautifulSoup(html, "html.parser").select("a[href]"):
        match = label.search(norm(a.get_text(" ", strip=True)))
        if not match:
            continue
        url = urldefrag(urljoin(source, a["href"])).url
        if urlsplit(url).path.rstrip("/").endswith("/registro-descarga"):
            official(url)
            files = parse_qs(urlsplit(url).query).get("archivo", [])
            if len(files) != 1:
                raise ValueError(f"descarga ambigua: {url}")
            url = urljoin(source, files[0])
        by_year[int(match[1])].add(url)

    latest = max(by_year, default=0)
    if latest < 2025 or latest > datetime.now(timezone.utc).year:
        raise ValueError(f"último año inesperado: {latest}; años encontrados: {sorted(by_year)}")
    result = []
    for year in range(latest, latest - 5, -1):
        urls = by_year[year]
        if len(urls) != 1:
            raise ValueError(f"{year}: se esperaba un solo enlace anual, encontrados: {sorted(urls)}")
        url = official(next(iter(urls)))
        if not urlsplit(url).path.lower().endswith(".xlsx"):
            raise ValueError(f"{year}: no es un XLSX: {url}")
        result.append((year, url))
    return result


def check_exam(value, exam, year):
    text = norm(value)
    names = {"pro": r"\bpro\b",
             "tyt": r"\b(tyt|t y t|t t|tecnicos? y (tecnologos?|tecnologicos?))\b"}
    if not re.search(names[exam], text) or re.findall(r"\b20\d\d\b", text) != [str(year)]:
        raise ValueError(f"EXAMEN no corresponde a {exam} {year}: {value!r}")


def metric(score, count, exam):
    try:
        score, count = float(score), float(count)
    except (TypeError, ValueError) as error:
        raise ValueError(f"puntaje o volumen no numérico: {score!r}, {count!r}") from error
    if not 0 <= score <= {"pro": 300, "tyt": 200}[exam]:
        raise ValueError(f"puntaje fuera de escala: {score}")
    if not math.isfinite(count) or not count.is_integer() or count < 1:
        raise ValueError(f"cantidad inválida: {count}")
    return {"meanScore": score, "evaluated": int(count)}


def parse_book(file, exam, year):
    book = load_workbook(file, read_only=True, data_only=True)
    modules = {}
    overall = None
    schemas, levels, measures, exams = [], set(), set(), set()
    try:
        for sheet in book:
            sheet.reset_dimensions()
            rows = sheet.values
            headers = [norm(v) for v in next(rows, ())]
            schemas.append((sheet.title, headers[:8]))
            if not FIELDS.issubset(headers):
                if FIELDS.intersection(headers):
                    raise ValueError(f"{sheet.title}: faltan columnas {sorted(FIELDS.difference(headers))}")
                continue
            if any(headers.count(f) != 1 for f in FIELDS):
                raise ValueError(f"{sheet.title}: encabezado duplicado")
            idx = {f: headers.index(f) for f in FIELDS}
            for n, row in enumerate(rows, 2):
                if not row or not any(row):
                    continue
                try:
                    exam_name = row[idx["examen"]]
                    if exam_name not in exams:
                        check_exam(exam_name, exam, year)
                        exams.add(exam_name)
                    level = norm(row[idx["agregacion"]])
                    levels.add(level)
                    if level not in {"pais", "nacional"}:
                        continue
                    measure = norm(row[idx["medida agregacion"]])
                    measures.add(measure)
                    if measure not in {"puntaje global", "puntaje prueba"}:
                        continue
                    count = row[idx["cantidadevaluados"]]
                    if measure == "puntaje global":
                        value = metric(row[idx["promedio global"]], count, exam)
                        overall = national_result(overall, value)
                    else:
                        name = row[idx["nombre prueba"]]
                        key = norm(name)
                        if not key:
                            raise ValueError("módulo nacional sin nombre")
                        value = metric(row[idx["promedio prueba"]], count, exam)
                        modules[key] = {"name": str(name).strip(),
                                        **national_result(modules.get(key), value)}
                except (IndexError, ValueError) as error:
                    raise ValueError(f"{sheet.title}, fila {n}: {error}") from error
    finally:
        book.close()
    missing = GENERIC.difference(modules)
    if missing:
        raise ValueError(f"faltan módulos nacionales: {sorted(missing)}; hojas: {schemas}; "
                         f"agregaciones: {sorted(levels)}; medidas nacionales: {sorted(measures)}")
    return {"global": overall, "modules": [modules[k] for k in sorted(modules)]}


def national_result(previous, value):
    if previous is None:
        return value
    return {"meanScore": None, "evaluated": None, "nationalRows": previous.get("nationalRows", 1) + 1}


def build(session, scratch):
    exams = {}
    for exam, source in SOURCES.items():
        with session.get(source, timeout=(15, 90)) as page:
            page.raise_for_status()
            links = discover(page.content, official(page.url), exam)
        years = []
        for year, url in links:
            print(f"{exam} {year}: {url}", file=sys.stderr, flush=True)
            try:
                with TemporaryFile(dir=scratch) as file:
                    with session.get(url, stream=True, timeout=(15, 120)) as response:
                        response.raise_for_status()
                        official(response.url)
                        for chunk in response.iter_content(1024 * 1024):
                            file.write(chunk)
                    file.seek(0)
                    metrics = parse_book(file, exam, year)
            except Exception as error:
                raise RuntimeError(f"{exam} {year} ({url}): {error}") from error
            years.append({"year": year, "url": url, "metrics": metrics})
        exams[exam] = {"source": source, "years": years}
    return {"checkedAt": datetime.now(timezone.utc).isoformat(), "exams": exams}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    output = parser.parse_args().output
    output.parent.mkdir(parents=True, exist_ok=True)
    with requests.Session() as session:
        data = build(session, output.parent)
    with NamedTemporaryFile(dir=output.parent, mode="w", encoding="utf-8", delete=False) as tmp:
        try:
            json.dump(data, tmp, ensure_ascii=False, allow_nan=False, indent=2)
            tmp.write("\n")
            tmp.close()
            os.replace(tmp.name, output)
        finally:
            Path(tmp.name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
