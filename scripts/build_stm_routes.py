#!/usr/bin/env python3
"""Build STM static route geometry, metro bundle, meta, and headways from GTFS."""

from __future__ import annotations

import csv
import io
import json
import statistics
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

GTFS_URL = "https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip"
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "yuzu_github_page" / "data"
ROUTES_DIR = DATA_DIR / "stm-routes"
BUS_ROUTE_TYPES = {"3", "11", "700"}
METRO_ROUTE_TYPES = {"1"}
SHAPE_STEP = 3
METRO_IDS = {"1", "2", "4", "5"}


def read_csv(zf: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    for info in zf.infolist():
        if info.filename.lower().endswith(name.lower()):
            with zf.open(info) as handle:
                text = io.TextIOWrapper(handle, encoding="utf-8-sig", newline="")
                return list(csv.DictReader(text))
    return []


def simplify(points: list[list[float]], step: int) -> list[list[float]]:
    if len(points) <= 2:
        return points
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def stop_record(stop: dict[str, str]) -> dict:
    wheelchair = (stop.get("wheelchair_boarding") or "").strip() == "1"
    try:
        lat = round(float(stop["stop_lat"]), 6)
        lng = round(float(stop["stop_lon"]), 6)
    except (KeyError, TypeError, ValueError):
        return {}
    stop_id = (stop.get("stop_id") or "").strip()
    if not stop_id:
        return {}
    return {
        "id": stop_id,
        "name": (stop.get("stop_name") or stop_id).strip(),
        "lat": lat,
        "lng": lng,
        "code": (stop.get("stop_code") or "").strip(),
        "wheelchair": wheelchair,
    }


def build_trip_first_departures(stop_times: list[dict[str, str]]) -> dict[str, int]:
    departures: dict[str, int] = {}
    for row in stop_times:
        trip_id = (row.get("trip_id") or "").strip()
        if not trip_id or trip_id in departures:
            continue
        try:
            parts = (row.get("departure_time") or "0:0:0").split(":")
            departures[trip_id] = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
        except (ValueError, IndexError):
            continue
    return departures


def compute_headways(route_trips: set[str], trip_departures: dict[str, int]) -> float | None:
    departures = sorted(trip_departures[trip_id] for trip_id in route_trips if trip_id in trip_departures)
    if len(departures) < 4:
        return None
    diffs = [departures[i + 1] - departures[i] for i in range(len(departures) - 1) if departures[i + 1] > departures[i]]
    if len(diffs) < 2:
        return None
    return round(statistics.median(diffs) / 60, 1)


def build_all(zf: zipfile.ZipFile) -> tuple[dict, dict, dict, dict]:
    routes = read_csv(zf, "routes.txt")
    trips = read_csv(zf, "trips.txt")
    shapes = read_csv(zf, "shapes.txt")
    stops = read_csv(zf, "stops.txt")
    stop_times = read_csv(zf, "stop_times.txt")
    trip_departures = build_trip_first_departures(stop_times)

    route_meta: dict[str, dict] = {}
    for row in routes:
        route_id = (row.get("route_id") or "").strip()
        short_name = (row.get("route_short_name") or route_id).strip()
        route_type = (row.get("route_type") or "").strip()
        if not route_id or not short_name:
            continue
        mode = "metro" if route_type in METRO_ROUTE_TYPES else "bus" if route_type in BUS_ROUTE_TYPES else "other"
        if mode == "other":
            continue
        color = (row.get("route_color") or "").strip()
        route_meta[route_id] = {
            "key": short_name,
            "name": (row.get("route_long_name") or short_name).strip(),
            "mode": mode,
            "color": f"#{color}" if color else None,
            "routeType": int(route_type) if route_type.isdigit() else route_type,
        }

    shape_points: dict[str, list[list[float]]] = defaultdict(list)
    for row in shapes:
        shape_id = (row.get("shape_id") or "").strip()
        if not shape_id:
            continue
        try:
            lat = float(row["shape_pt_lat"])
            lng = float(row["shape_pt_lon"])
            seq = int(row.get("shape_pt_sequence") or 0)
        except (KeyError, TypeError, ValueError):
            continue
        shape_points[shape_id].append((seq, lat, lng))

    ordered_shapes: dict[str, list[list[float]]] = {}
    for shape_id, seq_points in shape_points.items():
        seq_points.sort(key=lambda item: item[0])
        ordered_shapes[shape_id] = [[lat, lng] for _, lat, lng in seq_points]

    route_shapes: dict[str, list[dict]] = defaultdict(list)
    seen_shape_by_route: dict[str, set[str]] = defaultdict(set)
    trips_by_route: dict[str, set[str]] = defaultdict(set)

    for trip in trips:
        route_id = (trip.get("route_id") or "").strip()
        meta = route_meta.get(route_id)
        if not meta:
            continue
        trip_id = (trip.get("trip_id") or "").strip()
        if trip_id:
            trips_by_route[meta["key"]].add(trip_id)
        shape_id = (trip.get("shape_id") or "").strip()
        if not shape_id or shape_id in seen_shape_by_route[meta["key"]]:
            continue
        points = ordered_shapes.get(shape_id)
        if not points or len(points) < 2:
            continue
        headsign = (trip.get("trip_headsign") or f"Direction {len(seen_shape_by_route[meta['key']]) + 1}").strip()
        route_shapes[meta["key"]].append({
            "headsign": headsign,
            "points": simplify(points, SHAPE_STEP),
        })
        seen_shape_by_route[meta["key"]].add(shape_id)

    stop_lookup = {
        (row.get("stop_id") or "").strip(): row
        for row in stops
        if (row.get("stop_id") or "").strip()
    }

    trip_route: dict[str, str] = {}
    for trip in trips:
        route_id = (trip.get("route_id") or "").strip()
        meta = route_meta.get(route_id)
        trip_id = (trip.get("trip_id") or "").strip()
        if meta and trip_id:
            trip_route[trip_id] = meta["key"]

    route_stops: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in stop_times:
        trip_id = (row.get("trip_id") or "").strip()
        route_key = trip_route.get(trip_id)
        if not route_key:
            continue
        stop_id = (row.get("stop_id") or "").strip()
        stop = stop_lookup.get(stop_id)
        if not stop:
            continue
        record = stop_record(stop)
        if record:
            route_stops[route_key][stop_id] = record

    bus_routes: dict[str, dict] = {}
    metro_lines: list[dict] = []
    meta_index: dict[str, dict] = {}
    headways: dict[str, dict] = {}

    for route_id, meta in route_meta.items():
        key = meta["key"]
        meta_index[key] = {
            "name": meta["name"],
            "mode": meta["mode"],
            "color": meta["color"],
        }
        headway = compute_headways(trips_by_route.get(key, set()), trip_departures)
        if headway:
            headways[key] = {"avgHeadwayMin": headway}

        payload = {
            "name": meta["name"],
            "mode": meta["mode"],
            "color": meta["color"],
            "shapes": route_shapes.get(key, [])[:4],
            "stops": sorted(route_stops.get(key, {}).values(), key=lambda item: item["name"]),
        }
        if headway:
            payload["avgHeadwayMin"] = headway

        if meta["mode"] == "metro":
            metro_lines.append({"id": key, **payload})
        else:
            bus_routes[key] = payload

    metro_lines.sort(key=lambda line: line["id"])
    return bus_routes, {"lines": metro_lines}, meta_index, headways


def main() -> int:
    routes_dir = ROUTES_DIR
    routes_dir.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    local_zip = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if local_zip and local_zip.is_file():
        print(f"Using local GTFS archive {local_zip} …")
        archive = zipfile.ZipFile(local_zip)
    else:
        print(f"Downloading {GTFS_URL} …")
        with urllib.request.urlopen(GTFS_URL, timeout=120) as response:
            archive = zipfile.ZipFile(io.BytesIO(response.read()))

    bus_routes, metro, meta_index, headways = build_all(archive)
    built_at = datetime.now(timezone.utc).isoformat()

    index: dict[str, dict] = {}
    for route_id, route in bus_routes.items():
        safe_name = route_id.replace("/", "_")
        (routes_dir / f"{safe_name}.json").write_text(
            json.dumps({"id": route_id, **route}, separators=(",", ":")),
            encoding="utf-8",
        )
        index[route_id] = {
            "name": route["name"],
            "mode": route["mode"],
            "shapes": len(route["shapes"]),
            "stops": len(route["stops"]),
        }

    (routes_dir / "index.json").write_text(
        json.dumps(
            {"version": 2, "builtAt": built_at, "source": GTFS_URL, "routeCount": len(bus_routes), "routes": index},
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    (DATA_DIR / "stm-metro.json").write_text(json.dumps({"builtAt": built_at, **metro}, separators=(",", ":")), encoding="utf-8")
    (DATA_DIR / "stm-meta.json").write_text(json.dumps({"builtAt": built_at, "routes": meta_index}, separators=(",", ":")), encoding="utf-8")
    (DATA_DIR / "stm-headways.json").write_text(json.dumps({"builtAt": built_at, "routes": headways}, separators=(",", ":")), encoding="utf-8")

    total_kb = sum(path.stat().st_size for path in routes_dir.glob("*.json")) / 1024
    print(f"Wrote {len(bus_routes)} bus routes, {len(metro['lines'])} metro lines ({total_kb:.0f} KB bus geometry)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
