from __future__ import annotations

from .base import Multiplexer
from .zellij import ZellijMultiplexer


def create_multiplexer(backend: str) -> Multiplexer:
    if backend == "zellij":
        return ZellijMultiplexer()
    raise ValueError(f"unsupported multiplexer backend: {backend}")
