from __future__ import annotations

import json
import os
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row


class PostgresDatabase:
    def __init__(self, dsn: str | None = None) -> None:
        raw_dsn = dsn or os.environ["DATABASE_URL"]
        self._dsn = self._normalize_dsn(raw_dsn)

    @contextmanager
    def connection(self) -> Iterator[psycopg.Connection]:
        with psycopg.connect(self._dsn, row_factory=dict_row) as conn:
            yield conn

    def fetch_one(self, query: str, params: tuple = ()):
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return cur.fetchone()

    def fetch_all(self, query: str, params: tuple = ()):
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                return cur.fetchall()

    def execute(self, query: str, params: tuple = ()) -> None:
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
            conn.commit()

    def execute_returning(self, query: str, params: tuple = ()):
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                row = cur.fetchone()
            conn.commit()
            return row

    @staticmethod
    def dumps(value) -> str:
        return json.dumps(value, ensure_ascii=False)

    @staticmethod
    def _normalize_dsn(dsn: str) -> str:
        parts = urlsplit(dsn)
        query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if key != "schema"]
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
