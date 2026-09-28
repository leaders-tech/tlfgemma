"""Track authenticated sockets. Edit for event delivery; copy for another small socket hub."""

import asyncio


class WebSocketHub:
    def __init__(self):
        self.connections = {}

    def add(self, user_id, token, ws):
        self.connections[ws] = (user_id, token)

    def remove(self, ws):
        self.connections.pop(ws, None)

    async def send_to_user(self, user_id, message):
        for ws, (owner, _) in list(self.connections.items()):
            if owner == user_id:
                try:
                    await asyncio.wait_for(ws.send_json(message), 2)
                except ConnectionError, RuntimeError, TimeoutError:
                    self.remove(ws)

    async def broadcast(self, message):
        for user_id in {owner for owner, _ in self.connections.values()}:
            await self.send_to_user(user_id, message)

    async def close_session(self, token):
        for ws, (_, session) in list(self.connections.items()):
            if session == token:
                self.remove(ws)
                await ws.close(code=1008, message=b"Session ended")

    async def close(self):
        for ws in list(self.connections):
            await ws.close(code=1001, message=b"Server stopping")
