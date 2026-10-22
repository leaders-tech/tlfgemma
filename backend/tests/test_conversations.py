"""Test owned conversations and shared limits. Edit for conversation rules; copy for other owned resources."""
from uuid import uuid4
import pytest
from backend.tests.test_notes import finish


async def create(client, headers):
    response = await client.post('/api/conversations/create', headers=headers, json={})
    assert response.status == 200
    return (await response.json())['data']['conversation']['id']


async def send(client, headers, chat, text='hello', request_id=None):
    return await client.post('/api/chat/send', headers=headers, json={'conversation_id': chat, 'text': text, 'request_id': request_id or str(uuid4())})


async def test_separate_history_shared_quota_and_busy(client, identity, app, provider):
    user, headers = await identity()
    first, second = await create(client, headers), await create(client, headers)
    assert (await send(client, headers, first, 'slow')).status == 202
    assert (await send(client, headers, second)).status == 409
    assert (await app['store'].quota(user['id']))['active']
    await finish(app)
    assert (await send(client, headers, second, 'second')).status == 202
    await finish(app)
    for chat, prompt in [(first, 'slow'), (second, 'second')]:
        history = await client.post('/api/chat/history', headers=headers, json={'conversation_id': chat})
        assert [row['prompt'] for row in (await history.json())['data']['messages']] == [prompt]
    assert (await app['store'].quota(user['id']))['remaining'] == 58
    assert provider.requests[-1]['messages'] == [{'role': 'user', 'content': 'second'}]


async def test_archive_access_and_idempotency(client, identity, app):
    user, headers = await identity()
    _, other = await identity('other@example.org')
    _, teacher = await identity('teacher@example.org', ['teacher'])
    first, second = await create(client, headers), await create(client, headers)
    attempt = str(uuid4())
    await send(client, headers, first, request_id=attempt)
    await finish(app)
    assert (await send(client, headers, second, request_id=attempt)).status == 409
    for outsider in [other, teacher]:
        assert (await send(client, outsider, first)).status == 404
        assert (await client.post('/api/conversations/archive', headers=outsider, json={'conversation_id': first, 'archived': True})).status == 404
    assert (await client.post('/api/conversations/list', headers=other, json={'user_id': user['id']})).status == 403
    assert (await client.post('/api/chat/history', headers=other, json={'conversation_id': first})).status == 404
    await client.post('/api/conversations/archive', headers=headers, json={'conversation_id': first, 'archived': True})
    assert (await send(client, headers, first)).status == 409
    assert (await send(client, headers, first, request_id=attempt)).status == 200
    response = await client.post('/api/conversations/list', headers=teacher, json={'user_id': user['id']})
    assert any(c['archived'] for c in (await response.json())['data']['conversations'])
    response = await client.post('/api/chat/history', headers=teacher, json={'user_id': user['id'], 'conversation_id': first})
    assert len((await response.json())['data']['messages']) == 1
    await client.post('/api/conversations/archive', headers=headers, json={'conversation_id': first, 'archived': False})
    assert (await send(client, headers, first)).status == 202
    await finish(app)
    assert (await app['store'].quota(user['id']))['remaining'] == 58
    await app['store'].clear()
    assert await app['store'].conversations(user['id']) == []


@pytest.mark.parametrize('value', [0, -1, True, '1'])
async def test_invalid_conversation_id(client, identity, value):
    _, headers = await identity()
    assert (await send(client, headers, value)).status == 400


def test_migration_keeps_existing_messages(tmp_path):
    import shutil
    import sqlite3
    from pathlib import Path
    from backend.db.migrations import run_migrations
    schema = Path('backend/db/schema')
    old = tmp_path / 'old'
    old.mkdir()
    for name in ['001_gemma.py', '002_model_settings.py']:
        shutil.copy(schema / name, old / name)
    db = tmp_path / 'history.sqlite3'
    run_migrations(db, old)
    with sqlite3.connect(db) as connection:
        connection.execute("INSERT INTO users(subject,email,roles,created_at) VALUES ('old','old@example.org','[]','2026-01-01')")
        connection.execute("INSERT INTO exchanges(user_id,request_id,prompt,answer,status,created_at,updated_at) VALUES (1,'old','original','answer','complete','2026-01-01','2026-01-01')")
    run_migrations(db, schema)
    run_migrations(db, schema)
    with sqlite3.connect(db) as connection:
        assert connection.execute('SELECT prompt,answer,conversation_id FROM exchanges').fetchone() == ('original', 'answer', 1)
        assert connection.execute('SELECT title,archived FROM conversations').fetchone() == ('Previous chat', 0)


async def test_new_chat_and_archive_do_not_bypass_sixty_messages(client, identity, app):
    from backend.http.json_api import AppError
    user, headers = await identity()
    first, second = await create(client, headers), await create(client, headers)
    for index in range(60):
        row, _ = await app['store'].reserve(user['id'], str(uuid4()), 'hello', first if index % 2 else second)
        await app['store'].update(row['id'], 'answer', 'complete')
    await app['store'].archive_conversation(user['id'], first, True)
    third = await create(client, headers)
    with pytest.raises(AppError) as exc:
        await app['store'].reserve(user['id'], str(uuid4()), 'hello', third)
    assert exc.value.status == 429
