"""One-time migration script: reads stocks-v2.numbers and imports all data into NocoDB.

Run from project root:
    python scripts/migrate.py          # Import data (skip if tables have records)
    python scripts/migrate.py --clean  # Clear all records first, then re-import

Requires:
    pip install -r scripts/requirements.txt
    brew install snappy  (macOS) or apt-get install libsnappy-dev (Linux)
"""

import os
import sys
import math
from datetime import datetime, timedelta
from numbers_parser import Document
from utils.nocodb_client import NocoDBClient
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Platform normalisation (DATA-04)
# ---------------------------------------------------------------------------

PLATFORM_MAP = {
    "Etoro": "eToro",
    "etoro": "eToro",
    "eToro": "eToro",
    "Hood": "Robinhood",
    "hood": "Robinhood",
    "Robinhood": "Robinhood",
    "Trading 212": "Trading 212",
    "trading 212": "Trading 212",
    "IBKR": "IBKR",
    "ibkr": "IBKR",
    "Freetrade": "Freetrade",
    "freetrade": "Freetrade",
    "Stake": "Stake",
    "stake": "Stake",
}


def normalise_platform(raw) -> str | None:
    """Normalise platform names from spreadsheet to NocoDB enum values."""
    if raw is None:
        return None
    stripped = str(raw).strip()
    return PLATFORM_MAP.get(stripped, stripped)


# ---------------------------------------------------------------------------
# Date formatting
# ---------------------------------------------------------------------------


def format_date(value) -> str | None:
    """Convert numbers-parser date to ISO format string (YYYY-MM-DD).

    Handles datetime objects, timedelta objects (from Numbers), and
    various string date formats.
    """
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


# ---------------------------------------------------------------------------
# Safe numeric conversion
# ---------------------------------------------------------------------------


def safe_float(value, default=None) -> float | None:
    """Convert a value to float safely. Returns default if not convertible."""
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
    """Convert a value to int safely. Returns default if not convertible."""
    f = safe_float(value, default=None)
    if f is None:
        return default
    return int(f)


def timedelta_to_days(value) -> int | None:
    """Convert a timedelta to integer days. Handle None and non-timedelta."""
    if value is None:
        return None
    if isinstance(value, timedelta):
        return value.days
    if isinstance(value, (int, float)):
        return int(value)
    return None


# ---------------------------------------------------------------------------
# NocoDB Table Schemas (DATA-02)
# ---------------------------------------------------------------------------

ID_COLUMN = {"column_name": "Id", "title": "Id", "uidt": "ID", "dt": "int4", "pk": True, "ai": True, "rqd": True}

