/**
 * The end-to-end test of the administration of one Agent, with the code of
 * the client.
 *
 * The test signs in, reads the Agent, changes its settings, reads the files of
 * its workspace, writes one file, and reads the automation. It proves that the
 * contract of the client matches the server.
 *
 * Run it with the server, the mail catcher and the model stub running:
 *
 *     npm run test:e2e:agent
 */

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

import {
  listModels,
  readAgent,
  readPermissions,
  updateAgent,
} from '../src/renderer/src/shared/agent-admin.ts';
import {
  listDirectory,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../src/renderer/src/shared/agent-files.ts';
import {
  listSchedules,
  listTriggers,
} from '../src/renderer/src/shared/agent-automation.ts';

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

test('the client reads and changes one Agent', async () => {
  const facts = await harnessFacts();
  const token = await signIn(facts.email);
  const agentId = facts.agent_id;

  // 1. The Agent.
  const agent = await readAgent(BASE, token, agentId);
  assert.equal(agent.id, agentId, 'the agent was read');
  assert.equal(typeof agent.name, 'string', 'the agent has a name');

  // 2. The models of the organization.
  const models = await listModels(BASE, token);
  assert.ok(Array.isArray(models), 'the models are a list');

  // 3. The access of the Agent.
  const access = await readPermissions(BASE, token, agentId);
  assert.ok(['company', 'private', 'custom'].includes(access.scope_type), 'the scope is known');

  // 4. A change that the server stores.
  const marker = `role ${Date.now()}`;
  const updated = await updateAgent(BASE, token, agentId, { role_description: marker });
  assert.equal(updated.role_description, marker, 'the change came back');

  // The change is in the server, not only in the answer.
  const reread = await readAgent(BASE, token, agentId);
  assert.equal(reread.role_description, marker, 'the change was stored');
});

test('the client reads and writes the files of one Agent', async () => {
  const facts = await harnessFacts();
  const token = await signIn(facts.email);
  const agentId = facts.agent_id;

  // 1. The root of the workspace.
  const entries = await listDirectory(BASE, token, agentId, '');
  assert.ok(Array.isArray(entries), 'the directory is a list');

  // 2. A file of the workspace.
  const path = 'memory/memory.md';
  const before = await readWorkspaceFile(BASE, token, agentId, path).catch(() => null);
  const marker = `\n\nClient e2e ${Date.now()}.\n`;
  await writeWorkspaceFile(BASE, token, agentId, path, (before?.content ?? '') + marker, before?.version_token ?? null);

  const after = await readWorkspaceFile(BASE, token, agentId, path);
  assert.ok(after.content.includes(marker.trim()), 'the written text is in the file');

  // 3. The memory file is in the listing.
  const memoryEntries = await listDirectory(BASE, token, agentId, 'memory');
  assert.ok(
    memoryEntries.some((entry) => entry.name === 'memory.md'),
    `the memory file is listed: ${memoryEntries.map((entry) => entry.name).join(', ')}`,
  );
});

test('the client reads the automation of one Agent', async () => {
  const facts = await harnessFacts();
  const token = await signIn(facts.email);
  const agentId = facts.agent_id;

  const triggers = await listTriggers(BASE, token, agentId);
  assert.ok(Array.isArray(triggers), 'the triggers are a list');

  const schedules = await listSchedules(BASE, token, agentId);
  assert.ok(Array.isArray(schedules), 'the schedules are a list');
});
