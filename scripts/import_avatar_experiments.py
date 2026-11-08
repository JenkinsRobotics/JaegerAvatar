#!/usr/bin/env python3
"""Add a reviewed set of Git-backed avatar experiments to a copy of a catalog.

Reads pinned Git objects, never checks out or executes the source application.
The base catalog stays unchanged and the output directory must not exist.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml

from jaeger_avatar.packs import ID, PackError, load_pack, local_path, validate_catalog
from scripts.import_avatar_packs import new_pack


def git_blob(repo: Path, commit: str, path: str) -> bytes:
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise PackError("Experiment sources require full pinned commit IDs")
    local_path(repo, path, must_exist=False)
    row = subprocess.check_output(
        ["git", "-C", str(repo), "ls-tree", commit, "--", path], text=True
    ).strip()
    if not row or row.split()[0] not in ("100644", "100755"):
        raise PackError(f"Missing regular source file: {commit}:{path}")
    return subprocess.check_output(["git", "-C", str(repo), "show", f"{commit}:{path}"])


def import_experiments(repo: Path, base: Path, plan: dict, output: Path) -> list[dict]:
    if plan.get("schema") != "avatar-experiment-import/v1":
        raise PackError("Unsupported experiment import plan")
    base, output = base.resolve(), output.resolve()
    if output.exists() or output.is_relative_to(base):
        raise PackError("Output must be a new directory outside the base catalog")
    validate_catalog(base)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".avatar-experiments-", dir=output.parent))
    try:
        shutil.copytree(base, stage, dirs_exist_ok=True)
        seen = set()
        for entry in plan["packs"]:
            identifier = entry["avatar"]
            if not ID.fullmatch(identifier) or identifier in seen:
                raise PackError(f"Invalid or duplicate avatar ID: {identifier}")
            seen.add(identifier)
            folder = stage / identifier
            exists = (folder / "avatar.yaml").is_file()
            if bool(entry.get("extend_existing")) != exists:
                raise PackError(f"Unexpected existing/new pack state: {identifier}")
            data = load_pack(folder) if exists else new_pack(identifier, entry["name"])
            if not exists:
                data["description"] = entry["description"]
                folder.mkdir()
            for source_id, source in entry["sources"].items():
                if not ID.fullmatch(source_id) or source_id in data["sources"]:
                    raise PackError(f"Refusing to replace source: {identifier}/{source_id}")
                root = folder / "sources" / source_id
                root.mkdir(parents=True)
                provenance = {key: deepcopy(value) for key, value in source.items() if key != "files"}
                provenance.update(repository=plan["repository"], working_tree_modified=False, files={})
                for origin in source["files"]:
                    target = local_path(root, origin, must_exist=False)
                    if target.exists():
                        raise PackError(f"Duplicate source path: {origin}")
                    blob = git_blob(repo, source["commit"], origin)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(blob)
                    relative = target.relative_to(folder).as_posix()
                    provenance["files"][relative] = hashlib.sha256(blob).hexdigest()
                if "LICENSE" in source["files"]:
                    provenance["repository_license"] = f"sources/{source_id}/LICENSE"
                data["sources"][source_id] = provenance
            for key, representation in entry.get("representations", {}).items():
                if key in data["representations"]:
                    raise PackError(f"Refusing to replace representation: {identifier}/{key}")
                data["representations"][key] = deepcopy(representation)
            if not exists:
                data["default_representation"] = entry["default_representation"]
            else:
                data["version"] = entry["version"]
            (folder / "avatar.yaml").write_text(
                yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
        packs = validate_catalog(stage)
        catalog = {
            "schema": "avatar-catalog/v1",
            "avatars": [{"avatar": p["avatar"], "name": p["name"],
                         "manifest": f"{p['avatar']}/avatar.yaml",
                         "sources": sorted(p["sources"])} for p in packs],
        }
        (stage / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
        stage.rename(output)
        return packs
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--plan", type=Path, default=Path("dev/imports/jaeger-ai-experiments.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        plan = json.loads(args.plan.read_text(encoding="utf-8"))
        packs = import_experiments(args.repo, args.base, plan, args.output)
    except (PackError, OSError, subprocess.CalledProcessError, yaml.YAMLError) as exc:
        parser.exit(1, f"{exc}\n")
    print(f"Prepared {len(packs)} avatar packs at {args.output}; base catalog unchanged.")


if __name__ == "__main__":
    main()
