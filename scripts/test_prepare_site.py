import json
import tempfile
import unittest
from pathlib import Path

from prepare_site import prepare


class SeriesTests(unittest.TestCase):
    def test_same_data_skips_publication_but_score_correction_changes_version(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            def build(timestamp, score):
                years = [{"year": 2025}, {"year": 2024}]
                manifest = {"checkedAt": timestamp, "exams": {"pro": {"years": years}}, "categories": {}}
                path = root / "annual.json"
                path.write_text(json.dumps(manifest))
                for y in years:
                    (root / f"comparar-pro-{y['year']}.json").write_text(json.dumps([
                        {"ies": "Mi IES", "scores": {"global": [score, 9]}}, {"ies": "", "kind": "country"}]))
                prepare(root)
                return json.loads(path.read_text())

            one, two, corrected = build("A", 101), build("B", 101), build("C", 102)
            self.assertEqual(one["dataVersion"], two["dataVersion"])
            self.assertNotEqual(one["dataVersion"], corrected["dataVersion"])
            rows = json.loads((root / corrected["exams"]["pro"]["series"]["Mi IES"]).read_text())
            self.assertEqual([(r["ies"], r["year"]) for r in rows], [("Mi IES", 2024), ("Mi IES", 2025)])
