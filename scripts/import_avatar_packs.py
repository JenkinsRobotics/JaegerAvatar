#!/usr/bin/env python3
"""Snapshot the three existing libraries into a new avatar/v1 catalog.

Sources are read-only. Output must not exist: imports never overwrite authored
avatars. Re-import into a separate directory and review differences explicitly.
"""

from __future__ import annotations

import argparse
import ast
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml

from jaeger_avatar.packs import (
    ID, PROFILE_FIELDS, PRESENTATION_FIELDS, PackError, read_yaml, validate_catalog,
)

REPOSITORIES = {
    "mochi": "https://github.com/JenkinsRobotics/Mochi",
    "jaeger_ai": "https://github.com/JenkinsRobotics/JaegerAI",
    "jaeger_agent": "https://github.com/JenkinsRobotics/jaeger-agent",
}
IGNORED = {"__pycache__", ".DS_Store", ".git", ".pytest_cache"}


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot_files(folder: Path) -> dict[str, str]:
    result = {}
    for path in sorted(folder.rglob("*")):
        rel = path.relative_to(folder)
        if any(part in IGNORED or part.startswith("._") for part in rel.parts):
            continue
        if path.is_symlink():
            raise PackError(f"Source contains a symlink: {path}")
        if path.is_file() and path.suffix not in (".pyc", ".pyo"):
            result[rel.as_posix()] = file_hash(path)
    return result


def persona(folder: Path, manifest: dict) -> dict:
    """Match JaegerAI's file-over-YAML SOUL/backstory/lore precedence."""
    keys = ("name", "description", "author", "license", *PROFILE_FIELDS)
    profile = {key: deepcopy(manifest[key]) for key in keys if key in manifest}
    prompt = profile.setdefault("prompt", {})
    for filename in ("SOUL.md", "soul.md"):
        path = folder / filename
        if path.is_file() and path.read_text(encoding="utf-8").strip():
            prompt["soul"] = path.read_text(encoding="utf-8").strip()
            break
    path = folder / "lore/backstory.md"
    if path.is_file() and path.read_text(encoding="utf-8").strip():
        prompt["backstory"] = path.read_text(encoding="utf-8").strip()
    for field in ("quotes", "mannerisms", "ideals", "behaviors"):
        path = folder / "lore" / f"{field}.md"
        if path.is_file():
            lines = [line.strip().lstrip("-").strip()
                     for line in path.read_text(encoding="utf-8").strip().splitlines()]
            lines = [line for line in lines if line]
            if lines:
                profile.setdefault("lore", {})[field] = lines
    return profile


def agent_default(path: Path) -> dict:
    """Extract only literal data, without importing or copying the agent engine."""
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.AnnAssign) and getattr(node.target, "id", "") == "DEFAULT_PERSONA":
            value = ast.literal_eval(node.value)
            if isinstance(value, dict) and all(isinstance(x, str) for x in value.values()):
                return value
    raise PackError(f"No literal DEFAULT_PERSONA in {path}")


def new_pack(identifier: str, name: str) -> dict:
    if not ID.fullmatch(identifier):
        raise PackError(f"Invalid source identifier: {identifier}")
    return {"schema": "avatar/v1", "avatar": identifier, "name": name,
            "version": "0.1.0", "description": "", "default_profile": None,
            "default_representation": None, "profiles": {}, "representations": {},
            "sources": {}}


def provenance(repo: Path, path: Path, source: str, destination: Path) -> dict:
    relative = path.relative_to(repo).as_posix()
    license_path = repo / "LICENSE"
    if license_path.is_file():
        shutil.copyfile(license_path, destination / "REPOSITORY_LICENSE")
    return {"repository": REPOSITORIES[source], "commit": git(repo, "rev-parse", "HEAD"),
            "path": relative,
            "working_tree_modified": bool(git(repo, "status", "--porcelain", "--", relative)),
            "repository_license": f"sources/{source}/REPOSITORY_LICENSE"
            if license_path.is_file() else None}


