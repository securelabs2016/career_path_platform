"""
One-shot migration: replace apps/web/src/data/semiconductors.json with the
84-role reference Semi taxonomy + apps/web/src/data/adjacencies-semi.json
with the 298 reference edges.

Sources:
  - from_client/career-lattice/index.html        — column/row layout
  - from_client/_extracted/reference_roles.json  — title / salary / degree
  - from_client/_extracted/reference_pathData.json — edges

Run once. Idempotent (overwrites the two web data files in place).
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent.parent
HTML = ROOT / "from_client" / "career-lattice" / "index.html"
ROLES_JSON = ROOT / "from_client" / "_extracted" / "reference_roles.json"
EDGES_JSON = ROOT / "from_client" / "_extracted" / "reference_pathData.json"
OUT_INDUSTRY = ROOT / "apps" / "web" / "src" / "data" / "semiconductors.json"
OUT_ADJ = ROOT / "apps" / "web" / "src" / "data" / "adjacencies-semi.json"

CLUSTER_BY_COL = {
    "col1": "Research, Design & Engineering",
    "col2": "Wafer Fabrication",
    "col3": "Assembly, Packaging & Testing",
    "col4": "Facilities & Equipment Maintenance",
    "col5": "Supply Chain, Logistics & Business Operations",
}
COL_INDEX = {"col1": 0, "col2": 1, "col3": 2, "col4": 3, "col5": 4}
ROW_TIER = {"sr": "senior", "md": "mid", "en": "entry"}
ROW_INDEX = {"entry": 0, "mid": 1, "senior": 2}

SALARY_RE = re.compile(r"\$([\d,]+)\s*-\s*\$([\d,]+)")


def parse_salary(s: str) -> tuple[int, int]:
    m = SALARY_RE.search(s)
    if not m:
        return (0, 0)
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def extract_grid(html_text: str) -> dict[str, dict]:
    """Walk the reference HTML table. For each role node, return its column,
    tier row, and its sub-row position within the cell (used to deterministically
    order roles that share a (column, tier) cell)."""
    soup = BeautifulSoup(html_text, "html.parser")
    grid: dict[str, dict] = {}

    table = soup.find("table")
    if table is None:
        raise RuntimeError("no <table> found in reference HTML")

    for tr in table.find_all("tr"):
        tr_classes = tr.get("class") or []
        tier = None
        for cls in tr_classes:
            if cls in ROW_TIER:
                tier = ROW_TIER[cls]
                break
        if tier is None:
            continue

        for td in tr.find_all("td", class_="cell"):
            td_classes = td.get("class") or []
            col_key = next((c for c in td_classes if c in CLUSTER_BY_COL), None)
            if col_key is None:
                continue

            # Cells contain <div class="nr"> sub-rows; each <span class="node"> is a role.
            sub_row_idx = 0
            for nr in td.find_all("div", class_="nr"):
                for node in nr.find_all("span", class_="node"):
                    role_id = node.get("id")
                    if not role_id:
                        continue
                    grid[role_id] = {
                        "column_key": col_key,
                        "tier": tier,
                        "sub_row": sub_row_idx,
                    }
                sub_row_idx += 1
    return grid


def main() -> None:
    html_text = HTML.read_text(encoding="utf-8")
    roles_in = json.loads(ROLES_JSON.read_text(encoding="utf-8"))
    edges_in = json.loads(EDGES_JSON.read_text(encoding="utf-8"))
    grid = extract_grid(html_text)

    # Sanity — every role in roles_in must have a grid placement.
    missing = [rid for rid in roles_in if rid not in grid]
    if missing:
        raise RuntimeError(f"{len(missing)} reference role(s) absent from HTML grid: {missing[:5]}...")

    industry = {
        "id": "semiconductors",
        "name": "Semiconductors",
        "slug": "semiconductors",
        "description": (
            "The full career landscape of semiconductor design, fabrication, and packaging — "
            "from wafer fab operators to chip architects, driven by the CHIPS Act and growing "
            "US domestic production investment."
        ),
        "color": "#7c3aed",
    }

    clusters = [
        CLUSTER_BY_COL["col1"],
        CLUSTER_BY_COL["col2"],
        CLUSTER_BY_COL["col3"],
        CLUSTER_BY_COL["col4"],
        CLUSTER_BY_COL["col5"],
    ]
    seniority_levels = ["entry", "mid", "senior"]

    # Build the role list. Adjacencies live in the separate file, but we also
    # populate `adjacent_role_ids` so existing components keep working.
    roles_out = []
    for rid, info in roles_in.items():
        title = info["title"].replace("&amp;", "&").replace("&#039;", "'")
        smin, smax = parse_salary(info["salary"])
        deg_required = info.get("degree_required", False)
        cell = grid[rid]
        cluster = CLUSTER_BY_COL[cell["column_key"]]
        tier = cell["tier"]

        roles_out.append(
            {
                "id": rid,
                "industry_id": "semiconductors",
                "title": title,
                "cluster": cluster,
                "seniority": tier,
                "salary_min": smin,
                "salary_max": smax,
                "salary_range": info["salary"],
                "degree_required": "4yr" if deg_required else "hs",
                "skills": [],
                "certifications": [],
                "description": "",
                "pathway_ids": [],
                "adjacent_role_ids": [e["id"] for e in edges_in.get(rid, [])],
                "open_jobs_count": 0,
                "hiring_companies": [],
                "grid_col": COL_INDEX[cell["column_key"]],
                "grid_row": ROW_INDEX[tier],
            }
        )

    # Sort: cluster (left→right), then tier (entry→senior), then sub_row position
    # in original HTML, so multi-role cells preserve the reference's vertical order.
    def sort_key(r):
        return (r["grid_col"], ROW_INDEX[r["seniority"]], grid[r["id"]]["sub_row"])

    roles_out.sort(key=sort_key)

    out_industry = {
        "industry": industry,
        "clusters": clusters,
        "seniority_levels": seniority_levels,
        "roles": roles_out,
        "pathways": [],
    }

    OUT_INDUSTRY.write_text(json.dumps(out_industry, indent=2) + "\n", encoding="utf-8")

    # Adjacencies file: { role_id: [next_role_id, ...] }
    adj_out = {rid: [e["id"] for e in nexts] for rid, nexts in edges_in.items()}
    OUT_ADJ.write_text(json.dumps(adj_out, indent=2) + "\n", encoding="utf-8")

    # Summary
    edge_count = sum(len(v) for v in adj_out.values())
    by_cluster = {c: 0 for c in clusters}
    by_tier = {t: 0 for t in seniority_levels}
    for r in roles_out:
        by_cluster[r["cluster"]] += 1
        by_tier[r["seniority"]] += 1

    print(f"Wrote {OUT_INDUSTRY.relative_to(ROOT)}: {len(roles_out)} roles")
    print(f"Wrote {OUT_ADJ.relative_to(ROOT)}: {edge_count} edges across {len(adj_out)} origin roles")
    print()
    print("Roles per cluster:")
    for c, n in by_cluster.items():
        print(f"  {n:>3}  {c}")
    print("Roles per tier:")
    for t, n in by_tier.items():
        print(f"  {n:>3}  {t}")


if __name__ == "__main__":
    main()
