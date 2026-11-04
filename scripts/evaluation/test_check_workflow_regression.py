#!/usr/bin/env python3
"""Unit tests for the FR-17-10 catalogue checker.

Exercises validate_catalogue + collect_operator_probes against
synthetic catalogues in a tempdir.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_workflow_regression import (          # noqa: E402
    collect_operator_probes,
    validate_catalogue,
)


class ValidateCatalogueTest(unittest.TestCase):

    def test_clean_catalogue_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a").mkdir()
            (root / "a" / "AlphaTest.java").write_text("stub")
            catalogue = {"workflows": [{
                "id": "alpha", "label": "A", "fr": ["FR-01"],
                "tests": ["a/AlphaTest.java"], "operatorProbes": [],
            }]}
            result = validate_catalogue(catalogue, root)
            self.assertTrue(result["pass"])
            self.assertEqual(result["total"], 1)
            self.assertEqual(result["workflows"][0]["status"], "PASS")

    def test_missing_test_file_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            catalogue = {"workflows": [{
                "id": "alpha", "fr": ["FR-01"],
                "tests": ["does/not/Exist.java"], "operatorProbes": [],
            }]}
            result = validate_catalogue(catalogue, root)
            self.assertFalse(result["pass"])
            self.assertEqual(result["workflows"][0]["testsMissing"],
                              ["does/not/Exist.java"])

    def test_duplicate_id_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a").mkdir()
            (root / "a" / "T.java").write_text("x")
            catalogue = {"workflows": [
                {"id": "dup", "fr": ["FR-01"], "tests": ["a/T.java"]},
                {"id": "dup", "fr": ["FR-02"], "tests": ["a/T.java"]},
            ]}
            result = validate_catalogue(catalogue, root)
            self.assertFalse(result["pass"])
            self.assertTrue(any("duplicate id" in e["error"]
                                   for e in result["errors"]))

    def test_missing_id_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = validate_catalogue(
                {"workflows": [{"fr": ["FR-01"], "tests": []}]},
                Path(tmp))
            self.assertFalse(result["pass"])
            self.assertTrue(any("missing id" in e["error"]
                                   for e in result["errors"]))

    def test_missing_fr_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a").mkdir()
            (root / "a" / "T.java").write_text("x")
            result = validate_catalogue(
                {"workflows": [{"id": "x", "tests": ["a/T.java"]}]},
                root)
            self.assertFalse(result["pass"])
            self.assertTrue(any("missing fr" in e["error"]
                                   for e in result["errors"]))

    def test_no_tests_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = validate_catalogue(
                {"workflows": [{"id": "x", "fr": ["FR-01"], "tests": []}]},
                Path(tmp))
            self.assertFalse(result["pass"])
            self.assertTrue(any("no tests referenced" in e["error"]
                                   for e in result["errors"]))

    def test_empty_catalogue_passes_vacuously(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = validate_catalogue({"workflows": []}, Path(tmp))
            self.assertTrue(result["pass"])
            self.assertEqual(result["total"], 0)

    def test_shipped_catalogue_validates(self) -> None:
        """Catch an accidental delete of a shipped test — if the
        shipped catalogue itself stops validating, the gate fails."""
        catalogue_path = (Path(__file__).resolve().parent
                             / "supported_workflows.json")
        test_root = (Path(__file__).resolve().parent.parent.parent
                        / "server" / "src" / "test" / "java" / "ug" / "ac"
                        / "mak" / "der")
        import json as _json
        with catalogue_path.open() as fh:
            cat = _json.load(fh)
        result = validate_catalogue(cat, test_root)
        self.assertTrue(result["pass"],
                           f"shipped catalogue broken: {result['errors']}")
        self.assertGreater(result["total"], 10,
                              "catalogue dropped below expected workflow count")


class CollectOperatorProbesTest(unittest.TestCase):

    def test_order_preserving_dedupe(self) -> None:
        catalogue = {"workflows": [
            {"id": "a", "operatorProbes": ["/x", "/y"]},
            {"id": "b", "operatorProbes": ["/x", "/z"]},
            {"id": "c", "operatorProbes": []},
        ]}
        probes = collect_operator_probes(catalogue)
        self.assertEqual(probes, ["/x", "/y", "/z"])

    def test_missing_field_safe(self) -> None:
        catalogue = {"workflows": [{"id": "a"}, {"id": "b"}]}
        self.assertEqual(collect_operator_probes(catalogue), [])


if __name__ == "__main__":
    unittest.main()