TABLE_SCHEMAS = {
    "symbols": {
        "table_name": "symbols",
        "columns": [
            ID_COLUMN,
            {"column_name": "symbol", "uidt": "SingleLineText"},
            {"column_name": "name", "uidt": "SingleLineText"},
            {
                "column_name": "sector",
                "uidt": "SingleSelect",
                "dtxp": "'Tech','Financial','Retail','Communication','Healthcare','Energy','Industrial','Real Estate','ETF','Crypto','Consumer','Technology'",
            },
            {
                "column_name": "strategy",
                "uidt": "SingleSelect",
                "dtxp": "'Growth','Value','Risky'",
            },
            {"column_name": "current_price", "uidt": "Decimal"},
            {"column_name": "previous_close", "uidt": "Decimal"},
            {"column_name": "change_pct", "uidt": "Decimal"},
            {"column_name": "day_high", "uidt": "Decimal"},
            {"column_name": "day_low", "uidt": "Decimal"},
            {"column_name": "year_high", "uidt": "Decimal"},
            {"column_name": "year_low", "uidt": "Decimal"},
            {"column_name": "market_cap", "uidt": "Number"},
            {"column_name": "pe_ratio", "uidt": "Decimal"},
            {"column_name": "eps", "uidt": "Decimal"},
            {"column_name": "dividend_yield", "uidt": "Decimal"},
            {"column_name": "avg_volume", "uidt": "Number"},
            {"column_name": "last_price_update", "uidt": "DateTime"},
        ],
    },
    "transactions": {
        "table_name": "transactions",
        "columns": [
            ID_COLUMN,
            {"column_name": "symbol", "uidt": "SingleLineText"},
            {"column_name": "name", "uidt": "SingleLineText"},
            {
                "column_name": "type",
                "uidt": "SingleSelect",
                "dtxp": "'Buy','Sell'",
            },
            {"column_name": "price", "uidt": "Decimal"},
            {"column_name": "shares", "uidt": "Decimal"},
            {"column_name": "amount", "uidt": "Decimal"},
            {"column_name": "eps", "uidt": "Decimal"},
            {"column_name": "date", "uidt": "Date"},
            {
                "column_name": "platform",
                "uidt": "SingleSelect",
                "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'",
            },
        ],
    },
    "options": {
        "table_name": "options",
        "columns": [
            ID_COLUMN,
            {"column_name": "ticker", "uidt": "SingleLineText"},
            {"column_name": "opened", "uidt": "Date"},
            {
                "column_name": "strategy_type",
                "uidt": "SingleSelect",
                "dtxp": "'Wheel','LEAPS','Spread'",
            },
            {
                "column_name": "call_put",
                "uidt": "SingleSelect",
                "dtxp": "'Call','Put'",
            },
            {
                "column_name": "buy_sell",
                "uidt": "SingleSelect",
                "dtxp": "'Buy','Sell'",
            },
            {"column_name": "expiration", "uidt": "Date"},
            {"column_name": "strike", "uidt": "Decimal"},
            {"column_name": "delta", "uidt": "Decimal"},
            {"column_name": "iv_pct", "uidt": "Decimal"},
            {
                "column_name": "moneyness",
                "uidt": "SingleSelect",
                "dtxp": "'OTM','ATM','ITM'",
            },
            {"column_name": "qty", "uidt": "Number"},
            {"column_name": "premium", "uidt": "Decimal"},
            {"column_name": "collateral", "uidt": "Decimal"},
            {
                "column_name": "status",
                "uidt": "SingleSelect",
                "dtxp": "'Open','Closed','Expired','Rolled','Assigned'",
            },
            {"column_name": "close_date", "uidt": "Date"},
            {"column_name": "close_premium", "uidt": "Decimal"},
            {"column_name": "profit", "uidt": "Decimal"},
            {"column_name": "days_held", "uidt": "Number"},
            {"column_name": "return_pct", "uidt": "Decimal"},
            {"column_name": "annualised_return_pct", "uidt": "Decimal"},
            {"column_name": "notes", "uidt": "LongText"},
        ],
    },
    "deposits": {
        "table_name": "deposits",
        "columns": [
            ID_COLUMN,
            {"column_name": "month", "uidt": "Date"},
            {"column_name": "amount", "uidt": "Decimal"},
            {
                "column_name": "platform",
                "uidt": "SingleSelect",
                "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'",
            },
        ],
    },
    "dividends": {
        "table_name": "dividends",
        "columns": [
            ID_COLUMN,
            {"column_name": "symbol", "uidt": "SingleLineText"},
            {"column_name": "amount", "uidt": "Decimal"},
            {"column_name": "date", "uidt": "Date"},
            {
                "column_name": "platform",
                "uidt": "SingleSelect",
                "dtxp": "'IBKR','Trading 212','Freetrade','Stake','eToro','Robinhood'",
            },
        ],
    },
    "monthly_snapshots": {
        "table_name": "monthly_snapshots",
        "columns": [
            ID_COLUMN,
            {"column_name": "month", "uidt": "Date"},
            {"column_name": "total_invested", "uidt": "Decimal"},
            {"column_name": "portfolio_value", "uidt": "Decimal"},
            {"column_name": "gain_loss", "uidt": "Decimal"},
            {"column_name": "gain_loss_pct", "uidt": "Decimal"},
            {"column_name": "dividend_income", "uidt": "Decimal"},
            {"column_name": "options_premium", "uidt": "Decimal"},
            {"column_name": "options_capital_gains", "uidt": "Decimal"},
            {"column_name": "total_deposits", "uidt": "Decimal"},
        ],
    },
    "price_history": {
        "table_name": "price_history",
        "columns": [
            ID_COLUMN,
            {"column_name": "symbol", "uidt": "SingleLineText"},
            {"column_name": "date", "uidt": "Date"},
            {"column_name": "close_price", "uidt": "Decimal"},
            {"column_name": "volume", "uidt": "Number"},
        ],
    },
    "settings": {
        "table_name": "settings",
        "columns": [
            ID_COLUMN,
            {"column_name": "key", "uidt": "SingleLineText"},
            {"column_name": "value", "uidt": "SingleLineText"},
            {"column_name": "description", "uidt": "SingleLineText"},
        ],
    },
}


