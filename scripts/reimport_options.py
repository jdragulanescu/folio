"""Re-import options data from stocks-v2.numbers into NocoDB.

Clears existing options records and imports fresh data from both
Wheel and LEAPS tables with all fields populated:
  - commission, outer_strike, platform (IBKR)
  - Strategy override: VPCS wherever outer_strike is present
  - Strategy mapping: Wheel, Collar, VPCS, PMCC, LEAPS, BET, Hedge
  - No moneyness or collateral (removed from DB)

Run from project root:
    python scripts/reimport_options.py

Requires:
    pip install -r scripts/requirements.txt
"""

import os
import sys
from datetime import datetime, timedelta
from numbers_parser import Document
from utils.nocodb_client import NocoDBClient
from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def format_date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


def safe_float(value, default=None) -> float | None:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        if cleaned in ("", "-", "--", "\u2013"):
            return default
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def safe_int(value, default=None) -> int | None:
    f = safe_float(value, default=None)
    if f is None:
        return default
    return int(f)


def build_header_map(header_row: list) -> dict[str, int]:
    mapping = {}
    for i, h in enumerate(header_row):
        if h is not None:
            normalised = str(h).strip().lower()
            mapping[normalised] = i
    return mapping


def get_col(row: list, header_map: dict, *candidate_names: str, default=None):
    for name in candidate_names:
        idx = header_map.get(name.lower())
        if idx is not None and idx < len(row):
            return row[idx]
    return default


# ---------------------------------------------------------------------------
# Strategy normalisation
# ---------------------------------------------------------------------------

# Valid strategies: Wheel, Collar, VPCS, PMCC, LEAPS, BET, Hedge
STRATEGY_MAP = {
    "wheel": "Wheel",
    "collar": "Collar",
    "vpcs": "VPCS",
    "pmcc": "PMCC",
    "leaps": "LEAPS",
    "bet": "BET",
    "hedge": "Hedge",
}


def normalise_strategy(raw, outer_strike=None) -> str:
    """Normalise strategy name. Override to VPCS if outer_strike present."""
    if outer_strike is not None:
        return "VPCS"
    if raw is None:
        return "Wheel"  # fallback
    key = str(raw).strip().lower()
    return STRATEGY_MAP.get(key, str(raw).strip())


