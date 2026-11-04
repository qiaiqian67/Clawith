/**
 * The end-to-end test of the chat, with the code of the client.
 *
 * The test signs in through the API client, opens the chat socket through the
 * socket the interface uses, sends a message, and waits for the terminal
 * packet. It proves that the contract of the client matches the server.
 *
 * Run it with the server, the mail catcher and the model stub running:
 *
 *     node --experimental-strip-types tests/e2e-chat.test.mjs
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

import { ChatSocket } from '../src/renderer/src/shared/chat-socket.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const BASE = process.env.ZEROX_BASE_URL ?? 'http://127.0.0.1:8000';
const API = `${BASE}/api`;

/** The facts of the local harness. */
async function harnessFacts() {
  const raw = await readFile(resolve(root, '.localdata', 'harness.json'), 'utf-8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

/** The sign-in code of the last mail the catcher received. */
async function latestCode(after) {
  const directory = resolve(root, '.localdata', 'mail');
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.txt')).sort();
  // The catcher names the files in order, so the new code is the one after
  // the last one the test read.
  // The mail arrives a moment after the request, so the test waits for it.
  let fresh = [];
  for (let attempt = 0; attempt < 40 && fresh.length === 0; attempt += 1) {
    const names = (await readdir(directory)).filter((name) => name.endsWith('.txt')).sort();
    fresh = names.filter((name) => name > after);
    if (fresh.length === 0) {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  assert.ok(fresh.length > 0, 'a new mail arrived');
  const last = await readFile(resolve(directory, fresh[fresh.length - 1]), 'utf-8');
  const match = /Sign-in code:\s*(\d{6})/.exec(last);
  assert.ok(match, 'the mail carries a sign-in code');
  return match[1];
}

/** The name of the last mail the catcher wrote. */
async function latestMailName() {
  const directory = resolve(root, '.localdata', 'mail');
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.txt')).sort();
  return files[files.length - 1];
}

async function signIn(email) {
  const before = await latestMailName();
  await fetch(`${API}/auth/login/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const code = await latestCode(before);
  const response = await fetch(`${API}/auth/login/code/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  assert.equal(response.status, 200, 'the code signs in');
  return (await response.json()).access_token;
}

test('the client socket carries one message to the terminal packet', async () => {
  const facts = await harnessFacts();
  const token = await signIn(facts.email);

  const headers = { Authorization: `Bearer ${token}` };
  const agents = await (await fetch(`${API}/agents/`, { headers })).json();
  const agent = agents.find((item) => item.id === facts.agent_id) ?? agents[0];
  assert.ok(agent, 'the harness has an agent');

  const sessions = await (
    await fetch(`${API}/agents/${agent.id}/sessions`, { headers })
  ).json();
  assert.ok(Array.isArray(sessions), 'the sessions are a list');

  const packets = [];
  const socket = new ChatSocket({
    url: `${BASE.replace(/^http/, 'ws')}/ws/chat/${agent.id}`,
    token,
    agentId: agent.id,
    sessionId: sessions[0]?.id ?? null,
    language: 'zh',
    handlers: {
      onPacket: (packet) => packets.push(packet),
      onState: () => undefined,
    },
  });

  socket.open();
  await waitFor(() => packets.some((packet) => packet.type === 'connected'), 20000);
  socket.sendMessage({ content: 'Hello from the client test.', displayContent: 'Hello from the client test.' });

  await waitFor(() => packets.some((packet) => packet.type === 'done'), 60000);
  socket.close();

  const types = packets.map((packet) => packet.type);
  assert.ok(types.includes('connected'), `the socket connected: ${types.join(',')}`);
  assert.ok(types.includes('chunk'), `the answer arrived: ${types.join(',')}`);

  const done = packets.find((packet) => packet.type === 'done');
  assert.equal(done.runtime_status, 'completed', `the run completed: ${JSON.stringify(done)}`);
  assert.match(done.content, /stub model/, 'the answer came from the stub model');
  assert.ok(typeof done.event_cursor === 'string' && done.event_cursor.length > 0, 'the terminal packet carries a position');
});

async function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('the wait ended without the expected state');
}
