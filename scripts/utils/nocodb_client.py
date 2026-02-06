"""NocoDB REST API client wrapper for Python migration scripts.

Provides table creation (idempotent), bulk record insertion in batches,
record fetching with pagination, and record deletion for re-runs.
"""

import math
import requests
from typing import Any


class NocoDBClient:
    """Wrapper around NocoDB v2 REST API."""

    def __init__(self, base_url: str, api_token: str, base_id: str):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.base_id = base_id
        self.headers = {
            "xc-token": api_token,
            "Content-Type": "application/json",
        }

    def list_tables(self) -> list[dict]:
        """List all tables in the base."""
        resp = requests.get(
            f"{self.base_url}/api/v2/meta/bases/{self.base_id}/tables",
            headers=self.headers,
        )
        resp.raise_for_status()
        return resp.json().get("list", [])

    def create_table(self, table_def: dict) -> dict:
        """Create a table with columns."""
        resp = requests.post(
            f"{self.base_url}/api/v2/meta/bases/{self.base_id}/tables",
            headers=self.headers,
            json=table_def,
        )
        resp.raise_for_status()
        return resp.json()

    def ensure_tables(self, schemas: dict[str, dict]) -> dict[str, str]:
        """Create tables if they don't exist. Return name -> table_id mapping.

        This makes table creation idempotent: safe to call multiple times
        without creating duplicate tables.
        """
        existing = {t["title"]: t["id"] for t in self.list_tables()}
        table_ids = {}
        for name, schema in schemas.items():
            if name in existing:
                table_ids[name] = existing[name]
                print(f"  Table '{name}' already exists (id: {existing[name]})")
            else:
                result = self.create_table(schema)
                table_ids[name] = result["id"]
                print(f"  Created table '{name}' (id: {result['id']})")
        return table_ids

    def bulk_insert(
        self, table_id: str, records: list[dict], batch_size: int = 100
    ) -> int:
        """Insert records in batches. Returns total inserted count."""
        if not records:
            return 0
        total = 0
        total_batches = math.ceil(len(records) / batch_size)
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            resp = requests.post(
                f"{self.base_url}/api/v2/tables/{table_id}/records",
                headers=self.headers,
                json=batch,
            )
            resp.raise_for_status()
            total += len(batch)
            print(
                f"  Inserted {batch_num}/{total_batches} ({total} records)"
            )
        return total

    def get_records(
        self, table_id: str, params: dict[str, Any] | None = None
    ) -> dict:
        """Get a page of records with optional filtering/sorting/pagination."""
        resp = requests.get(
            f"{self.base_url}/api/v2/tables/{table_id}/records",
            headers=self.headers,
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()

    def delete_all_records(self, table_id: str) -> int:
        """Delete all records from a table. Used for re-running migration.

        Fetches all record IDs with pagination, then deletes in batches.
        Returns total deleted count.
        """
        total_deleted = 0
        page_size = 200

        while True:
            # Fetch a page of records to get their IDs
            resp = requests.get(
                f"{self.base_url}/api/v2/tables/{table_id}/records",
                headers=self.headers,
                params={"limit": page_size, "fields": "Id"},
            )
            resp.raise_for_status()
            data = resp.json()
            records = data.get("list", [])

            if not records:
                break

            # Delete in batches of 100
            ids_to_delete = [{"Id": r["Id"]} for r in records]
            for i in range(0, len(ids_to_delete), 100):
                batch = ids_to_delete[i : i + 100]
                del_resp = requests.delete(
                    f"{self.base_url}/api/v2/tables/{table_id}/records",
                    headers=self.headers,
                    json=batch,
                )
                del_resp.raise_for_status()
                total_deleted += len(batch)

        return total_deleted
