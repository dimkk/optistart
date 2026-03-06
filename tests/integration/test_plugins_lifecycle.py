from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from optidev.app import OptiDevApp
from optidev.plugin_manager import PluginManager


class PluginsLifecycleIntegrationTests(unittest.TestCase):
    def test_callbacks_are_invoked_in_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            plugin_dir = base / "plugins"
            plugin_dir.mkdir(parents=True, exist_ok=True)
            log_path = base / "plugin.log"
            os.environ["OPTIDEV_PLUGIN_LOG"] = str(log_path)
            os.environ["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            try:
                (plugin_dir / "writer.py").write_text(
                    """
import os
from pathlib import Path

class Plugin:
    def _log(self, value):
        path = Path(os.environ["OPTIDEV_PLUGIN_LOG"])
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fp:
            fp.write(value + "\\n")

    def on_workspace_start(self, context):
        self._log("start")

    def on_agent_message(self, message):
        self._log("message")

    def on_workspace_stop(self, context):
        self._log("stop")
""".strip()
                    + "\n",
                    encoding="utf-8",
                )

                (base / "projects" / "plugdemo").mkdir(parents=True, exist_ok=True)
                app = OptiDevApp(home_dir=base, plugin_manager=PluginManager(plugin_dir=plugin_dir))
                ok, _ = app.start_project("plugdemo")
                self.assertTrue(ok)
                app.stop()

                lines = log_path.read_text(encoding="utf-8").splitlines()
                self.assertEqual(lines, ["start", "message", "stop"])
            finally:
                os.environ.pop("OPTIDEV_PLUGIN_LOG", None)
                os.environ.pop("OPTIDEV_DISABLE_ZELLIJ", None)


if __name__ == "__main__":
    unittest.main()
