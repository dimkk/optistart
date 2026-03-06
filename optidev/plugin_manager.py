from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from types import ModuleType


class PluginManager:
    def __init__(self, plugin_dir: Path | None = None) -> None:
        if plugin_dir is None:
            env_dir = os.environ.get("OPTIDEV_PLUGIN_DIR")
            if env_dir:
                plugin_dir = Path(env_dir)
            else:
                plugin_dir = Path(__file__).resolve().parent / "plugins"
        self.plugin_dir = plugin_dir
        self.plugins: list[object] = []

    def load_plugins(self) -> list[object]:
        self.plugins = []
        if not self.plugin_dir.exists() or not self.plugin_dir.is_dir():
            return self.plugins

        candidates = sorted(
            [p for p in self.plugin_dir.iterdir() if p.suffix == ".py" and p.name != "__init__.py"],
            key=lambda p: p.name,
        )
        for path in candidates:
            module = self._load_module(path)
            plugin_cls = getattr(module, "Plugin", None)
            if plugin_cls is None:
                continue
            plugin = plugin_cls()
            if not self._is_valid_plugin(plugin):
                continue
            self.plugins.append(plugin)
        return self.plugins

    def on_workspace_start(self, context: dict[str, str]) -> None:
        self._ensure_loaded()
        for plugin in self.plugins:
            plugin.on_workspace_start(context)

    def on_agent_message(self, message: str) -> None:
        self._ensure_loaded()
        for plugin in self.plugins:
            plugin.on_agent_message(message)

    def on_workspace_stop(self, context: dict[str, str]) -> None:
        self._ensure_loaded()
        for plugin in self.plugins:
            plugin.on_workspace_stop(context)

    def _ensure_loaded(self) -> None:
        if not self.plugins:
            self.load_plugins()

    @staticmethod
    def _is_valid_plugin(plugin: object) -> bool:
        return all(
            hasattr(plugin, attr)
            for attr in ("on_workspace_start", "on_agent_message", "on_workspace_stop")
        )

    @staticmethod
    def _load_module(path: Path) -> ModuleType:
        spec = importlib.util.spec_from_file_location(f"optidev_plugin_{path.stem}", path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Unable to load plugin module: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