def import_catalog(mochi: Path, jaeger_ai: Path, jaeger_agent: Path, output: Path) -> list[dict]:
    output = output.resolve()
    if output.exists():
        raise PackError(f"Output already exists; import to a new directory: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".avatar-import-", dir=output.parent))
    packs: dict[str, dict] = {}
    fingerprints: list[tuple[Path, dict]] = []
    try:
        for source, repo, subdir in (
            ("mochi", mochi.resolve(), "characters"),
            ("jaeger_ai", jaeger_ai.resolve(), "jaeger_ai/features/personality/characters"),
        ):
            manifests = sorted((repo / subdir).glob("*/character.yaml"))
            if not manifests:
                raise PackError(f"No character library in {repo / subdir}")
            for path in manifests:
                folder = path.parent
                before = snapshot_files(folder)
                data = read_yaml(path)
                if data.get("schema") != "character/v1":
                    raise PackError(f"Unsupported source schema: {path}")
                identifier = data["character"]
                pack = packs.setdefault(identifier, new_pack(identifier, data["name"]))
                if source in pack["sources"]:
                    raise PackError(f"Duplicate {source} character: {identifier}")
                root = stage / identifier
                dest = root / "sources" / source
                dest.mkdir(parents=True)
                for relative in before:
                    target = dest / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(folder / relative, target)
                    if file_hash(target) != before[relative]:
                        raise PackError(f"Source changed during import: {folder / relative}")
                fingerprints.append((folder, before))
                info = provenance(repo, folder, source, dest)
                info["declared_license"] = data.get("license", "Unspecified")
                info["files"] = {f"sources/{source}/{rel}": digest
                                 for rel, digest in snapshot_files(dest).items()}
                pack["sources"][source] = info
                profile = {"source": source, "character": persona(dest, data)}
                # Several Mochi packs have a card file but no explicit card field.
                card = data.get("card") or ("card.png" if (dest / "card.png").is_file() else None)
                if card:
                    profile["card"] = f"sources/{source}/{card}"
                pack["profiles"][source] = profile
                presentation = {key: deepcopy(data[key]) for key in PRESENTATION_FIELDS if key in data}
                unavailable = {}
                # Five AI personas carry an unused legacy avatar directory placeholder.
                # Retain it in the source snapshot and record its absence explicitly.
                if (source == "jaeger_ai"
                        and presentation.get("assets", {}).get("avatar") == "avatar"
                        and not (dest / "avatar").exists()
                        and presentation.get("default_asset") != "avatar"
                        and presentation.get("render", {}).get("asset") != "avatar"):
                    unavailable["avatar"] = presentation["assets"].pop("avatar")
                pack["representations"][source] = {
                    "source": source, "format": "character/v1",
                    "root": f"sources/{source}", "presentation": presentation,
                    "path_aliases": {f"characters/{folder.name}": f"sources/{source}"},
                }
                if unavailable:
                    pack["representations"][source]["unavailable_assets"] = unavailable
                # Keep both source variants; choose the richer persona and animated face.
                if source == "jaeger_ai" or pack["default_profile"] is None:
                    pack["default_profile"] = source
                    pack["name"] = data["name"]
                    pack["description"] = data.get("description", "")
                if pack["default_representation"] is None:
                    pack["default_representation"] = source

        repo = jaeger_agent.resolve()
        path = repo / "jaeger_agent/prompts/default_persona.py"
        before = file_hash(path)
        default = agent_default(path)
        pack = packs.setdefault(default["id"], new_pack(default["id"], default["name"]))
        dest = stage / default["id"] / "sources/jaeger_agent"
        dest.mkdir(parents=True)
        (dest / "default_persona.json").write_text(json.dumps(default, indent=2) + "\n", encoding="utf-8")
        info = provenance(repo, path, "jaeger_agent", dest)
        info["origin_sha256"] = before
        info["declared_license"] = "Apache-2.0"
        info["extraction"] = "Literal DEFAULT_PERSONA data only; no runtime code imported."
        info["files"] = {f"sources/jaeger_agent/{rel}": digest
                         for rel, digest in snapshot_files(dest).items()}
        pack["sources"]["jaeger_agent"] = info
        pack["profiles"]["jaeger_agent"] = {
            "source": "jaeger_agent", "character": {
                "name": default["name"], "neutral": True,
                "identity": {key: default[key] for key in ("role", "voice_tone")},
                "prompt": {"custom_instructions": default["custom_instructions"]},
            },
        }
        pack["default_profile"] = "jaeger_agent"
        for identifier, data in sorted(packs.items()):
            (stage / identifier / "avatar.yaml").write_text(
                yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
        imported = validate_catalog(stage)
        catalog = {
            "schema": "avatar-catalog/v1",
            "avatars": [{"avatar": p["avatar"], "name": p["name"],
                         "manifest": f"{p['avatar']}/avatar.yaml",
                         "sources": sorted(p["sources"])} for p in imported],
        }
        (stage / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
        for folder, expected in fingerprints:
            if snapshot_files(folder) != expected:
                raise PackError(f"Source changed during import; retry: {folder}")
        if file_hash(path) != before:
            raise PackError(f"Source changed during import; retry: {path}")
        stage.rename(output)
        return imported
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mochi", type=Path, required=True)
    parser.add_argument("--jaeger-ai", type=Path, required=True)
    parser.add_argument("--jaeger-agent", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        packs = import_catalog(args.mochi, args.jaeger_ai, args.jaeger_agent, args.output)
    except (PackError, OSError, subprocess.CalledProcessError, yaml.YAMLError) as exc:
        parser.exit(1, f"{exc}\n")
    print(f"Imported {len(packs)} avatars into {args.output}")


if __name__ == "__main__":
    main()
