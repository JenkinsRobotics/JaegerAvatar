"""Verify imported character meaning, asset integrity and migration boundaries."""

from copy import deepcopy
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

import yaml

from jaeger_avatar.packs import PackError, load_pack, resolve_reference, validate_catalog
from scripts.import_avatar_packs import import_catalog

CATALOG = Path(__file__).resolve().parents[1] / "avatar-packs"


class ImportedCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packs = validate_catalog(CATALOG)

    def test_catalog_matches_manifests_and_all_three_sources(self):
        index = json.loads((CATALOG / "catalog.json").read_text())
        self.assertEqual({p["avatar"] for p in self.packs},
                         {p["avatar"] for p in index["avatars"]})
        for row in index["avatars"]:
            self.assertEqual(load_pack((CATALOG / row["manifest"]).parent)["avatar"], row["avatar"])
        counts = {key: sum(key in p["sources"] for p in self.packs)
                  for key in ("mochi", "jaeger_ai", "jaeger_agent")}
        self.assertEqual(counts, {"mochi": 18, "jaeger_ai": 20, "jaeger_agent": 1})

    def test_shared_avatars_preserve_independent_personas_and_faces(self):
        for identifier in ("mochi", "tars", "glados", "hal_9000"):
            pack = load_pack(CATALOG / identifier)
            self.assertEqual(pack["default_profile"], "jaeger_ai")
            self.assertEqual(pack["default_representation"], "mochi")
            for source in ("mochi", "jaeger_ai"):
                original = yaml.safe_load((CATALOG / identifier / "sources" / source / "character.yaml").read_text())
                self.assertEqual(pack["profiles"][source]["character"]["identity"], original["identity"])
                self.assertEqual(pack["representations"][source]["presentation"]["expressions"], original["expressions"])

    def test_file_backed_soul_and_lore_have_original_precedence(self):
        root = CATALOG / "tars"
        profile = load_pack(root)["profiles"]["jaeger_ai"]["character"]
        source = root / "sources/jaeger_ai"
        self.assertEqual(profile["prompt"]["soul"], (source / "SOUL.md").read_text().strip())
        self.assertEqual(profile["prompt"]["backstory"], (source / "lore/backstory.md").read_text().strip())
        self.assertEqual(profile["lore"]["quotes"], [line.strip().lstrip("-").strip()
                         for line in (source / "lore/quotes.md").read_text().strip().splitlines()
                         if line.strip().lstrip("-").strip()])

    def test_agent_default_is_data_without_runtime_dependency(self):
        root = CATALOG / "assistant"
        pack = load_pack(root)
        default = json.loads((root / "sources/jaeger_agent/default_persona.json").read_text())
        self.assertEqual(pack["default_profile"], "jaeger_agent")
        self.assertEqual(pack["profiles"]["jaeger_agent"]["character"]["prompt"]["custom_instructions"],
                         default["custom_instructions"])
        self.assertNotIn("jaeger_agent", pack["representations"])
        self.assertFalse(list((root / "sources/jaeger_agent").rglob("*.py")))

    def test_project_relative_script_paths_still_resolve(self):
        checked = 0
        for pack in self.packs:
            root = CATALOG / pack["avatar"]
            for key, rep in pack["representations"].items():
                if rep["format"] != "character/v1":  # built-in rigs carry no scripts of their own
                    continue
                for script in (root / rep["root"]).rglob("*.mscript"):
                    for ref in re.findall(r'''["'](characters/[^"'\n]+)["']''', script.read_text()):
                        self.assertTrue(resolve_reference(root, key, ref).is_file())
                        checked += 1
        self.assertGreater(checked, 50)

    def test_missing_legacy_models_are_reported_without_fabricated_assets(self):
        absent = []
        for pack in self.packs:
            for rep in pack["representations"].values():
                if rep.get("unavailable_assets"):
                    absent.append(pack["avatar"])
                    self.assertEqual(rep["unavailable_assets"], {"avatar": "avatar"})
                    self.assertNotIn("avatar", rep["presentation"]["assets"])
        self.assertEqual(len(absent), 5)


class PackBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.data = {"schema": "avatar/v1", "avatar": "plain", "name": "Plain",
                     "version": "0.1.0", "profiles": {"default": {"character": {"prompt": {}}}},
                     "default_profile": "default", "representations": {},
                     "default_representation": None, "sources": {}}

    def write(self, data=None):
        (self.root / "avatar.yaml").write_text(yaml.safe_dump(data or self.data))

    def test_persona_only_and_visual_only_need_no_agent(self):
        self.write()
        load_pack(self.root)
        (self.root / "face.png").write_bytes(b"asset placeholder")
        self.data.update(profiles={}, default_profile=None,
                         representations={"face": {"format": "character/v1", "root": ".",
                                         "presentation": {"render": {"asset": "face.png"}}}},
                         default_representation="face")
        self.write()
        load_pack(self.root)

    def test_rejects_future_schema_invalid_defaults_nonfinite_and_private_state(self):
        for field, value in (("schema", "avatar/v2"), ("default_profile", "missing"),
                             ("memory", ["private conversation"])):
            data = deepcopy(self.data)
            data[field] = value
            self.write(data)
            with self.assertRaises(PackError):
                load_pack(self.root)
        self.data["profiles"]["default"]["character"]["traits"] = {"energy": float("nan")}
        self.write()
        with self.assertRaises(PackError):
            load_pack(self.root)

    def test_rejects_traversal_missing_assets_and_source_tampering(self):
        for path in ("../outside.png", "/tmp/outside.png", "https://example.com/face.png", "missing.png"):
            self.data["profiles"]["default"]["card"] = path
            self.write()
            with self.assertRaises(PackError):
                load_pack(self.root)
        self.data["profiles"]["default"].pop("card")
        (self.root / "source.txt").write_text("changed")
        self.data["sources"] = {"seed": {"files": {"source.txt": "0" * 64}}}
        self.write()
        with self.assertRaisesRegex(PackError, "Source snapshot changed"):
            load_pack(self.root, verify_sources=True)

    def test_rejects_symlink_escape(self):
        with tempfile.TemporaryDirectory() as other:
            target = Path(other) / "outside.png"
            target.write_bytes(b"outside")
            (self.root / "card.png").symlink_to(target)
            self.data["profiles"]["default"]["card"] = "card.png"
            self.write()
            with self.assertRaises(PackError):
                load_pack(self.root)


class ImportFlowTests(unittest.TestCase):
    def test_import_is_repeatable_preserves_inputs_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for repo in ("mochi", "ai", "agent"):
                path = root / repo
                path.mkdir()
                subprocess.run(["git", "init", "-q", str(path)], check=True)
                subprocess.run(["git", "-C", str(path), "-c", "user.name=Test", "-c",
                                "user.email=test@example.invalid", "commit", "--allow-empty", "-qm", "seed"], check=True)
                (path / "LICENSE").write_text("Apache-2.0")
            for repo, subdir in (("mochi", "characters/assistant"),
                                 ("ai", "jaeger_ai/features/personality/characters/assistant")):
                folder = root / repo / subdir
                folder.mkdir(parents=True)
                (folder / "card.png").write_bytes(b"test image")
                (folder / "SOUL.md").write_text("File-backed soul")
                (folder / "character.yaml").write_text(yaml.safe_dump({
                    "schema": "character/v1", "character": "assistant", "name": "Assistant",
                    "render": {"asset": "card.png"}, "prompt": {"soul": "old YAML soul"},
                    "extension_to_preserve": {"custom": "original"},
                }))
            path = root / "agent/jaeger_agent/prompts/default_persona.py"
            path.parent.mkdir(parents=True)
            path.write_text("raise RuntimeError('must not execute')\nDEFAULT_PERSONA: dict = "
                            + repr({"id": "assistant", "name": "Assistant", "role": "helps",
                                    "voice_tone": "plain", "custom_instructions": "Be helpful"}))
            original = path.read_bytes()
            first = import_catalog(root / "mochi", root / "ai", root / "agent", root / "first")
            second = import_catalog(root / "mochi", root / "ai", root / "agent", root / "second")
            self.assertEqual(first, second)
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(first[0]["profiles"]["jaeger_ai"]["character"]["prompt"]["soul"], "File-backed soul")
            snapshot = yaml.safe_load((root / "first/assistant/sources/mochi/character.yaml").read_text())
            self.assertEqual(snapshot["extension_to_preserve"], {"custom": "original"})
            with self.assertRaisesRegex(PackError, "Output already exists"):
                import_catalog(root / "mochi", root / "ai", root / "agent", root / "first")


if __name__ == "__main__":
    unittest.main()
