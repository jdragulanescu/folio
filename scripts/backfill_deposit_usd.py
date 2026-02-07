"""
Backfill amount_usd on deposit records using historical GBP/USD rates from Tiingo.

For each deposit month, fetches the GBP/USD close rate from Tiingo's forex
historical endpoint, then computes amount_usd = amount_gbp * gbpusd_rate.

Usage:
    python scripts/backfill_deposit_usd.py          # dry run (shows what would change)
    python scripts/backfill_deposit_usd.py --apply   # actually update NocoDB

Requires NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_TABLE_DEPOSITS, TIINGO_API_TOKEN
in the .env file.
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

NOCODB_BASE_URL = os.environ["NOCODB_BASE_URL"]
NOCODB_API_TOKEN = os.environ["NOCODB_API_TOKEN"]
NOCODB_TABLE_DEPOSITS = os.environ["NOCODB_TABLE_DEPOSITS"]
TIINGO_API_TOKEN = os.environ["TIINGO_API_TOKEN"]

DRY_RUN = "--apply" not in sys.argv


# ---------------------------------------------------------------------------
# NocoDB helpers
# ---------------------------------------------------------------------------
def nocodb_fetch(path: str, method: str = "GET", body=None):
    url = f"{NOCODB_BASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "xc-token": NOCODB_API_TOKEN,
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def fetch_all_deposits():
    records = []
    offset = 0
    while True:
        data = nocodb_fetch(
            f"/api/v2/tables/{NOCODB_TABLE_DEPOSITS}/records?limit=200&offset={offset}"
        )
        records.extend(data["list"])
        if data["pageInfo"]["isLastPage"]:
            break
        offset += 200
    return records


def bulk_update(records: list[dict]):
    """Update records in batches of 50."""
    for i in range(0, len(records), 50):
        batch = records[i : i + 50]
        nocodb_fetch(
            f"/api/v2/tables/{NOCODB_TABLE_DEPOSITS}/records",
            method="PATCH",
            body=batch,
        )
        time.sleep(0.3)  # respect rate limit


# ---------------------------------------------------------------------------
# Tiingo forex helper
# ---------------------------------------------------------------------------
def fetch_all_gbpusd_rates(start: str, end: str) -> dict[str, float]:
    """Fetch full GBP/USD daily history from Tiingo in a single API call.

    Returns a dict mapping date string (YYYY-MM-DD) to close rate.
    Retries with exponential backoff on 429 rate limit errors.
    """
    url = (
        f"https://api.tiingo.com/tiingo/fx/gbpusd/prices"
        f"?startDate={start}&endDate={end}&resampleFreq=1day"
    )

    for attempt in range(5):
        req = urllib.request.Request(
            url, headers={"Authorization": f"Token {TIINGO_API_TOKEN}"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s (attempt {attempt + 1}/5)...")
                time.sleep(wait)
            else:
                raise
    else:
        raise RuntimeError("Failed after 5 retries")

    rates = {}
    for entry in data:
        date_key = entry["date"][:10]
        rates[date_key] = entry["close"]
    return rates


def lookup_rate(
    all_rates: dict[str, float], target_date: str
) -> float | None:
    """Look up rate for a date, falling back to nearest prior trading day."""
    dt = datetime.strptime(target_date[:10], "%Y-%m-%d")
    # Try the exact date, then go back up to 5 days for weekends/holidays
    for offset in range(6):
        check = (dt - timedelta(days=offset)).strftime("%Y-%m-%d")
        if check in all_rates:
            return all_rates[check]
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=== Backfill deposit amount_usd ===")
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'APPLY'}")
    print()

    # Fetch all deposits
    deposits = fetch_all_deposits()
    print(f"Total deposit records: {len(deposits)}")

    # Collect unique months
    months = sorted({d["month"][:10] for d in deposits if d.get("month")})
    print(f"Unique months: {len(months)} ({months[0]} to {months[-1]})")
    print()

    # Fetch full GBP/USD history in a single API call
    print("Fetching GBP/USD history from Tiingo (single request)...")
    start = (datetime.strptime(months[0], "%Y-%m-%d") - timedelta(days=7)).strftime(
        "%Y-%m-%d"
    )
    end = datetime.now().strftime("%Y-%m-%d")
    all_rates = fetch_all_gbpusd_rates(start, end)
    print(f"  Got {len(all_rates)} daily rates ({start} to {end})")

    # Look up rate for each deposit month
    rates: dict[str, float] = {}
    for month in months:
        rate = lookup_rate(all_rates, month)
        if rate:
            rates[month] = rate
            print(f"  {month}: GBP/USD = {rate:.6f}")
        else:
            print(f"  {month}: MISSING — will skip")

    print(f"\nRates matched: {len(rates)}/{len(months)}")
    print()

    # Compute amount_usd for each deposit
    updates = []
    for d in deposits:
        month = d.get("month", "")[:10]
        amount_gbp = d["amount"]
        rate = rates.get(month)

        if rate is None:
            print(f"  SKIP Id={d['Id']} month={month} — no rate available")
            continue

        # amount_usd = amount_gbp * gbpusd_rate
        # (gbpusd_rate = how many USD per 1 GBP, e.g. 1.36)
        amount_usd = round(amount_gbp * rate, 2)

        old_usd = d.get("amount_usd")
        if old_usd is not None and abs(old_usd - amount_usd) < 0.01:
            continue  # already correct

        updates.append({"Id": d["Id"], "amount_usd": amount_usd})
        sign = "+" if amount_gbp >= 0 else ""
        print(
            f"  Id={d['Id']:>3} {month} {d.get('platform','?'):>12} "
            f"£{sign}{amount_gbp:>10,.2f} × {rate:.4f} = ${sign}{amount_usd:>10,.2f}"
        )

    print(f"\nRecords to update: {len(updates)}")

    if DRY_RUN:
        print("\nDry run — no changes made. Use --apply to write to NocoDB.")
    elif updates:
        print("\nUpdating NocoDB...")
        bulk_update(updates)
        print("Done!")
    else:
        print("\nNo updates needed.")

    # Summary
    total_gbp = sum(d["amount"] for d in deposits)
    total_usd_new = 0
    rate_lookup = {d["Id"]: None for d in deposits}
    for u in updates:
        rate_lookup[u["Id"]] = u["amount_usd"]
    for d in deposits:
        if rate_lookup.get(d["Id"]) is not None:
            total_usd_new += rate_lookup[d["Id"]]
        elif d.get("amount_usd") is not None:
            total_usd_new += d["amount_usd"]
        else:
            month = d.get("month", "")[:10]
            r = rates.get(month, 1.36)
            total_usd_new += d["amount"] * r

    print(f"\nTotal deposits (GBP): £{total_gbp:,.2f}")
    print(f"Total deposits (USD, historical rates): ${total_usd_new:,.2f}")
    print(
        f"Old single-rate conversion (at current rate): "
        f"would vary — compare on dashboard"
    )


if __name__ == "__main__":
    main()
