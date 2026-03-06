from __future__ import annotations

import io
import unittest

from optidev import cli


class CliUnitTests(unittest.TestCase):
    def test_usage_when_no_args(self) -> None:
        out = io.StringIO()
        err = io.StringIO()

        code = cli.run([], out=out, err=err)

        self.assertEqual(code, 2)
        self.assertIn("Usage:", err.getvalue())

    def test_unknown_flag_returns_usage(self) -> None:
        out = io.StringIO()
        err = io.StringIO()

        code = cli.run(["--bad"], out=out, err=err)

        self.assertEqual(code, 2)
        self.assertIn("Usage:", err.getvalue())


if __name__ == "__main__":
    unittest.main()
