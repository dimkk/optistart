from __future__ import annotations

import unittest

from optidev.mux.factory import create_multiplexer
from optidev.mux.zellij import ZellijMultiplexer


class MuxFactoryUnitTests(unittest.TestCase):
    def test_create_zellij_backend(self) -> None:
        mux = create_multiplexer("zellij")
        self.assertIsInstance(mux, ZellijMultiplexer)

    def test_unsupported_backend(self) -> None:
        with self.assertRaises(ValueError):
            create_multiplexer("unknown")


if __name__ == "__main__":
    unittest.main()
