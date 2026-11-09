"""Smoke tests for the two Streamlit connection paths without live API calls."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from streamlit.testing.v1 import AppTest


APP_FILE = Path(__file__).resolve().parents[1] / "app.py"


class ConnectionUiTests(unittest.TestCase):
    def test_test_account_requires_correct_phrase(self) -> None:
        with patch.dict(
            os.environ,
            {
                "ERIS_TEST_USERNAME": "tester",
                "ERIS_TEST_PASSPHRASE": "暗号",
                "DEEPSEEK_API_KEY": "sk-fake-owner",
                "DEEPSEEK_MODEL": "deepseek-v4-pro",
            },
        ):
            page = AppTest.from_file(str(APP_FILE)).run()
            self.assertFalse(page.exception)
            self.assertTrue(page.chat_input[0].disabled)

            page.sidebar.text_input[0].input("tester")
            page.sidebar.text_input[1].input("wrong")
            page.sidebar.button[0].click().run()
            self.assertFalse(page.exception)
            self.assertTrue(page.chat_input[0].disabled)

            page.sidebar.text_input[0].input("tester")
            page.sidebar.text_input[1].input("暗号")
            page.sidebar.button[0].click().run()
            self.assertFalse(page.exception)
            self.assertTrue(page.session_state.test_authenticated)
            self.assertFalse(page.chat_input[0].disabled)

            with patch("openai.OpenAI") as client:
                client.return_value.responses.create.return_value.output_text = "测试回复"
                page.chat_input[0].set_value("你好").run()
                self.assertFalse(page.exception)
                self.assertEqual(client.call_args.kwargs["api_key"], "sk-fake-owner")
                self.assertEqual(
                    str(client.call_args.kwargs["base_url"]), "https://api.deepseek.com"
                )
                self.assertEqual(
                    client.return_value.responses.create.call_args.kwargs["model"],
                    "deepseek-v4-pro",
                )
                self.assertEqual(
                    client.return_value.responses.create.call_args.kwargs["reasoning"],
                    {"effort": "none"},
                )

    def test_own_api_can_be_entered_and_cleared(self) -> None:
        page = AppTest.from_file(str(APP_FILE)).run()
        page.sidebar.radio[0].set_value("自行配置 API").run()
        self.assertFalse(page.exception)
        self.assertTrue(page.chat_input[0].disabled)

        page.sidebar.text_input[0].input("sk-fake-user").run()
        self.assertFalse(page.exception)
        self.assertFalse(page.chat_input[0].disabled)

        with patch("openai.OpenAI") as client:
            client.return_value.responses.create.return_value.output_text = "自带回复"
            page.chat_input[0].set_value("你好").run()
            self.assertFalse(page.exception)
            self.assertEqual(client.call_args.kwargs["api_key"], "sk-fake-user")
            self.assertEqual(str(client.call_args.kwargs["base_url"]), "https://api.deepseek.com")
            self.assertEqual(
                client.return_value.responses.create.call_args.kwargs["model"], "deepseek-flash"
            )
            self.assertEqual(
                client.return_value.responses.create.call_args.kwargs["reasoning"],
                {"effort": "none"},
            )

        page.sidebar.button[0].click().run()
        self.assertFalse(page.exception)
        self.assertTrue(page.chat_input[0].disabled)
        self.assertEqual(page.session_state.user_api_key, "")


if __name__ == "__main__":
    unittest.main()
