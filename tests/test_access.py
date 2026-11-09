"""Tests for server-side test-account authorization and request budgets."""

from __future__ import annotations

import unittest
from datetime import date

from access import (
    DEFAULT_MODEL,
    DailyTestBudget,
    load_test_account,
    valid_test_login,
)


class TestAccountTests(unittest.TestCase):
    def test_missing_owner_secret_disables_test_entry(self) -> None:
        self.assertIsNone(load_test_account({"ERIS_TEST_USERNAME": "guest"}))
        self.assertIsNone(
            load_test_account(
                {
                    "ERIS_TEST_USERNAME": "guest",
                    "ERIS_TEST_PASSPHRASE": "secret",
                    "OPENAI_API_KEY": "legacy-key",
                }
            )
        )

    def test_credentials_and_model_are_loaded_from_server_env(self) -> None:
        config = load_test_account(
            {
                "ERIS_TEST_USERNAME": "guest",
                "ERIS_TEST_PASSPHRASE": "暗号",
                "DEEPSEEK_API_KEY": "owner-secret",
                "DEEPSEEK_MODEL": "deepseek-v4-pro",
                "ERIS_TEST_DAILY_LIMIT": "5",
                "ERIS_TEST_SESSION_LIMIT": "2",
            }
        )
        self.assertIsNotNone(config)
        assert config is not None
        self.assertTrue(valid_test_login("guest", "暗号", config))
        self.assertFalse(valid_test_login("guest", "wrong", config))
        self.assertFalse(valid_test_login("other", "暗号", config))
        self.assertEqual(config.api_key, "owner-secret")
        self.assertEqual(config.model, "deepseek-v4-pro")
        self.assertEqual(config.daily_limit, 5)
        self.assertEqual(config.session_limit, 2)

    def test_invalid_limits_fall_back_to_safe_defaults(self) -> None:
        config = load_test_account(
            {
                "ERIS_TEST_USERNAME": "guest",
                "ERIS_TEST_PASSPHRASE": "secret",
                "DEEPSEEK_API_KEY": "owner-secret",
                "ERIS_TEST_DAILY_LIMIT": "-1",
                "ERIS_TEST_SESSION_LIMIT": "not-a-number",
            }
        )
        self.assertIsNotNone(config)
        assert config is not None
        self.assertEqual(config.model, DEFAULT_MODEL)
        self.assertEqual(config.daily_limit, 100)
        self.assertEqual(config.session_limit, 20)


class DailyBudgetTests(unittest.TestCase):
    def test_budget_is_shared_and_resets_next_day(self) -> None:
        budget = DailyTestBudget()
        first_day = date(2026, 11, 5)
        second_day = date(2026, 11, 6)
        self.assertTrue(budget.reserve(2, first_day))
        self.assertTrue(budget.reserve(2, first_day))
        self.assertFalse(budget.reserve(2, first_day))
        self.assertEqual(budget.remaining(2, first_day), 0)
        self.assertEqual(budget.remaining(2, second_day), 2)
        self.assertTrue(budget.reserve(2, second_day))

    def test_zero_limit_never_allows_a_request(self) -> None:
        self.assertFalse(DailyTestBudget().reserve(0, date(2026, 11, 5)))


if __name__ == "__main__":
    unittest.main()
