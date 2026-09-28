"""Track live websocket connections per user and send messages to them.

Edit this file when websocket connection storage or fan-out behavior changes.
Copy the helper style here when you add another small websocket utility.
"""

from __future__ import annotations

from collections import defaultdict
from weakref import WeakSet

from aiohttp import web


class WebSocketHub:
    def __init__(self) -> None:
        self._connections: dict[int, WeakSet[web.WebSocketResponse]] = defaultdict(WeakSet)

    def add(self, user_id: int, ws: web.WebSocketResponse) -> None:
        self._connections[user_id].add(ws)

    def remove(self, user_id: int, ws: web.WebSocketResponse) -> None:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(ws)
        if len(sockets) == 0:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, message: dict[str, object]) -> None:
        sockets = list(self._connections.get(user_id, ()))
        for ws in sockets:
            if ws.closed:
                self.remove(user_id, ws)
                continue
            await ws.send_json(message)

    def count_for_user(self, user_id: int) -> int:
        return len(self._connections.get(user_id, ()))
