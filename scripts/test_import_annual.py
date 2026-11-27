"""python -m unittest discover -s scripts -p 'test_import_annual.py'"""

import unittest
from io import BytesIO

from openpyxl import Workbook

from import_annual import SOURCES, discover, parse_book


class AnnualTests(unittest.TestCase):
    def test_discovery(self):
        def link(year):
            return (f'<a href="/{year}.xlsx">Descargue la base de datos de resultados '
                    f'agregados de Saber TYT {year}</a>')

        html = "".join(map(link, range(2020, 2026))) + link(2024)
        html += '<a href="/otro.xlsx">Mejores Saber TyT 2026</a>'
        found = discover(html, SOURCES["tyt"], "tyt")
        self.assertEqual([year for year, _ in found], [2025, 2024, 2023, 2022, 2021])
        self.assertEqual(found[0][1], "https://www.icfes.gov.co/2025.xlsx")
        for bad in (html.replace(link(2023), ""), html + link(2025).replace("/2025.", "/copia."),
                    html.replace(link(2025), "")):
            with self.assertRaises(ValueError):
                discover(bad, SOURCES["tyt"], "tyt")

    def book(self, extra=(), global_score=True):
        b = Workbook()
        s = b.active
        s.append(["EXAMEN", "AGREGACION", "MEDIDA_AGREGACION", "CANTIDADEVALUADOS",
                  "NOMBRE_PRUEBA", "PROMEDIO_GLOBAL", "PROMEDIO_PRUEBA"])
        names = ["LECTURA CRÍTICA", "COMUNICACIÓN ESCRITA", "COMPETENCIAS CIUDADANAS",
                 "RAZONAMIENTO CUANTITATIVO", "INGLÉS"]
        for i, name in enumerate(names):
            for level, measure, count, score in [
                ("DEPARTAMENTO", "PUNTAJE_PRUEBA", 15, 97),
                ("PAIS", "NIVEL_DESEMPEÑO_PRUEBA", 100, None),
                ("PAÍS", "PUNTAJE_PRUEBA", 100 - i, 109 + i),
            ]:
                s.append(["SABER TYT - 2025", level, measure, count, name, None, score])
        if global_score:
            s.append(["SABER TYT - 2025", "PAIS", "PUNTAJE_GLOBAL", 100, None, 110])
        for row in extra:
            s.append(["SABER TYT - 2025", "PAIS", *row])
        file = BytesIO()
        b.save(file)
        file.seek(0)
        return file

    def test_only_national_score(self):
        metrics = parse_book(self.book(), "tyt", 2025)
        self.assertEqual(metrics["global"], {"meanScore": 110, "evaluated": 100})
        self.assertEqual(len(metrics["modules"]), 5)
        self.assertIn({"name": "INGLÉS", "meanScore": 113, "evaluated": 96}, metrics["modules"])
        self.assertIsNone(parse_book(self.book(global_score=False), "tyt", 2025)["global"])

    def test_multiple_national_rows_do_not_become_a_total(self):
        rows = [["PUNTAJE_PRUEBA", 80, "INGLÉS", None, 101]] * 2
        rows.append(["PUNTAJE_GLOBAL", 100, None, 110])
        data = parse_book(self.book(rows), "tyt", 2025)
        self.assertEqual(data["global"], {"nationalRows": 2, "meanScore": None, "evaluated": None})
        self.assertIn({"name": "INGLÉS", "nationalRows": 3, "meanScore": None, "evaluated": None}, data["modules"])
        self.assertIn({"name": "LECTURA CRÍTICA", "meanScore": 109, "evaluated": 100}, data["modules"])

    def test_invalid_data(self):
        for row in (["PUNTAJE_PRUEBA", 8, "Módulo específico", None, 201],
                    ["PUNTAJE_PRUEBA", -1, "Módulo específico", None, 98]):
            with self.subTest(row=row), self.assertRaises(ValueError):
                parse_book(self.book([row]), "tyt", 2025)
        for exam, year in [("tyt", 2024), ("pro", 2025)]:
            with self.assertRaises(ValueError):
                parse_book(self.book(), exam, year)


if __name__ == "__main__":
    unittest.main()