# ---------------------------------------------------------------------------
# Deposit column mapping
# ---------------------------------------------------------------------------
# Deposited table layout (from .numbers exploration):
#   [0] Month, [1] Total, [2] IBKR, [3] None (empty col), [4] Trading 212,
#   [5] Freetrade, [6] Stake, [7] Etoro, [8] Hood

DEPOSIT_COL_MAP = {
    "IBKR": 2,
    "Trading 212": 4,
    "Freetrade": 5,
    "Stake": 6,
    "Etoro": 7,
    "Hood": 8,
}


# ---------------------------------------------------------------------------
# Options column mapping helpers
# ---------------------------------------------------------------------------


def build_header_map(header_row: list) -> dict[str, int]:
    """Build a mapping of normalised header names to column indices.

    Strips whitespace and lowercases header names for resilient matching.
    """
    mapping = {}
    for i, h in enumerate(header_row):
        if h is not None:
            normalised = str(h).strip().lower()
            mapping[normalised] = i
    return mapping


def get_col(row: list, header_map: dict, *candidate_names: str, default=None):
    """Get a value from a row by trying multiple header name candidates."""
    for name in candidate_names:
        idx = header_map.get(name.lower())
        if idx is not None and idx < len(row):
            return row[idx]
    return default


# ---------------------------------------------------------------------------
# Moneyness normalisation
# ---------------------------------------------------------------------------


def normalise_moneyness(raw) -> str | None:
    """Normalise moneyness value to OTM/ATM/ITM or None.

    The spreadsheet uses '-' for unset values and sometimes has raw
    numeric values instead of the categorical labels.
    """
    if raw is None:
        return None
    s = str(raw).strip().upper()
    if s in ("OTM", "ATM", "ITM"):
        return s
    # '-' or numeric or other non-standard values
    return None


# ---------------------------------------------------------------------------
# Main migration
# ---------------------------------------------------------------------------


