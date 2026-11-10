"""Regression checks for recovered artwork, prototypes and additive Git imports."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml

from jaeger_avatar.packs import PackError, load_pack, validate_catalog
from scripts.import_avatar_experiments import git_blob, import_experiments
from scripts.import_avatar_packs import new_pack

ROOT = Path(__file__).resolve().parents[1]


class RecoveredLibraryTests(unittest.TestCase):
    def test_sculpted_avatar_has_artwork_and_six_clips_and_a_marked_draft_persona(self):
        folder = ROOT / "avatar-packs/jaeger_sculpted"
        pack = load_pack(folder, verify_sources=True)
        # Personas for the design studies were written in Jaeger Avatar and say so.
        self.assertEqual(list(pack["profiles"]), ["jaeger_avatar"])
        self.assertEqual(pack["default_representation"], "activity_clips")
        presentation = pack["representations"]["activity_clips"]["presentation"]
        self.assertEqual(set(presentation["expressions"]), {
            "idle", "working", "making_something", "waiting", "connecting", "milestone_level_up",
        })
        self.assertFalse(presentation["expressions"]["milestone_level_up"]["loop"])
        for name in ("atlas", "nova", "relay", "jaeger_bronze"):
            profiles = load_pack(ROOT / "avatar-packs" / name)["profiles"]
            self.assertIn("draft", profiles["jaeger_avatar"]["character"]["author"])
        # Mochi's unrelated Jaeger identity must not be replaced by the new art.
        self.assertEqual(load_pack(ROOT / "avatar-packs/jaeger")["default_representation"], "mochi")

    def test_archived_prototypes_are_not_registered_as_working_representations(self):
        packs = validate_catalog(ROOT / "avatar-packs")
        self.assertEqual(len(packs), 56)
        self.assertEqual(sum(len(p["profiles"]) for p in packs), 62)
        self.assertEqual(sum(len(p["representations"]) for p in packs), 106)  # +1: Bender's locked screen look, +1: Truth's card
        archived = 0
        for pack in packs:
            for key, source in pack["sources"].items():
                if source.get("status") == "archived_prototype":
                    archived += 1
                    self.assertTrue(source["files"])
                    self.assertTrue(source["notes"])
                    self.assertNotIn(key, {r.get("source") for r in pack["representations"].values()})
        self.assertEqual(archived, 5)
        assistant = load_pack(ROOT / "avatar-packs/assistant")
        self.assertEqual(assistant["default_profile"], "jaeger_agent")
        self.assertEqual(assistant["default_representation"], "jaeger_ai")

    def test_discovery_records_existing_cards_by_content_not_name(self):
        report = json.loads((ROOT / "dev/imports/jaeger-ai-discovery.json").read_text())
        duplicates = [c for c in report["candidates"] if c["disposition"] == "already_imported"]
        self.assertEqual(len(duplicates), 20)
        for candidate in duplicates:
            for relative in candidate["existing_files"]:
                content = (ROOT / "avatar-packs" / relative).read_bytes()
                digest = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
                self.assertEqual(digest, candidate["sha"])
        self.assertEqual(report["external_model"]["status"], "unavailable")


class AdditiveImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        subprocess.run(["git", "init", "-q", str(self.repo)], check=True)
        (self.repo / "portrait.png").write_bytes(b"source image bytes")
        (self.repo / "prototype.py").write_text("raise RuntimeError('never execute imported code')\n")
        (self.repo / "alias.png").symlink_to("portrait.png")
        subprocess.run(["git", "-C", str(self.repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(self.repo), "-c", "user.name=Test", "-c",
                        "user.email=test@example.invalid", "commit", "-qm", "seed"], check=True)
        self.commit = subprocess.check_output(["git", "-C", str(self.repo), "rev-parse", "HEAD"], text=True).strip()
        self.base = self.root / "base"
        (self.base / "assistant").mkdir(parents=True)
        assistant = new_pack("assistant", "Assistant")
        assistant.update(profiles={"plain": {"character": {"neutral": True}}}, default_profile="plain")
        (self.base / "assistant/avatar.yaml").write_text(yaml.safe_dump(assistant))
        self.original = (self.base / "assistant/avatar.yaml").read_bytes()
        self.plan = {
            "schema": "avatar-experiment-import/v1", "repository": "https://example.invalid/repo",
            "packs": [
                {"avatar": "face", "name": "Face", "description": "Source portrait",
                 "sources": {"ui": {"commit": self.commit, "files": ["portrait.png"]}},
                 "default_representation": "portrait", "representations": {
                     "portrait": {"source": "ui", "format": "character/v1", "root": "sources/ui",
                                  "presentation": {"render": {"asset": "portrait.png"}}}}},
                {"avatar": "assistant", "extend_existing": True, "version": "0.2.0",
                 "sources": {"experiment": {"commit": self.commit, "status": "archived_prototype",
                                            "files": ["prototype.py"]}}, "representations": {}},
            ],
        }

    def test_repeatable_import_preserves_base_and_refuses_overwrite(self):
        first = import_experiments(self.repo, self.base, self.plan, self.root / "first")
        second = import_experiments(self.repo, self.base, self.plan, self.root / "second")
        self.assertEqual(first, second)
        self.assertEqual((self.base / "assistant/avatar.yaml").read_bytes(), self.original)
        self.assertEqual((self.root / "first/face/sources/ui/portrait.png").read_bytes(), b"source image bytes")
        self.assertEqual(load_pack(self.root / "first/assistant")["profiles"],
                         load_pack(self.base / "assistant")["profiles"])
        with self.assertRaises(PackError):
            import_experiments(self.repo, self.base, self.plan, self.root / "first")

    def test_failed_import_leaves_no_partial_catalog(self):
        plan = deepcopy(self.plan)
        plan["packs"][1]["sources"]["experiment"]["files"].append("absent.txt")
        with self.assertRaises(PackError):
            import_experiments(self.repo, self.base, plan, self.root / "failed")
        self.assertFalse((self.root / "failed").exists())
        self.assertFalse(list(self.root.glob(".avatar-experiments-*")))
        self.assertEqual((self.base / "assistant/avatar.yaml").read_bytes(), self.original)

    def test_sources_require_pinned_regular_files(self):
        with self.assertRaises(PackError):
            git_blob(self.repo, "master", "portrait.png")
        with self.assertRaises(PackError):
            git_blob(self.repo, self.commit, "alias.png")
        with self.assertRaises(PackError):
            git_blob(self.repo, self.commit, "../outside.png")


if __name__ == "__main__":
    unittest.main()
