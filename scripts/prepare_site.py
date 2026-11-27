"""Prepara series pequeñas por IES y la huella de los datos publicados."""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path


def compact(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def prepare(root):
    manifest_file = root / "annual.json"
    manifest = json.loads(manifest_file.read_text())
    digest = hashlib.sha256()
    digest.update(compact({k: manifest[k] for k in ("exams", "categories")}).encode())
    folder = root / "series"
    folder.mkdir(exist_ok=True)
    for exam, data in manifest["exams"].items():
        series = defaultdict(list)
        for item in sorted(data["years"], key=lambda r: r["year"]):
            year = item["year"]
            raw = (root / f"comparar-{exam}-{year}.json").read_bytes()
            digest.update(hashlib.sha256(raw).digest())
            for r in json.loads(raw):
                series[r["ies"]].append(dict(r, year=year))
        files = {}
        for i, (name, records) in enumerate(sorted(series.items())):
            path = f"series/{exam}-{i}.json"
            (root / path).write_text(compact(records))
            files[name] = path
        data["series"] = files
    manifest["dataVersion"] = digest.hexdigest()
    manifest_file.write_text(compact(manifest))
    (root / "data-version.txt").write_text(manifest["dataVersion"] + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    prepare(parser.parse_args().site)
