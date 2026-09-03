"""Run CPU-bound / blocking work off the FastAPI event loop."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import ParamSpec, TypeVar

P = ParamSpec('P')
T = TypeVar('T')


async def run_sync(fn: Callable[P, T], /, *args: P.args, **kwargs: P.kwargs) -> T:
    """
    Execute a synchronous callable in a worker thread.

    Keeps FastAPI responsive while Excel parsers and audit engines run.
    Business behavior of ``fn`` is unchanged.
    """
    return await asyncio.to_thread(fn, *args, **kwargs)
