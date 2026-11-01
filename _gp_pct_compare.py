"""One-off GP % comparison: Closing-Stock-Jewels (12).xlsx vs KOKA.xlsx.

Read-only. Does not modify either workbook or application code.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

GENERATED = Path(r"C:\Users\needs\audit_platform\Closing-Stock-Jewels (12).xlsx")
REFERENCE = Path(r"C:\Users\needs\audit_platform\KOKA.xlsx")
OUT = Path(r"C:\Users\needs\audit_platform\_gp_pct_compare_out.json")

# generated sheet name → reference sheet name
SHEET_PAIRS = (
    ("Diamond", "DAIMONDS"),
    ("Emerald", "EMERALDS"),
    ("Pearls", "PERALS"),
    ("Rubie", "RUBIE"),
    ("Precious and Semi Precious", "PRECIOUS"),
)

# Generated workbook stores GP % rounded (~4 dp ratio / 2 dp percent).
# Default: 0.01 percentage points (= 0.0001 as a ratio).
PERCENT_TOLERANCE_PP = 0.01
SKIP_LABELS = {
    "company name",
    "address",
    "particulars",
    "particulars product",
    "particulars / product",
}


def norm_text(value: Any) -> str:
    text = str(value or "").casefold().replace("\xa0", " ")
    text = re.sub(r"[^a-z0-9%./]+", " ", text)
    return " ".join(text.split())


def is_skip_label(label: str) -> bool:
    key = norm_text(label)
    if not key or key in SKIP_LABELS:
        return True
    if key.startswith("financial year") or key.startswith("details of jewels"):
        return True
    if key.startswith("cin ") or key.startswith("shop no"):
        return True
    if "hyderabad" in key or "gandipet" in key:
        return True
    if key.startswith("shree jewellers"):
        return True
    if re.fullmatch(r"\d+", key):
        return True
    return False


def is_section_header(label: str, gp_raw: Any) -> bool:
    if is_total_label(label):
        return False
    # Any cell value (including 0 or Excel errors) means this is a data row.
    if gp_raw is not None and gp_raw != "":
        return False
    key = norm_text(label)
    # Blank GP with a product-like code stays a product (missing %).
    if re.search(r"[a-z]+\s*\d", key) or re.search(r"\d$", key):
        return False
    return True


def is_total_label(label: str) -> bool:
    key = norm_text(label)
    return key in {"total", "grand total"} or key.startswith("total ") or key.endswith(" total")


def total_kind(label: str) -> str:
    key = norm_text(label)
    if key == "grand total" or key.startswith("grand total"):
        return "grand_total"
    return "category_total"


def section_key(label: str) -> str:
    key = norm_text(label).rstrip(" :")
    key = key.replace(" and ", " ").replace(" & ", " ")
    key = re.sub(r"\bdiamonds?\b", "diamond", key)
    key = re.sub(r"\brosescut\b", "rosecut", key)
    key = re.sub(r"\bflat polki\b", "flat polki", key)
    key = re.sub(r"\bunct\b", "uncut", key)
    return " ".join(key.split())


def product_keys(label: str, category: str) -> list[str]:
    """Ordered candidate match keys for a product within a category."""
    raw = norm_text(label)
    cat = section_key(category)
    stripped = raw
    for token in cat.split():
        stripped = re.sub(rf"\b{re.escape(token)}s?\b", " ", stripped)
    stripped = " ".join(stripped.split()).strip(" :-")

    # Collapse letter/digit gaps: "fp 1" → "fp1", "jem 100" → "jem100"
    collapsed = re.sub(r"(?<=[a-z])\s+(?=\d)", "", stripped)
    collapsed = re.sub(r"(?<=\d)\s+(?=[a-z])", "", collapsed)
    collapsed_full = re.sub(r"(?<=[a-z])\s+(?=\d)", "", raw)
    collapsed_full = re.sub(r"(?<=\d)\s+(?=[a-z])", "", collapsed_full)

    keys: list[str] = []

    def add(key: str) -> None:
        key = " ".join(str(key or "").split())
        if key and key not in keys:
            keys.append(key)

    add(collapsed)
    add(stripped)
    add(collapsed_full)
    add(raw)
    add(re.sub(r"\s+", "", collapsed))
    add(re.sub(r"\s+", "", collapsed_full))

    pairs = re.findall(r"([a-z]+)\s*(\d+(?:\.\d+)?)", collapsed_full)
    if pairs:
        letters, digits = pairs[-1]
        add(letters + digits)
        for pref in ("qs", "di", "sy", "q"):
            if letters.startswith(pref) and len(letters) > len(pref):
                add(letters[len(pref) :] + digits)
        # beads: DB N and bare N under beads category
        if letters in {"db", "beads"} or "bead" in cat:
            add(digits)
            add("db" + digits)
        if letters in {"rc", "src"} or "rosecut" in cat:
            add("rc" + digits)
        if letters in {"fp"} or "flat polki" in cat or "polki" in cat:
            add("fp" + digits)
        if letters in {"ra"}:
            add("ra" + digits)
        if letters.startswith("jem"):
            add("jem" + digits)
        if letters.startswith("jps"):
            add("jps" + digits)
        if letters.startswith("jru") or letters.startswith("rub"):
            add("jru" + digits)
        if letters.startswith("jsy") or letters.startswith("jsp"):
            add(letters[:3] + digits)

    trailing = re.search(r"(\d+(?:\.\d+)?)$", collapsed.replace(" ", ""))
    if trailing:
        add(trailing.group(1))

    return keys


def coerce_ratio(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text or text.startswith("#"):
            return None
        if text.endswith("%"):
            try:
                return float(text[:-1].replace(",", "")) / 100.0
            except ValueError:
                return None
        try:
            value = float(text.replace(",", ""))
        except ValueError:
            return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    # Values like 50.95 are percentage points; 0.5095 is a ratio.
    if abs(number) > 1.5:
        return number / 100.0
    return number


def as_percent_points(ratio: float | None) -> float | None:
    if ratio is None:
        return None
    return ratio * 100.0


def find_gp_percent_col(ws) -> int:
    """Locate Gross Profit % by header text. Prefer leaf '%' under Gross Profit."""
    scan_rows = min(12, ws.max_row)
    scan_cols = min(40, ws.max_column)
    gross_cols: list[int] = []
    percent_cols: list[int] = []
    for row in range(1, scan_rows + 1):
        for col in range(1, scan_cols + 1):
            key = norm_text(ws.cell(row, col).value)
            if not key:
                continue
            if "gross profit" in key or key in {"gp", "g p"}:
                gross_cols.append(col)
            if key in {"%", "gp %", "g p %", "cy gp %", "cy g p %"} or key.endswith(" gp %"):
                percent_cols.append(col)
            if key == "amt" or key.startswith("amt"):
                # leaf Amt under Gross Profit — % is often the next column
                if gross_cols and abs(col - gross_cols[-1]) <= 1:
                    pass
    # Prefer a % column at/after the Gross Profit group start.
    if gross_cols and percent_cols:
        gp_start = min(gross_cols)
        candidates = [c for c in percent_cols if c >= gp_start]
        # Exclude trailing Deviation % if Gross Profit % exists earlier.
        if candidates:
            return min(candidates)
    if percent_cols:
        return min(percent_cols)
    if gross_cols:
        # Fallback: column after Gross Profit Amt.
        return min(gross_cols) + 1
    raise ValueError(f"GP % column not found on sheet {ws.title!r}")


def parse_sheet(ws, source_name: str) -> dict[str, Any]:
    gp_col = find_gp_percent_col(ws)
    products: list[dict[str, Any]] = []
    totals: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    seen: dict[tuple[str, str], int] = {}
    category = ""
    # Skip header block until first real label after particulars
    started = False
    for row in range(1, ws.max_row + 1):
        label = ws.cell(row, 1).value
        if label is None or str(label).strip() == "":
            continue
        text = str(label).strip()
        if is_skip_label(text):
            continue
        gp_raw = ws.cell(row, gp_col).value
        gp_ratio = coerce_ratio(gp_raw)
        if not started:
            # Ignore title rows; first section/product starts body.
            if norm_text(text).startswith("details of"):
                continue
            started = True

        if is_section_header(text, gp_raw):
            category = text
            continue

        if is_total_label(text):
            kind = total_kind(text)
            totals.append(
                {
                    "sheet": source_name,
                    "category": category or "",
                    "product": text,
                    "kind": kind,
                    "gpPctRatio": gp_ratio,
                    "gpPct": as_percent_points(gp_ratio),
                    "row": row,
                    "keys": [f"total:{kind}:{section_key(category)}"],
                }
            )
            continue

        keys = product_keys(text, category)
        entry = {
            "sheet": source_name,
            "category": category or "",
            "product": text,
            "kind": "product",
            "gpPctRatio": gp_ratio,
            "gpPct": as_percent_points(gp_ratio),
            "row": row,
            "keys": keys,
        }
        # Duplicate detection within same category using primary key.
        primary = (section_key(category), keys[0] if keys else norm_text(text))
        if primary in seen:
            duplicates.append({**entry, "duplicateOfRow": seen[primary]})
        else:
            seen[primary] = row
        products.append(entry)

    return {
        "sheet": source_name,
        "gpPercentColumn": gp_col,
        "products": products,
        "totals": totals,
        "duplicates": duplicates,
    }


def index_rows(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        cat = section_key(row.get("category") or "")
        for key in row.get("keys") or []:
            index[f"{cat}::{key}"].append(row)
            index[f"::{key}"].append(row)  # sheet-level fallback
        if row.get("kind") in {"category_total", "grand_total"}:
            index[f"total::{row['kind']}::{cat}"].append(row)
            if row["kind"] == "grand_total":
                index["total::grand_total::"].append(row)
    return index


def pick_match(
    gen: dict[str, Any],
    ref_index: dict[str, list[dict[str, Any]]],
    claimed: set[int],
) -> dict[str, Any] | None:
    cat = section_key(gen.get("category") or "")
    for key in gen.get("keys") or []:
        for scoped in (f"{cat}::{key}", f"::{key}"):
            candidates = [
                row
                for row in ref_index.get(scoped, [])
                if row["row"] not in claimed and row.get("kind") == "product"
            ]
            # Prefer same category when available.
            same_cat = [
                row
                for row in candidates
                if section_key(row.get("category") or "") == cat or not cat or not row.get("category")
            ]
            pool = same_cat or candidates
            if len(pool) == 1:
                return pool[0]
            if len(pool) > 1:
                # Ambiguous under this key — try next key.
                continue
    return None


def compare_pct(
    a: float | None,
    b: float | None,
    tol_pp: float = PERCENT_TOLERANCE_PP,
) -> dict[str, Any]:
    if a is None and b is None:
        return {"diff": 0.0, "status": "PASS", "note": "both_blank"}
    if a is None or b is None:
        return {
            "diff": None,
            "status": "FAIL",
            "note": "missing_value",
        }
    diff_pp = (a - b) * 100.0
    return {
        "diff": diff_pp,
        "status": "PASS" if abs(diff_pp) <= tol_pp else "FAIL",
        "note": None,
    }


def compare_sheets(gen_ws, ref_ws, gen_name: str, ref_name: str) -> dict[str, Any]:
    generated = parse_sheet(gen_ws, gen_name)
    reference = parse_sheet(ref_ws, ref_name)
    ref_index = index_rows(reference["products"])
    claimed: set[int] = set()
    matched: list[dict[str, Any]] = []
    missing_in_ref: list[dict[str, Any]] = []
    ambiguous: list[dict[str, Any]] = []

    for gen in generated["products"]:
        hit = pick_match(gen, ref_index, claimed)
        if hit is None:
            # Check ambiguity: multiple hits for first key
            cat = section_key(gen.get("category") or "")
            amb = False
            for key in gen.get("keys") or []:
                pool = [
                    row
                    for row in ref_index.get(f"{cat}::{key}", []) + ref_index.get(f"::{key}", [])
                    if row["row"] not in claimed and row.get("kind") == "product"
                ]
                # unique by row
                uniq = {row["row"]: row for row in pool}
                if len(uniq) > 1:
                    ambiguous.append(
                        {
                            "sheet": gen_name,
                            "category": gen["category"],
                            "product": gen["product"],
                            "candidates": [r["product"] for r in uniq.values()],
                        }
                    )
                    amb = True
                    break
            if not amb:
                missing_in_ref.append(gen)
            continue
        claimed.add(hit["row"])
        cmp = compare_pct(gen["gpPctRatio"], hit["gpPctRatio"])
        matched.append(
            {
                "sheet": gen_name,
                "category": gen["category"] or hit["category"],
                "product": gen["product"],
                "referenceProduct": hit["product"],
                "generatedGpPct": gen["gpPct"],
                "referenceGpPct": hit["gpPct"],
                "diffPercentagePoints": cmp["diff"],
                "status": cmp["status"],
                "note": cmp["note"],
                "kind": "product",
            }
        )

    missing_in_gen = [row for row in reference["products"] if row["row"] not in claimed]

    # Totals
    total_rows: list[dict[str, Any]] = []
    ref_totals_by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for total in reference["totals"]:
        cat = section_key(total.get("category") or "")
        ref_totals_by_key[f"{total['kind']}::{cat}"].append(total)
        if total["kind"] == "grand_total":
            ref_totals_by_key["grand_total::"].append(total)

    used_total_rows: set[int] = set()
    for total in generated["totals"]:
        cat = section_key(total.get("category") or "")
        candidates = ref_totals_by_key.get(f"{total['kind']}::{cat}", [])
        if not candidates and total["kind"] == "grand_total":
            candidates = ref_totals_by_key.get("grand_total::", [])
        candidates = [c for c in candidates if c["row"] not in used_total_rows]
        # Emerald/Pearls/Rubie: generated GRAND TOTAL ↔ reference sheet TOTAL.
        if not candidates and total["kind"] == "grand_total":
            leftovers = [
                c
                for c in reference["totals"]
                if c["row"] not in used_total_rows
            ]
            if len(leftovers) == 1:
                candidates = leftovers
        if not candidates:
            total_rows.append(
                {
                    "sheet": gen_name,
                    "category": total["category"],
                    "product": total["product"],
                    "kind": total["kind"],
                    "generatedGpPct": total["gpPct"],
                    "referenceGpPct": None,
                    "diffPercentagePoints": None,
                    "status": "FAIL",
                    "note": "missing_in_reference",
                }
            )
            continue
        hit = candidates[0]
        used_total_rows.add(hit["row"])
        cmp = compare_pct(total["gpPctRatio"], hit["gpPctRatio"])
        total_rows.append(
            {
                "sheet": gen_name,
                "category": total["category"] or hit["category"],
                "product": total["product"],
                "referenceProduct": hit["product"],
                "kind": total["kind"],
                "generatedGpPct": total["gpPct"],
                "referenceGpPct": hit["gpPct"],
                "diffPercentagePoints": cmp["diff"],
                "status": cmp["status"],
                "note": cmp["note"],
            }
        )

    for total in reference["totals"]:
        if total["row"] in used_total_rows:
            continue
        total_rows.append(
            {
                "sheet": gen_name,
                "category": total["category"],
                "product": total["product"],
                "kind": total["kind"],
                "generatedGpPct": None,
                "referenceGpPct": total["gpPct"],
                "diffPercentagePoints": None,
                "status": "FAIL",
                "note": "missing_in_generated",
            }
        )

    amount_fail = sum(1 for row in matched if row["status"] == "FAIL")
    # naming kept for summary clarity — percent mismatches
    pct_fail = amount_fail
    summary = {
        "sheet": gen_name,
        "referenceSheet": ref_name,
        "generatedGpPercentColumn": generated["gpPercentColumn"],
        "referenceGpPercentColumn": reference["gpPercentColumn"],
        "matchedProducts": len(matched),
        "passCount": sum(1 for row in matched if row["status"] == "PASS"),
        "failCount": pct_fail,
        "missingInReference": len(missing_in_ref),
        "missingInGenerated": len(missing_in_gen),
        "duplicateGenerated": len(generated["duplicates"]),
        "duplicateReference": len(reference["duplicates"]),
        "ambiguousMatches": len(ambiguous),
        "totalRowsCompared": len(total_rows),
        "totalPass": sum(1 for row in total_rows if row["status"] == "PASS"),
        "totalFail": sum(1 for row in total_rows if row["status"] == "FAIL"),
    }
    return {
        "summary": summary,
        "matched": matched,
        "missingInReference": [
            {
                "sheet": gen_name,
                "category": r["category"],
                "product": r["product"],
                "generatedGpPct": r["gpPct"],
            }
            for r in missing_in_ref
        ],
        "missingInGenerated": [
            {
                "sheet": gen_name,
                "category": r["category"],
                "product": r["product"],
                "referenceGpPct": r["gpPct"],
            }
            for r in missing_in_gen
        ],
        "duplicatesGenerated": generated["duplicates"],
        "duplicatesReference": reference["duplicates"],
        "ambiguous": ambiguous,
        "totals": total_rows,
    }


def main() -> None:
    gen_wb = load_workbook(GENERATED, data_only=True)
    ref_wb = load_workbook(REFERENCE, data_only=True)
    sheets = []
    for gen_name, ref_name in SHEET_PAIRS:
        if gen_name not in gen_wb.sheetnames:
            raise SystemExit(f"Missing generated sheet {gen_name}")
        if ref_name not in ref_wb.sheetnames:
            raise SystemExit(f"Missing reference sheet {ref_name}")
        sheets.append(
            compare_sheets(gen_wb[gen_name], ref_wb[ref_name], gen_name, ref_name)
        )

    all_matched = [row for sheet in sheets for row in sheet["matched"]]
    all_fails = [row for row in all_matched if row["status"] == "FAIL"]
    report = {
        "generated": str(GENERATED),
        "reference": str(REFERENCE),
        "tolerancePercentagePoints": PERCENT_TOLERANCE_PP,
        "overall": {
            "matchedProducts": len(all_matched),
            "passCount": sum(1 for row in all_matched if row["status"] == "PASS"),
            "failCount": len(all_fails),
            "missingInReference": sum(len(s["missingInReference"]) for s in sheets),
            "missingInGenerated": sum(len(s["missingInGenerated"]) for s in sheets),
            "totalFail": sum(s["summary"]["totalFail"] for s in sheets),
            "totalPass": sum(s["summary"]["totalPass"] for s in sheets),
        },
        "sheets": sheets,
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["overall"], indent=2))
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
