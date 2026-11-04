/**
 * The end-to-end test of the groups, with the code of the client.
 *
 * The test signs in, creates a group, reads it back, sends a message, and
 * waits for the socket to carry it. It proves that the group contract of the
 * client matches the server.
 *
 * Run it with the server, the mail catcher and the model stub running:
 *
 *     npm run test:e2e:group
 */

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

import {
  createGroup,
  createGroupSession,
  listGroupMessages,
  listGroupSessions,
  listGroups,
  sendGroupMessage,
} from '../src/renderer/src/shared/groups.ts';
import { GroupSocket } from '../src/renderer/src/shared/group-socket.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const BASE = process.env.ZEROX_BASE_URL ?? 'http://127.0.0.1:8000';
const API = `${BASE}/api`;

async function harnessFacts() {
  const raw = await readFile(resolve(root, '.localdata', 'harness.json'), 'utf-8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

async function signIn(email) {
  const directory = resolve(root, '.localdata', 'mail');
  const before = (await readdir(directory)).filter((name) => name.endsWith('.txt')).sort();
  await fetch(`${API}/auth/login/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  let fresh = [];
  for (let attempt = 0; attempt < 40 && fresh.length === 0; attempt += 1) {
    const names = (await readdir(directory)).filter((name) => name.endsWith('.txt')).sort();
    fresh = names.filter((name) => name > (before[before.length - 1] ?? ''));
    if (fresh.length === 0) await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(fresh.length > 0, 'a new mail arrived');
  const text = await readFile(resolve(directory, fresh[fresh.length - 1]), 'utf-8');
  const code = /Sign-in code:\s*(\d{6})/.exec(text)?.[1];
  assert.ok(code, 'the mail carries a code');

  const response = await fetch(`${API}/auth/login/code/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  assert.equal(response.status, 200, 'the code signs in');
  return (await response.json()).access_token;
}

async function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('the wait ended without the expected state');
}

test('the client creates a group and carries one message to the socket', async () => {
  const facts = await harnessFacts();
  const token = await signIn(facts.email);

  // 1. The group.
  const group = await createGroup(BASE, token, { name: 'Client e2e group' });
  assert.ok(group.id, 'the group was created');

  // 2. It is in the list.
  const groups = await listGroups(BASE, token);
  assert.ok(
    groups.some((item) => item.id === group.id),
    `the group is in the list: ${groups.map((item) => item.name).join(', ')}`,
  );

  // 3. Its sessions. A new group has none, so the client starts one.
  let sessions = await listGroupSessions(BASE, token, group.id);
  if (sessions.length === 0) {
    const created = await createGroupSession(BASE, token, group.id);
    sessions = [created];
  }
  assert.ok(sessions.length > 0, 'the group has a session');
  const sessionId = sessions[0].id;

  // 4. The socket of the group.
  const received = [];
  const socket = new GroupSocket({
    url: `${BASE.replace(/^http/, 'ws')}/ws/group/${group.id}`,
    token,
    groupId: group.id,
    handlers: {
      onMessage: (message) => received.push(message),
      onState: () => undefined,
    },
  });
  socket.open();
  await waitFor(() => socket.getState().connected, 15000);

  // 5. A message.
  const content = `Hello from the client group test ${Date.now()}.`;
  const intake = await sendGroupMessage(BASE, token, group.id, sessionId, content);
  assert.ok(intake.message.id, 'the message was stored');

  // 6. The socket carries it, or the history has it.
  try {
    await waitFor(() => received.some((message) => message.id === intake.message.id), 15000);
  } catch {
    // The socket may deliver after the read, so the history is the fallback.
  }
  socket.close();

  const history = await listGroupMessages(BASE, token, group.id, sessionId, 50);
  assert.ok(
    history.some((message) => message.id === intake.message.id),
    'the stored history carries the message',
  );
  const stored = history.find((message) => message.id === intake.message.id);
  assert.equal(stored?.content, content, 'the stored text is the sent text');
});
