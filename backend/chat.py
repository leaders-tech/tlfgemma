"""Generate and persist bounded OpenRouter answers. Edit for model behavior; copy for another provider integration."""

import asyncio
import json
from aiohttp import ClientTimeout


async def generate(app, exchange):
    store, settings = app["store"], app["settings"]
    answer, truncated = "", False
    status, error = "complete", None

    async def save(current_status, current_error=None):
        row = await store.update(exchange["id"], answer, current_status, truncated, current_error)
        if row:
            await app["ws_hub"].send_to_user(exchange["user_id"], {"type": "chat.updated", "message": row, "quota": await store.quota(exchange["user_id"])})

    try:
        async with app["http"].post(
            settings.openrouter_url,
            headers={"Authorization": "Bearer " + settings.openrouter_api_key},
            json={
                "model": exchange["model"],
                "messages": [{"role": "user", "content": exchange["prompt"]}],
                "stream": True,
                "max_tokens": 1000,
                "reasoning": {"enabled": False},
            },
            timeout=ClientTimeout(total=120, sock_read=30),
        ) as response:
            response.raise_for_status()
            done = False
            async for raw in response.content:
                line = raw.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue
                value = line[5:].strip()
                if value == "[DONE]":
                    done = True
                    break
                data = json.loads(value)
                if data.get("error"):
                    raise ValueError("Provider error")
                choices = data.get("choices", [])
                if not choices:
                    continue
                if choices[0].get("finish_reason") == "error":
                    raise ValueError("Provider error")
                text = choices[0].get("delta", {}).get("content") or ""
                if text:
                    available = 1000 - len(answer)
                    answer += text[:available]
                    truncated = len(answer) >= 1000
                    await save("streaming")
                    if truncated:
                        done = True
                        break
                if choices[0].get("finish_reason"):
                    done = True
            if not done or not answer:
                raise ValueError("Incomplete or empty response")
    except asyncio.CancelledError:
        status, error = "interrupted", "The answer was interrupted."
        raise
    except Exception:
        status, error = "error", "The model could not finish this answer. Please try again."
    finally:
        await save(status, error)


async def stop_generations(app):
    tasks = list(app["generations"].values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    app["generations"].clear()