def normalise_call_put(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if s.lower() in ("call", "c"):
        return "Call"
    if s.lower() in ("put", "p"):
        return "Put"
    return s


def normalise_buy_sell(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if s.lower() in ("buy", "b"):
        return "Buy"
    if s.lower() in ("sell", "s"):
        return "Sell"
    return s


def normalise_status(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    status_map = {
        "open": "Open",
        "closed": "Closed",
        "expired": "Expired",
        "rolled": "Rolled",
        "assigned": "Assigned",
    }
    return status_map.get(s.lower(), s)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def reimport():
    load_dotenv()

    base_url = os.environ.get("NOCODB_BASE_URL")
    api_token = os.environ.get("NOCODB_API_TOKEN")
    options_table_id = os.environ.get("NOCODB_TABLE_OPTIONS")

    if not all([base_url, api_token, options_table_id]):
        print("ERROR: Missing environment variables.")
        print("Required: NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_TABLE_OPTIONS")
        sys.exit(1)

    # We only need the client for delete + insert, use it directly
    client = NocoDBClient(
        base_url=base_url,
        api_token=api_token,
        base_id="unused",  # not needed for direct table operations
    )

    # Open spreadsheet
    numbers_file = "/Users/skylight/Downloads/stocks-v2.numbers"
    print(f"Reading {numbers_file}...")
    doc = Document(numbers_file)

    # -----------------------------------------------------------------------
    # Extract Wheel options
    # -----------------------------------------------------------------------
    print("\n=== Extracting Wheel options ===")
    wheel_table = doc.sheets["Options"].tables["Options Wheel Strategy"]
    wheel_rows = wheel_table.rows(values_only=True)
    wheel_header = build_header_map(wheel_rows[0])

    wheel_records = []
    for row in wheel_rows[1:]:
        ticker = get_col(row, wheel_header, "ticker")
        if ticker is None or str(ticker).strip() == "":
            continue

        outer_strike = safe_float(get_col(row, wheel_header, "outer strike"))
        raw_strategy = get_col(row, wheel_header, "strategy")
        commission = safe_float(get_col(row, wheel_header, "commision"))

        record = {
            "ticker": str(ticker).strip().upper(),
            "opened": format_date(get_col(row, wheel_header, "opened")),
            "strategy_type": normalise_strategy(raw_strategy, outer_strike),
            "call_put": normalise_call_put(get_col(row, wheel_header, "c / p", "c/p")),
            "buy_sell": normalise_buy_sell(get_col(row, wheel_header, "buy/sell")),
            "expiration": format_date(get_col(row, wheel_header, "expiration")),
            "strike": safe_float(get_col(row, wheel_header, "strike")),
            "delta": safe_float(get_col(row, wheel_header, "greeks (delta)")),
            "iv_pct": safe_float(get_col(row, wheel_header, "greeks (iv%)")),
            "qty": safe_int(get_col(row, wheel_header, "qty")),
            "premium": safe_float(get_col(row, wheel_header, "premium")),
            "status": normalise_status(get_col(row, wheel_header, "status")),
            "close_date": format_date(get_col(row, wheel_header, "date closed")),
            "close_premium": safe_float(get_col(row, wheel_header, "closing cost")),
            "outer_strike": outer_strike,
            "commission": commission,
            "platform": "IBKR",
            "notes": str(get_col(row, wheel_header, "notes", default="")).strip() or None,
        }
        wheel_records.append(record)

    print(f"  Extracted {len(wheel_records)} Wheel-table records")

    # Show strategy breakdown
    strat_counts = {}
    for r in wheel_records:
        s = r["strategy_type"]
        strat_counts[s] = strat_counts.get(s, 0) + 1
    for s, c in sorted(strat_counts.items()):
        print(f"    {s}: {c}")

    # -----------------------------------------------------------------------
    # Extract LEAPS options
    # -----------------------------------------------------------------------
    print("\n=== Extracting LEAPS options ===")
    leaps_table = doc.sheets["Options"].tables["Options LEAPS"]
    leaps_rows = leaps_table.rows(values_only=True)
    leaps_header = build_header_map(leaps_rows[0])

    leaps_records = []
    for row in leaps_rows[1:]:
        ticker = get_col(row, leaps_header, "ticker")
        if ticker is None or str(ticker).strip() == "":
            continue

        raw_strategy = get_col(row, leaps_header, "strategy")
        commission = safe_float(get_col(row, leaps_header, "commision"))

        record = {
            "ticker": str(ticker).strip().upper(),
            "opened": format_date(get_col(row, leaps_header, "opened")),
            "strategy_type": normalise_strategy(raw_strategy),
            "call_put": normalise_call_put(get_col(row, leaps_header, "c / p", "c/p")),
            "buy_sell": normalise_buy_sell(get_col(row, leaps_header, "buy/sell")),
            "expiration": format_date(get_col(row, leaps_header, "expiration")),
            "strike": safe_float(get_col(row, leaps_header, "strike")),
            "delta": safe_float(get_col(row, leaps_header, "greeks (delta)")),
            "iv_pct": safe_float(get_col(row, leaps_header, "greeks (iv%)")),
            "qty": safe_int(get_col(row, leaps_header, "qty")),
            "premium": safe_float(get_col(row, leaps_header, "premium")),
            "status": normalise_status(get_col(row, leaps_header, "status")),
            "close_date": format_date(get_col(row, leaps_header, "date closed")),
            "close_premium": safe_float(get_col(row, leaps_header, "closing cost")),
            "outer_strike": None,  # LEAPS table has no outer_strike column
            "commission": commission,
            "platform": "IBKR",
            "notes": None,  # LEAPS table has no notes column
        }
        leaps_records.append(record)

    print(f"  Extracted {len(leaps_records)} LEAPS-table records")

    strat_counts = {}
    for r in leaps_records:
        s = r["strategy_type"]
        strat_counts[s] = strat_counts.get(s, 0) + 1
    for s, c in sorted(strat_counts.items()):
        print(f"    {s}: {c}")

    # -----------------------------------------------------------------------
    # Combine and insert
    # -----------------------------------------------------------------------
    all_options = wheel_records + leaps_records
    print(f"\n=== Total options: {len(all_options)} ===")

    # Clear existing records
    print("\nClearing existing options records...")
    deleted = client.delete_all_records(options_table_id)
    print(f"  Deleted {deleted} existing records")

    # Insert new records
    print("\nInserting new records...")
    client.bulk_insert(options_table_id, all_options)

    # Summary
    print("\n" + "=" * 50)
    print("=== Re-import Summary ===")
    print("=" * 50)
    all_strats = {}
    for r in all_options:
        s = r["strategy_type"]
        all_strats[s] = all_strats.get(s, 0) + 1
    for s, c in sorted(all_strats.items()):
        print(f"  {s}: {c}")
    print(f"  TOTAL: {len(all_options)}")
    print("\nDone.")


if __name__ == "__main__":
    try:
        reimport()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
