"""Read and validate avatar/v1 without importing renderers or agent engines."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re

import yaml

SCHEMA = "avatar/v1"
ID = re.compile(r"^[a-z][a-z0-9_]*$")
PROFILE_FIELDS = ("identity", "prompt", "traits", "lore", "level", "revision", "neutral")
PRESENTATION_FIELDS = (
    "kind", "assets", "default_asset", "render", "expressions", "mouth_states",
    "default_expression", "default_mouth", "motion_scripts", "moods", "animation_sets",
)


class PackError(ValueError):
    """An unsupported or incomplete portable pack."""


def read_yaml(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise PackError(f"{path}: expected a mapping")
    return data


def local_path(root: Path, relative: str, *, must_exist: bool = True) -> Path:
    """Only package-local references; no absolute paths, URLs or escaping links."""
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise PackError(f"Invalid relative path: {relative!r}")
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or ":" in relative:
        raise PackError(f"Non-local path: {relative!r}")
    resolved = (root / relative).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise PackError(f"Path escapes pack: {relative!r}")
    if must_exist and not resolved.exists():
        raise PackError(f"Missing asset: {root / relative}")
    return resolved


def check_data(value: object) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise PackError("Pack numbers must be finite")
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise PackError("Mapping keys must be strings")
            check_data(item)
    elif isinstance(value, list):
        for item in value:
            check_data(item)
    elif value is not None and not isinstance(value, (str, int, float, bool)):
        raise PackError(f"Unsupported data type: {type(value).__name__}")


def presentation_references(presentation: dict):
    """Known character/v1 asset fields, preserved inside a representation."""
    for key in ("assets", "render", "expressions", "motion_scripts", "animation_sets"):
        if not isinstance(presentation.get(key, {}), dict):
            raise PackError(f"presentation.{key} must be a mapping")
    for asset in presentation.get("assets", {}).values():
        if isinstance(asset, str):
            yield asset
        elif isinstance(asset, dict):
            for key in ("file", "root", "properties"):
                if asset.get(key):
                    yield asset[key]
    if presentation.get("render", {}).get("asset"):
        yield presentation["render"]["asset"]
    for expression in presentation.get("expressions", {}).values():
        if isinstance(expression, dict):
            for key in ("clips", "src", "asset"):
                value = expression.get(key)
                if isinstance(value, str):
                    yield value
                elif isinstance(value, list):
                    yield from value
    for value in presentation.get("motion_scripts", {}).values():
        if isinstance(value, str):
            yield value
    for animation in presentation.get("animation_sets", {}).values():
        if not isinstance(animation, dict):
            raise PackError("animation_sets entries must be mappings")
        if animation.get("asset"):
            yield animation["asset"]
        yield from animation.get("transitions", {}).values()


def load_pack(folder: Path, *, verify_sources: bool = False) -> dict:
    folder = Path(folder)
    data = read_yaml(folder / "avatar.yaml")
    check_data(data)
    if data.get("schema") != SCHEMA:
        raise PackError(f"Expected {SCHEMA}, got {data.get('schema')!r}")
    if not isinstance(data.get("avatar"), str) or not ID.fullmatch(data["avatar"]):
        raise PackError("avatar must be a lowercase identifier")
    for key in ("name", "version"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise PackError(f"Missing {key}")
    allowed = {"schema", "avatar", "name", "version", "description", "profiles",
               "representations", "default_profile", "default_representation", "sources"}
    if set(data) - allowed:
        raise PackError(f"Unknown top-level fields: {sorted(set(data) - allowed)}")
    sources = data.get("sources", {})
    if not isinstance(sources, dict):
        raise PackError("sources must be a mapping")
    for collection, default in (("profiles", "default_profile"),
                                ("representations", "default_representation")):
        variants = data.get(collection, {})
        if not isinstance(variants, dict):
            raise PackError(f"{collection} must be a mapping")
        if variants and data.get(default) not in variants:
            raise PackError(f"{default} must select an existing variant")
        if not variants and data.get(default) is not None:
            raise PackError(f"{default} must be null when {collection} is empty")
        for key, variant in variants.items():
            if not ID.fullmatch(key) or not isinstance(variant, dict):
                raise PackError(f"Invalid {collection} variant: {key}")
            if variant.get("source") is not None and variant["source"] not in sources:
                raise PackError(f"Unknown source in {collection}.{key}")
    if not data.get("profiles") and not data.get("representations"):
        raise PackError("A pack needs a profile or representation")
    for profile in data.get("profiles", {}).values():
        if not isinstance(profile.get("character"), dict):
            raise PackError("A profile needs character data")
        permitted = {"name", "description", "author", "license", *PROFILE_FIELDS}
        if set(profile["character"]) - permitted:
            raise PackError("Unsupported profile data; runtime state does not belong in a pack")
        for field in ("identity", "prompt", "traits", "lore"):
            if not isinstance(profile["character"].get(field, {}), dict):
                raise PackError(f"character.{field} must be a mapping")
        if profile.get("card"):
            local_path(folder, profile["card"])
    for representation in data.get("representations", {}).values():
        root = local_path(folder, representation.get("root"))
        presentation = representation.get("presentation")
        if not root.is_dir() or not isinstance(presentation, dict):
            raise PackError("A representation needs a directory root and presentation mapping")
        if representation.get("format") != "character/v1":
            raise PackError("Only imported character/v1 presentation data is supported yet")
        for relative in presentation_references(presentation):
            local_path(root, relative)
        for alias, relative in representation.get("path_aliases", {}).items():
            local_path(folder, alias, must_exist=False)
            local_path(folder, relative)
    if verify_sources:
        for source in sources.values():
            if not isinstance(source, dict) or not isinstance(source.get("files", {}), dict):
                raise PackError("A source needs a files mapping")
            for relative, expected in source.get("files", {}).items():
                path = local_path(folder, relative)
                actual = hashlib.sha256(path.read_bytes()).hexdigest()
                if actual != expected:
                    raise PackError(f"Source snapshot changed: {path}")
    return data


def resolve_reference(folder: Path, representation: str, reference: str) -> Path:
    """Resolve local assets and explicit historical MScript path prefixes."""
    data = load_pack(folder)
    variant = data["representations"][representation]
    # Validate before alias matching; an alias never permits escaping the pack.
    local_path(folder, reference, must_exist=False)
    for prefix, target in sorted(variant.get("path_aliases", {}).items(),
                                 key=lambda item: -len(item[0])):
        if reference == prefix or reference.startswith(prefix + "/"):
            suffix = reference[len(prefix):].lstrip("/")
            return local_path(local_path(folder, target), suffix or ".")
    return local_path(local_path(folder, variant["root"]), reference)


def validate_catalog(root: Path, *, verify_sources: bool = True) -> list[dict]:
    packs = [load_pack(p.parent, verify_sources=verify_sources)
             for p in sorted(Path(root).glob("*/avatar.yaml"))]
    if not packs:
        raise PackError(f"No avatar packs found at {root}")
    ids = [pack["avatar"] for pack in packs]
    if len(ids) != len(set(ids)):
        raise PackError("Duplicate avatar identifiers")
    return packs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "list"))
    parser.add_argument("root", type=Path, nargs="?", default=Path("avatar-packs"))
    args = parser.parse_args()
    try:
        packs = validate_catalog(args.root)
    except (PackError, OSError, yaml.YAMLError) as exc:
        parser.exit(1, f"{exc}\n")
    if args.command == "list":
        print(json.dumps([{key: p[key] for key in
                           ("avatar", "name", "default_profile", "default_representation")}
                          for p in packs], indent=2))
    else:
        print(f"Validated {len(packs)} avatar packs, "
              f"{sum(len(p['profiles']) for p in packs)} persona profiles and "
              f"{sum(len(p['representations']) for p in packs)} representations.")


if __name__ == "__main__":
    main()