def migrate():
    """Run the full migration: .numbers file -> NocoDB tables."""
    load_dotenv()

    # Validate environment
    base_url = os.environ.get("NOCODB_BASE_URL")
    api_token = os.environ.get("NOCODB_API_TOKEN")
    base_id = os.environ.get("NOCODB_BASE_ID")

    if not all([base_url, api_token, base_id]):
        print("ERROR: Missing environment variables.")
        print("Required: NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_BASE_ID")
        print("Copy .env.example to .env and fill in your values.")
        sys.exit(1)

    # Open the .numbers file
    numbers_file = "stocks-v2.numbers"
    print(f"Reading {numbers_file}...")
    try:
        doc = Document(numbers_file)
    except FileNotFoundError:
        print(f"ERROR: {numbers_file} not found.")
        print("Run this script from the project root: python scripts/migrate.py")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to open {numbers_file}: {e}")
        print("Ensure numbers-parser is installed: pip install numbers-parser")
        print("Ensure snappy is installed: brew install snappy (macOS)")
        sys.exit(1)

    # Create NocoDB client
    client = NocoDBClient(
        base_url=base_url,
        api_token=api_token,
        base_id=base_id,
    )

    # --clean flag: delete all existing records before importing
    clean_mode = "--clean" in sys.argv
    if clean_mode:
        print("\n--clean flag detected: will clear all existing records first.")

    # Step 1: Ensure all 8 tables exist (idempotent)
    print("\n=== Step 1: Ensure tables exist ===")
    table_ids = client.ensure_tables(TABLE_SCHEMAS)

    # If --clean, delete all records from all tables
    if clean_mode:
        print("\n=== Cleaning existing records ===")
        for name, tid in table_ids.items():
            deleted = client.delete_all_records(tid)
            if deleted > 0:
                print(f"  Deleted {deleted} records from '{name}'")
    else:
        # Check if tables already have records (skip if populated)
        print("\n  Checking for existing records...")
        has_data = False
        for name, tid in table_ids.items():
            resp = client.get_records(tid, {"limit": 1})
            count = resp.get("pageInfo", {}).get("totalRows", 0)
            if count > 0:
                print(f"  WARNING: Table '{name}' already has {count} records.")
                has_data = True
        if has_data:
            print("\n  Tables already have data. Run with --clean to re-import.")
            print("  Continuing will ADD to existing data (may create duplicates).")
            print("  Press Ctrl+C to abort, or wait 3 seconds to continue...")
            import time

            time.sleep(3)

    # -----------------------------------------------------------------------
    # Step 2: Extract symbols with sector/strategy (DATA-05)
    # -----------------------------------------------------------------------
    print("\n=== Step 2: Extract symbols ===")

    # Build sector/strategy mapping from Table 1 in Portfolio sheet
    sector_map = {}  # symbol -> sector
    strategy_map = {}  # symbol -> strategy
    name_map = {}  # symbol -> company name
    try:
        t1 = doc.sheets["Portfolio"].tables["Table 1"]
        t1_rows = t1.rows(values_only=True)
        # Header: Company Name[0], Symbol[1], Sector[2], Strategy[3], ...
        for row in t1_rows[1:]:
            symbol = row[1]
            if symbol is not None:
                sym = str(symbol).strip().upper()
                if row[2] is not None:
                    sector_map[sym] = str(row[2]).strip()
                if row[3] is not None:
                    strategy_map[sym] = str(row[3]).strip()
                if row[0] is not None:
                    name_map[sym] = str(row[0]).strip()
    except (KeyError, IndexError) as e:
        print(f"  Warning: Could not read Table 1 for sectors: {e}")

    # Collect unique symbols from transactions
    tx_table = doc.sheets["Transactions"].tables["Transactions"]
    tx_rows = tx_table.rows(values_only=True)
    unique_symbols = {}  # symbol -> name
    for row in tx_rows[1:]:
        if row[0] is None or str(row[0]).strip() == "":
            continue
        sym = str(row[0]).strip().upper()
        if sym not in unique_symbols:
            name = str(row[1]).strip() if row[1] else name_map.get(sym, "")
            unique_symbols[sym] = name

    # Also add symbols from options that may not appear in transactions
    try:
        wheel_table = doc.sheets["Options"].tables["Options Wheel Strategy"]
        for row in wheel_table.rows(values_only=True)[1:]:
            if row[0] is not None:
                sym = str(row[0]).strip().upper()
                if sym not in unique_symbols:
                    unique_symbols[sym] = name_map.get(sym, "")
    except (KeyError, IndexError):
        pass

    try:
        leaps_table = doc.sheets["Options"].tables["Options LEAPS"]
        for row in leaps_table.rows(values_only=True)[1:]:
            if row[0] is not None:
                sym = str(row[0]).strip().upper()
                if sym not in unique_symbols:
                    unique_symbols[sym] = name_map.get(sym, "")
    except (KeyError, IndexError):
        pass

    # Build symbol records
    symbol_records = []
    for sym, name in sorted(unique_symbols.items()):
        record = {
            "symbol": sym,
            "name": name or name_map.get(sym, ""),
            "sector": sector_map.get(sym),
            "strategy": strategy_map.get(sym),
        }
        symbol_records.append(record)

    print(f"  Found {len(symbol_records)} unique symbols")
    client.bulk_insert(table_ids["symbols"], symbol_records)

    # -----------------------------------------------------------------------
    # Step 3: Import transactions (DATA-01)
    # -----------------------------------------------------------------------
    print("\n=== Step 3: Import transactions ===")
    # Header: Symbol[0], Name[1], Price[2], Shares[3], EPS[4], Date[5],
    #         Platform[6], Amount[7]

    transactions = []
    for row in tx_rows[1:]:
        if row[0] is None or str(row[0]).strip() == "":
            continue

        shares_raw = safe_float(row[3], 0)
        tx_type = "Sell" if shares_raw < 0 else "Buy"

        record = {
            "symbol": str(row[0]).strip().upper(),
            "name": str(row[1]).strip() if row[1] else "",
            "type": tx_type,
            "price": safe_float(row[2], 0),
            "shares": abs(shares_raw),
            "amount": safe_float(row[7], 0),
            "eps": safe_float(row[4]),
            "date": format_date(row[5]),
            "platform": normalise_platform(row[6]),
        }
        transactions.append(record)

    print(f"  Extracted {len(transactions)} transactions")
    client.bulk_insert(table_ids["transactions"], transactions)

    # -----------------------------------------------------------------------
    # Step 4: Import deposits - unpivot (DATA-03)
    # -----------------------------------------------------------------------
    print("\n=== Step 4: Import deposits (unpivot) ===")

    deposit_table = doc.sheets["Transactions"].tables["Deposited"]
    dep_rows = deposit_table.rows(values_only=True)

    deposits = []
    deposit_months = 0
    for row in dep_rows[1:]:  # Skip header
        month = format_date(row[0])
        if month is None:
            continue
        deposit_months += 1
        for platform_raw, col_idx in DEPOSIT_COL_MAP.items():
            amount = safe_float(row[col_idx])
            if amount is not None and amount != 0:
                deposits.append(
                    {
                        "month": month,
                        "amount": amount,
                        "platform": normalise_platform(platform_raw),
                    }
                )

    print(f"  Extracted {len(deposits)} deposit records from {deposit_months} months")
    client.bulk_insert(table_ids["deposits"], deposits)

    # -----------------------------------------------------------------------
    # Step 5: Import options - Wheel (DATA-06)
    # -----------------------------------------------------------------------
    print("\n=== Step 5: Import options (Wheel) ===")

    wheel_table = doc.sheets["Options"].tables["Options Wheel Strategy"]
    wheel_rows = wheel_table.rows(values_only=True)
    wheel_header = build_header_map(wheel_rows[0])

    wheel_records = []
    for row in wheel_rows[1:]:
        ticker = get_col(row, wheel_header, "ticker")
        if ticker is None or str(ticker).strip() == "":
            continue

        record = {
            "ticker": str(ticker).strip().upper(),
            "opened": format_date(get_col(row, wheel_header, "opened")),
            "strategy_type": "Wheel",
            "call_put": str(get_col(row, wheel_header, "c / p", "c/p", default="")).strip() or None,
            "buy_sell": str(get_col(row, wheel_header, "buy/sell", default="")).strip() or None,
            "expiration": format_date(get_col(row, wheel_header, "expiration")),
            "strike": safe_float(get_col(row, wheel_header, "strike")),
            "delta": safe_float(get_col(row, wheel_header, "greeks (delta)")),
            "iv_pct": safe_float(get_col(row, wheel_header, "greeks (iv%)")),
            "moneyness": normalise_moneyness(get_col(row, wheel_header, "moneyness")),
            "qty": safe_int(get_col(row, wheel_header, "qty")),
            "premium": safe_float(get_col(row, wheel_header, "premium")),
            "collateral": safe_float(get_col(row, wheel_header, "collateral")),
            "status": str(get_col(row, wheel_header, "status", default="")).strip() or None,
            "close_date": format_date(get_col(row, wheel_header, "date closed")),
            "close_premium": safe_float(get_col(row, wheel_header, "closing cost")),
            "profit": safe_float(get_col(row, wheel_header, "profit")),
            "days_held": timedelta_to_days(get_col(row, wheel_header, "days held")),
            "return_pct": safe_float(get_col(row, wheel_header, "return")),
            "annualised_return_pct": None,  # Not directly in Wheel table
            "notes": str(get_col(row, wheel_header, "notes", default="")).strip() or None,
        }
        wheel_records.append(record)

    print(f"  Extracted {len(wheel_records)} Wheel option records")

    # -----------------------------------------------------------------------
    # Step 6: Import options - LEAPS (DATA-06)
    # -----------------------------------------------------------------------
    print("\n=== Step 6: Import options (LEAPS) ===")

    leaps_table = doc.sheets["Options"].tables["Options LEAPS"]
    leaps_rows = leaps_table.rows(values_only=True)
    leaps_header = build_header_map(leaps_rows[0])

    leaps_records = []
    for row in leaps_rows[1:]:
        ticker = get_col(row, leaps_header, "ticker")
        if ticker is None or str(ticker).strip() == "":
            continue

        record = {
            "ticker": str(ticker).strip().upper(),
            "opened": format_date(get_col(row, leaps_header, "opened")),
            "strategy_type": "LEAPS",
            "call_put": str(get_col(row, leaps_header, "c / p", "c/p", default="")).strip() or None,
            "buy_sell": str(get_col(row, leaps_header, "buy/sell", default="")).strip() or None,
            "expiration": format_date(get_col(row, leaps_header, "expiration")),
            "strike": safe_float(get_col(row, leaps_header, "strike")),
            "delta": safe_float(get_col(row, leaps_header, "greeks (delta)")),
            "iv_pct": safe_float(get_col(row, leaps_header, "greeks (iv%)")),
            "moneyness": normalise_moneyness(get_col(row, leaps_header, "moneyness")),
            "qty": safe_int(get_col(row, leaps_header, "qty")),
            "premium": safe_float(get_col(row, leaps_header, "premium")),
            "collateral": None,  # LEAPS don't have collateral column
            "status": str(get_col(row, leaps_header, "status", default="")).strip() or None,
            "close_date": format_date(get_col(row, leaps_header, "date closed")),
            "close_premium": safe_float(get_col(row, leaps_header, "closing cost")),
            "profit": safe_float(get_col(row, leaps_header, "profit")),
            "days_held": timedelta_to_days(get_col(row, leaps_header, "days held")),
            "return_pct": safe_float(get_col(row, leaps_header, "profit yield")),
            "annualised_return_pct": None,
            "notes": None,  # LEAPS table has no notes column
        }
        leaps_records.append(record)

    print(f"  Extracted {len(leaps_records)} LEAPS option records")

    # Combine and insert all options
    all_options = wheel_records + leaps_records
    print(f"  Total options: {len(all_options)}")
    client.bulk_insert(table_ids["options"], all_options)

    # -----------------------------------------------------------------------
    # Step 7: Import monthly snapshots
    # -----------------------------------------------------------------------
    print("\n=== Step 7: Import monthly snapshots ===")

    # Note: table name in spreadsheet is "Montly Tracker" (typo in original)
    mt_table = doc.sheets["Transactions"].tables["Montly Tracker"]
    mt_rows = mt_table.rows(values_only=True)
    # Header: Month[0], None[1], Invested so far[2], Portfolio Value[3],
    #         Gain/Loss[4], Dividend[5], Options Capital[6], Premium[7],
    #         Options return[8], Total Earnings (EPS)[9], Earnings Yield[10]

    snapshots = []
    for row in mt_rows[1:]:
        month = format_date(row[0])
        if month is None:
            continue  # Skip summary rows

        # Calculate gain/loss percentage from gain/loss and portfolio value
        invested = safe_float(row[2], 0)
        portfolio_value = safe_float(row[3], 0)
        gain_loss = safe_float(row[4], 0)
        gain_loss_pct = (gain_loss / invested * 100) if invested else 0

        record = {
            "month": month,
            "total_invested": invested,
            "portfolio_value": portfolio_value,
            "gain_loss": gain_loss,
            "gain_loss_pct": round(gain_loss_pct, 4),
            "dividend_income": safe_float(row[5], 0),
            "options_premium": safe_float(row[7], 0),
            "options_capital_gains": safe_float(row[6], 0),
            "total_deposits": invested,  # Invested so far = cumulative deposits
        }
        snapshots.append(record)

    print(f"  Extracted {len(snapshots)} monthly snapshots")
    client.bulk_insert(table_ids["monthly_snapshots"], snapshots)

    # -----------------------------------------------------------------------
    # Step 8: Seed settings table
    # -----------------------------------------------------------------------
    print("\n=== Step 8: Seed settings ===")

    settings = [
        {
            "key": "dividend_income_goal",
            "value": "5000",
            "description": "Annual dividend income target in GBP",
        },
        {
            "key": "salary",
            "value": "45000",
            "description": "Annual salary for UK tax calculations",
        },
        {
            "key": "tax_year",
            "value": "2024-25",
            "description": "Current tax year",
        },
        {
            "key": "default_currency",
            "value": "GBP",
            "description": "Display currency",
        },
    ]
    client.bulk_insert(table_ids["settings"], settings)
    print(f"  Inserted {len(settings)} settings")

    # -----------------------------------------------------------------------
    # Step 9: Print summary (DATA-07)
    # -----------------------------------------------------------------------
    print("\n" + "=" * 50)
    print("=== Migration Summary ===")
    print("=" * 50)
    print(f"Symbols:           {len(symbol_records):>6}")
    print(f"Transactions:      {len(transactions):>6}  (expected: ~963)")
    print(f"Options (Wheel):   {len(wheel_records):>6}  (expected: ~163)")
    print(f"Options (LEAPS):   {len(leaps_records):>6}  (expected: ~35)")
    print(f"Options (Total):   {len(all_options):>6}  (expected: ~198)")
    print(f"Deposits:          {len(deposits):>6}  (from {deposit_months} months)")
    print(f"Monthly Snapshots: {len(snapshots):>6}  (expected: ~85)")
    print(f"Settings:          {len(settings):>6}")
    print()
    print("Table IDs for dashboard/.env.local:")
    print(f"NOCODB_TABLE_SYMBOLS={table_ids['symbols']}")
    print(f"NOCODB_TABLE_TRANSACTIONS={table_ids['transactions']}")
    print(f"NOCODB_TABLE_OPTIONS={table_ids['options']}")
    print(f"NOCODB_TABLE_DEPOSITS={table_ids['deposits']}")
    print(f"NOCODB_TABLE_DIVIDENDS={table_ids['dividends']}")
    print(f"NOCODB_TABLE_SNAPSHOTS={table_ids['monthly_snapshots']}")
    print(f"NOCODB_TABLE_PRICE_HISTORY={table_ids['price_history']}")
    print(f"NOCODB_TABLE_SETTINGS={table_ids['settings']}")
    print()
    print("Migration complete.")


if __name__ == "__main__":
    try:
        migrate()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
    except ImportError as e:
        if "numbers_parser" in str(e):
            print("ERROR: numbers-parser not installed.")
            print("Run: pip install -r scripts/requirements.txt")
            print("Also ensure snappy is installed: brew install snappy (macOS)")
        else:
            print(f"ERROR: Import failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: Migration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
