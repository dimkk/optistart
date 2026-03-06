from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.plugin_manager import PluginManager


class PluginManagerUnitTests(unittest.TestCase):
    def test_loads_only_valid_plugins(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            plugin_dir = Path(tmp)
            (plugin_dir / "valid.py").write_text(
                """
class Plugin:
    def on_workspace_start(self, context):
        pass
    def on_agent_message(self, message):
        pass
    def on_workspace_stop(self, context):
        pass
""".strip()
                + "\n",
                encoding="utf-8",
            )
            (plugin_dir / "invalid.py").write_text(
                "class Plugin:\n    pass\n",
                encoding="utf-8",
            )

            manager = PluginManager(plugin_dir=plugin_dir)
            plugins = manager.load_plugins()
            self.assertEqual(len(plugins), 1)


if __name__ == "__main__":
    unittest.main()
