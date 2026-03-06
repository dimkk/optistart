from __future__ import annotations

import os
import json
import sqlite3
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


class CliE2ESmokeTests(unittest.TestCase):
    def test_module_entrypoint_smoke(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "projects" / "sandbox").mkdir(parents=True, exist_ok=True)

            start = subprocess.run(
                ["python3", "-m", "optidev", "sandbox"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0)
            self.assertIn("OptiDev workspace ready.", start.stdout)

            status = subprocess.run(
                ["python3", "-m", "optidev", "status"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(status.returncode, 0)
            self.assertIn("Project: sandbox", status.stdout)

            stop = subprocess.run(
                ["python3", "-m", "optidev", "stop"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(stop.returncode, 0)
            self.assertIn("Stopped session", stop.stdout)

    def test_projects_command_discovery_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            root = Path(tmp) / "projects"
            (root / "alpha").mkdir(parents=True, exist_ok=True)
            (root / "beta").mkdir(parents=True, exist_ok=True)

            projects = subprocess.run(
                ["python3", "-m", "optidev", "projects"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(projects.returncode, 0)
            lines = [line.strip() for line in projects.stdout.splitlines() if line.strip()]
            self.assertEqual(lines, ["alpha", "beta"])

    def test_invalid_global_config_fails_start(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "config.yaml").write_text(
                json.dumps({"default_runner": 123}),
                encoding="utf-8",
            )
            (Path(tmp) / "projects" / "broken").mkdir(parents=True, exist_ok=True)

            proc = subprocess.run(
                ["python3", "-m", "optidev", "broken"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(proc.returncode, 1)
            self.assertIn("Config error:", proc.stderr)
            self.assertIn("default_runner", proc.stderr)

    def test_restart_restores_existing_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "projects" / "restore-me").mkdir(parents=True, exist_ok=True)

            first = subprocess.run(
                ["python3", "-m", "optidev", "restore-me"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(first.returncode, 0)
            self.assertIn("OptiDev workspace ready.", first.stdout)

            second = subprocess.run(
                ["python3", "-m", "optidev", "restore-me"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(second.returncode, 0)
            self.assertIn("Session restored.", second.stdout)

    def test_global_mux_backend_config_drives_cli_start(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "config.yaml").write_text(
                json.dumps({"mux_backend": "zellij"}),
                encoding="utf-8",
            )
            (Path(tmp) / "projects" / "muxdemo").mkdir(parents=True, exist_ok=True)

            start = subprocess.run(
                ["python3", "-m", "optidev", "muxdemo"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0)

            status = subprocess.run(
                ["python3", "-m", "optidev", "status"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(status.returncode, 0)
            self.assertIn("Mux: zellij", status.stdout)

    def test_layout_file_generated_for_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "projects" / "layoutapp").mkdir(parents=True, exist_ok=True)

            start = subprocess.run(
                ["python3", "-m", "optidev", "layoutapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0)

            layout_file = Path(tmp) / "sessions" / "layoutapp" / "layout.kdl"
            self.assertTrue(layout_file.exists())
            content = layout_file.read_text(encoding="utf-8")
            self.assertIn('pane name="planner"', content)
            self.assertIn('pane name="coder"', content)
            self.assertIn('pane name="tests"', content)
            self.assertIn('pane name="logs"', content)

    def test_runner_bootstrap_is_triggered_on_start(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "config.yaml").write_text(
                json.dumps({"default_runner": "claude"}),
                encoding="utf-8",
            )
            (Path(tmp) / "projects" / "runnerapp").mkdir(parents=True, exist_ok=True)

            start = subprocess.run(
                ["python3", "-m", "optidev", "runnerapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0)
            self.assertIn("Runner ready: claude.", start.stdout)

            runner_file = Path(tmp) / "sessions" / "runnerapp" / "runner.json"
            self.assertTrue(runner_file.exists())
            data = json.loads(runner_file.read_text(encoding="utf-8"))
            self.assertEqual(data["runner"], "claude")

    def test_resume_history_available_in_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            (Path(tmp) / "projects" / "historyapp").mkdir(parents=True, exist_ok=True)

            first = subprocess.run(
                ["python3", "-m", "optidev", "historyapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(first.returncode, 0)

            second = subprocess.run(
                ["python3", "-m", "optidev", "historyapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(second.returncode, 0)

            db_path = Path(tmp) / "memory.sqlite"
            self.assertTrue(db_path.exists())
            with sqlite3.connect(db_path) as conn:
                sessions_count = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE project = 'historyapp'"
                ).fetchone()[0]
                messages_count = conn.execute(
                    "SELECT COUNT(*) FROM messages WHERE project = 'historyapp'"
                ).fetchone()[0]
            self.assertGreaterEqual(sessions_count, 2)
            self.assertGreaterEqual(messages_count, 2)

    def test_configured_dev_hooks_run_on_start(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""

            project = Path(tmp) / "projects" / "hookapp"
            (project / ".project").mkdir(parents=True, exist_ok=True)
            (project / ".project" / "config.yaml").write_text(
                json.dumps({"dev": {"start": ["echo hook-started > .hook-started"]}}),
                encoding="utf-8",
            )

            proc = subprocess.run(
                ["python3", "-m", "optidev", "hookapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(proc.returncode, 0)
            self.assertIn("Hooks started: 1.", proc.stdout)

            marker = project / ".hook-started"
            # Hook process is started asynchronously.
            for _ in range(20):
                if marker.exists():
                    break
                time.sleep(0.05)
            self.assertTrue(marker.exists())

    def test_sample_plugin_receives_workspace_events(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            plugin_dir = Path(tmp) / "plugins"
            plugin_dir.mkdir(parents=True, exist_ok=True)
            log_path = Path(tmp) / "plugin-events.log"
            env["OPTIDEV_PLUGIN_DIR"] = str(plugin_dir)
            env["OPTIDEV_PLUGIN_LOG"] = str(log_path)

            (plugin_dir / "events.py").write_text(
                (
                    "import os\n"
                    "from pathlib import Path\n\n"
                    "class Plugin:\n"
                    "    def _emit(self, value):\n"
                    "        path = Path(os.environ['OPTIDEV_PLUGIN_LOG'])\n"
                    "        with path.open('a', encoding='utf-8') as fp:\n"
                    "            fp.write(value + '\\n')\n\n"
                    "    def on_workspace_start(self, context):\n"
                    "        self._emit('start')\n\n"
                    "    def on_agent_message(self, message):\n"
                    "        self._emit('message')\n\n"
                    "    def on_workspace_stop(self, context):\n"
                    "        self._emit('stop')\n"
                ),
                encoding="utf-8",
            )
            (Path(tmp) / "projects" / "pluginapp").mkdir(parents=True, exist_ok=True)

            start = subprocess.run(
                ["python3", "-m", "optidev", "pluginapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0, f"stdout={start.stdout}\nstderr={start.stderr}")

            stop = subprocess.run(
                ["python3", "-m", "optidev", "stop"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(stop.returncode, 0)

            lines = log_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(lines, ["start", "message", "stop"])

    def test_status_and_logs_runtime_smoke(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["OPTIDEV_HOME"] = tmp
            env["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            env["OPTIDEV_SCAN_PATHS"] = ""
            project = Path(tmp) / "projects" / "obsapp"
            (project / ".project").mkdir(parents=True, exist_ok=True)
            (project / ".project" / "config.yaml").write_text(
                json.dumps({"logs": {"sources": ["echo e2e-log"]}}),
                encoding="utf-8",
            )

            start = subprocess.run(
                ["python3", "-m", "optidev", "obsapp"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(start.returncode, 0)

            status = subprocess.run(
                ["python3", "-m", "optidev", "status"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(status.returncode, 0)
            self.assertIn("Runner:", status.stdout)
            self.assertIn("Hooks:", status.stdout)

            logs = subprocess.run(
                ["python3", "-m", "optidev", "logs"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(logs.returncode, 0)
            self.assertIn("e2e-log", logs.stdout)


if __name__ == "__main__":
    unittest.main()
