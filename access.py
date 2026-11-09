"""Server-side access rules for ERIS model connections."""

from __future__ import annotations

import hmac
import os
from dataclasses import dataclass
from datetime import date, datetime, timezone
from threading import Lock
from typing import Mapping


DEFAULT_MODEL = "deepseek-flash"
DEFAULT_TEST_DAILY_LIMIT = 100
DEFAULT_TEST_SESSION_LIMIT = 20


@dataclass(frozen=True)
class TestAccountConfig:
    username: str
    passphrase: str
    api_key: str
    model: str
    daily_limit: int
    session_limit: int


def _positive_int(value: str | None, default: int) -> int:
    try:
        parsed = int(value or "")
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def load_test_account(env: Mapping[str, str] | None = None) -> TestAccountConfig | None:
    """Read the shared test account and owner API key from server environment only."""
    values = os.environ if env is None else env
    username = values.get("ERIS_TEST_USERNAME", "").strip()
    passphrase = values.get("ERIS_TEST_PASSPHRASE", "")
    api_key = values.get("DEEPSEEK_API_KEY", "").strip()
    if not username or not passphrase or not api_key:
        return None
    return TestAccountConfig(
        username=username,
        passphrase=passphrase,
        api_key=api_key,
        model=values.get("DEEPSEEK_MODEL", "").strip() or DEFAULT_MODEL,
        daily_limit=_positive_int(values.get("ERIS_TEST_DAILY_LIMIT"), DEFAULT_TEST_DAILY_LIMIT),
        session_limit=_positive_int(
            values.get("ERIS_TEST_SESSION_LIMIT"), DEFAULT_TEST_SESSION_LIMIT
        ),
    )


def valid_test_login(username: str, passphrase: str, config: TestAccountConfig) -> bool:
    """Compare UTF-8 credentials without exposing expected values to browser state."""
    username_ok = hmac.compare_digest(username.strip().encode(), config.username.encode())
    passphrase_ok = hmac.compare_digest(passphrase.encode(), config.passphrase.encode())
    return username_ok and passphrase_ok


class DailyTestBudget:
    """Process-local cap on owner-key requests; a restart resets the count."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._day: date | None = None
        self._used = 0

    def _current_day(self, day: date | None) -> date:
        return day or datetime.now(timezone.utc).date()

    def _refresh(self, day: date) -> None:
        if self._day != day:
            self._day = day
            self._used = 0

    def remaining(self, limit: int, day: date | None = None) -> int:
        with self._lock:
            self._refresh(self._current_day(day))
            return max(0, limit - self._used)

    def reserve(self, limit: int, day: date | None = None) -> bool:
        """Reserve one request before calling the model, including failed requests."""
        with self._lock:
            self._refresh(self._current_day(day))
            if limit <= 0 or self._used >= limit:
                return False
            self._used += 1
            return True
