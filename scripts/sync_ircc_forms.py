#!/usr/bin/env python3
"""
Sync latest IRCC blank PDF templates (EN + FR) into the repo.

Primary discovery: scrape each form's canada.ca guide page for /content/dam/ircc/…pdf links.
Fallback: probe dated CDN folders (DD-MM-YYYY) from the catalog URL templates.

Usage:
  python3 scripts/sync_ircc_forms.py
  python3 scripts/sync_ircc_forms.py --check-only
  python3 scripts/sync_ircc_forms.py --forms imm1294,imm5646
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "yuzu_github_page/assets/forms/ircc/catalog.json"
BLANKS_DIR = ROOT / "yuzu_github_page/assets/forms/ircc/blanks"
MANIFEST_PATH = ROOT / "yuzu_github_page/assets/forms/ircc/manifest.json"

USER_AGENT = (
    "YuzuIrccFormSync/1.0 (+https://yuzu.solutions; study-permit blank template sync)"
)
PDF_LINK_RE = re.compile(
    r"""(?P<url>(?:https://www\.canada\.ca)?/content/dam/ircc/[^"'\\\s<>]+\.pdf)""",
    re.IGNORECASE,
)
DATE_FOLDER_RE = re.compile(r"/(\d{2}-\d{2}-\d{4})/")


def load_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def http_request(
    url: str,
    *,
    method: str = "GET",
    timeout: int = 60,
    retries: int = 4,
) -> tuple[int, dict[str, str], bytes]:
    ctx = ssl.create_default_context()
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url,
            method=method,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "*/*",
                "Connection": "close",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                headers = {k.lower(): v for k, v in resp.headers.items()}
                body = b"" if method == "HEAD" else resp.read()
                return int(resp.status), headers, body
        except urllib.error.HTTPError as err:
            headers = {k.lower(): v for k, v in (err.headers.items() if err.headers else [])}
            body = err.read() if method != "HEAD" else b""
            if err.code in {404, 410}:
                return err.code, headers, body
            last_err = err
        except Exception as err:  # noqa: BLE001 — network resilience
            last_err = err
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{method} {url} failed after {retries} attempts: {last_err}")


def absolute_canada_url(url: str) -> str:
    if url.startswith("http"):
        return url
    return "https://www.canada.ca" + url


def parse_date_folder(folder: str) -> date | None:
    try:
        return datetime.strptime(folder, "%d-%m-%Y").date()
    except ValueError:
        return None


def candidate_date_folders(months_back: int = 36) -> list[str]:
    """IRCC commonly uses 01-MM-YYYY folders; also try mid-month."""
    today = date.today()
    out: list[str] = []
    year, month = today.year, today.month
    for _ in range(months_back):
        out.append(f"01-{month:02d}-{year}")
        out.append(f"15-{month:02d}-{year}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    # de-dupe preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for item in out:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def discover_from_guide(guide_url: str, code: str, lang_id: str) -> str | None:
    try:
        status, _, body = http_request(guide_url, timeout=45)
    except Exception as err:  # noqa: BLE001
        print(f"  ! guide fetch failed ({guide_url}): {err}")
        return None
    if status != 200 or not body:
        print(f"  ! guide HTTP {status}: {guide_url}")
        return None

    html = body.decode("utf-8", "replace")
    matches: list[tuple[date | None, str]] = []
    needle = f"{code}{lang_id}.pdf".lower()
    for m in PDF_LINK_RE.finditer(html):
        url = absolute_canada_url(m.group("url"))
        if needle not in url.lower():
            continue
        folder_m = DATE_FOLDER_RE.search(url)
        folder_date = parse_date_folder(folder_m.group(1)) if folder_m else None
        matches.append((folder_date, url))

    if not matches:
        return None

    # Prefer newest dated folder; undated links last.
    matches.sort(key=lambda item: item[0] or date.min, reverse=True)
    return matches[0][1]


def discover_by_probing(pdf_template: str, code: str, lang_id: str) -> str | None:
    for folder in candidate_date_folders():
        url = pdf_template.format(code=code, date=folder)
        # sanity: template should already include lang suffix via {code}e.pdf pattern
        if f"{code}{lang_id}.pdf" not in url:
            # catalog templates hardcode e/f in the filename
            pass
        try:
            status, headers, _ = http_request(url, method="HEAD", timeout=20, retries=2)
        except Exception:
            continue
        if status == 200 and "pdf" in headers.get("content-type", "").lower():
            return url
        if status == 200:
            return url
    return None


def download_pdf(url: str) -> tuple[bytes, dict[str, str]]:
    status, headers, body = http_request(url, method="GET", timeout=120, retries=5)
    if status != 200:
        raise RuntimeError(f"download HTTP {status}: {url}")
    if not body.startswith(b"%PDF"):
        raise RuntimeError(f"not a PDF ({len(body)} bytes): {url}")
    if len(body) < 10_000:
        raise RuntimeError(f"PDF suspiciously small ({len(body)} bytes): {url}")
    return body, headers


def sync_aliases(filename: str, source: Path, aliases: dict[str, list[str]]) -> list[Path]:
    updated: list[Path] = []
    for rel in aliases.get(filename, []):
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and sha256_file(dest) == sha256_file(source):
            continue
        shutil.copy2(source, dest)
        updated.append(dest)
        print(f"  → alias {rel}")
    return updated


def sync_one(
    *,
    code: str,
    lang: dict[str, Any],
    aliases: dict[str, list[str]],
    check_only: bool,
) -> dict[str, Any] | None:
    lang_id = lang["id"]
    filename = f"{code}{lang_id}.pdf"
    dest = BLANKS_DIR / filename
    guide_url = lang["guide_url_template"].format(code=code)
    pdf_template = lang["pdf_url_template"]

    print(f"- {filename}")
    url = discover_from_guide(guide_url, code, lang_id)
    source = "guide"
    if not url:
        print("  · guide had no PDF link; probing dated CDN folders…")
        url = discover_by_probing(pdf_template, code, lang_id)
        source = "probe"
    if not url:
        print("  ✗ could not discover latest URL")
        return None

    print(f"  · {source}: {url}")
    try:
        data, headers = download_pdf(url)
    except Exception as err:  # noqa: BLE001
        print(f"  ✗ download failed: {err}")
        return None

    digest = sha256_bytes(data)
    folder_m = DATE_FOLDER_RE.search(url)
    version_folder = folder_m.group(1) if folder_m else None
    record = {
        "file": filename,
        "code": code,
        "language": lang_id,
        "url": url,
        "version_folder": version_folder,
        "sha256": digest,
        "bytes": len(data),
        "last_modified": headers.get("last-modified"),
        "etag": headers.get("etag"),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "changed": False,
    }

    if dest.exists() and sha256_file(dest) == digest:
        print(f"  ✓ up to date ({len(data)} bytes)")
        sync_aliases(filename, dest, aliases)
        return record

    record["changed"] = True
    if check_only:
        print("  △ update available")
        return record

    BLANKS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".pdf.part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    print(f"  ✓ wrote {dest.relative_to(ROOT)} ({len(data)} bytes)")
    sync_aliases(filename, dest, aliases)
    return record


def build_manifest(catalog: dict[str, Any], files: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "kit": catalog.get("kit"),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": sorted(files, key=lambda row: row["file"]),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--forms",
        help="Comma-separated form codes (default: all in catalog)",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Discover/download in memory only; exit 1 if any file would change",
    )
    parser.add_argument(
        "--languages",
        default="e,f",
        help="Language ids to sync (default: e,f)",
    )
    args = parser.parse_args()

    catalog = load_catalog()
    wanted_forms = {
        item.strip().lower()
        for item in (args.forms.split(",") if args.forms else [])
        if item.strip()
    }
    wanted_langs = {item.strip().lower() for item in args.languages.split(",") if item.strip()}

    forms = catalog["forms"]
    if wanted_forms:
        forms = [f for f in forms if f["code"] in wanted_forms]
        missing = wanted_forms - {f["code"] for f in forms}
        if missing:
            print(f"Unknown form codes: {', '.join(sorted(missing))}", file=sys.stderr)
            return 2

    langs = [lang for lang in catalog["languages"] if lang["id"] in wanted_langs]
    aliases = catalog.get("aliases") or {}

    records: list[dict[str, Any]] = []
    failures = 0
    for form in forms:
        for lang in langs:
            row = sync_one(
                code=form["code"],
                lang=lang,
                aliases=aliases,
                check_only=args.check_only,
            )
            if row is None:
                failures += 1
            else:
                records.append(row)

    # Preserve prior manifest entries for forms not in this run.
    previous: dict[str, Any] = {}
    if MANIFEST_PATH.exists():
        try:
            previous = {
                row["file"]: row
                for row in json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("files", [])
            }
        except Exception:  # noqa: BLE001
            previous = {}
    merged = {row["file"]: row for row in previous.values()}
    for row in records:
        merged[row["file"]] = row

    # Ensure seeded/local blanks appear even if discovery failed this run.
    for path in sorted(BLANKS_DIR.glob("imm*.pdf")):
        if path.name in merged:
            continue
        merged[path.name] = {
            "file": path.name,
            "code": path.name[:-5],
            "language": path.name[-5],
            "url": None,
            "version_folder": None,
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "last_modified": None,
            "etag": None,
            "fetched_at": None,
            "changed": False,
            "note": "local blank; not refreshed in this run",
        }

    manifest = build_manifest(catalog, list(merged.values()))
    if not args.check_only:
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST_PATH.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"\nManifest → {MANIFEST_PATH.relative_to(ROOT)}")

    changed = [row for row in records if row.get("changed")]
    print(
        f"\nDone. synced={len(records)} changed={len(changed)} failures={failures}",
    )
    if args.check_only and changed:
        return 1
    if failures:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
