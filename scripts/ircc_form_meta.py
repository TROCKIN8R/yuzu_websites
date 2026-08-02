#!/usr/bin/env python3
"""Derive IRCC blank form-meta (AES file key + XFA datasets object number).

Uses pypdf empty-user decrypt to recover the AESV2 file encryption key, and
AcroForm /XFA packet refs for the datasets EmbeddedFile object number.

Usage:
  python3 scripts/ircc_form_meta.py
  python3 scripts/ircc_form_meta.py --forms imm1295e,imm5710e
  python3 scripts/ircc_form_meta.py --write
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ArrayObject, IndirectObject

ROOT = Path(__file__).resolve().parents[1]
BLANKS = ROOT / "yuzu_github_page/assets/forms/ircc/blanks"
META_PATH = ROOT / "supabase/functions/_shared/form-meta.json"


def datasets_obj(reader: PdfReader) -> int | None:
    root = reader.trailer["/Root"].get_object()
    acro = root.get("/AcroForm")
    if acro is None:
        return None
    acro = acro.get_object()
    xfa = acro.get("/XFA")
    if xfa is None:
        return None
    xfa = xfa.get_object() if hasattr(xfa, "get_object") else xfa
    if not isinstance(xfa, ArrayObject):
        return None
    for i in range(0, len(xfa), 2):
        name = xfa[i]
        if hasattr(name, "get_object"):
            name = name.get_object()
        if "datasets" not in str(name).lower():
            continue
        ref = xfa[i + 1]
        if isinstance(ref, IndirectObject):
            return int(ref.idnum)
        if hasattr(ref, "idnum"):
            return int(ref.idnum)
    return None


def meta_for(path: Path) -> dict:
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        reader.decrypt("")
    key = reader._encryption._key.hex()
    obj = datasets_obj(reader)
    if obj is None:
        raise RuntimeError(f"Could not locate datasets object in {path.name}")
    return {
        "fileKeyHex": key,
        "datasetsObj": obj,
        "datasetsGen": 0,
        "bytes": path.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--forms",
        help="Comma-separated stems (e.g. imm1295e,imm5710f). Default: all blanks.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Merge into supabase/functions/_shared/form-meta.json",
    )
    args = parser.parse_args()

    if args.forms:
        stems = [s.strip() for s in args.forms.split(",") if s.strip()]
        paths = [BLANKS / f"{stem}.pdf" for stem in stems]
    else:
        paths = sorted(BLANKS.glob("*.pdf"))

    result: dict[str, dict] = {}
    for path in paths:
        if not path.exists():
            raise SystemExit(f"Missing blank: {path}")
        result[path.stem] = meta_for(path)
        print(f"{path.stem}: key={result[path.stem]['fileKeyHex']} obj={result[path.stem]['datasetsObj']}")

    if args.write:
        META_PATH.parent.mkdir(parents=True, exist_ok=True)
        existing = {}
        if META_PATH.exists():
            existing = json.loads(META_PATH.read_text(encoding="utf-8"))
        existing.update(result)
        META_PATH.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {META_PATH.relative_to(ROOT)} ({len(existing)} entries)")
    else:
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
