import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isAnswerChunk,
  isFailure,
  isTerminal,
  isThinking,
  isToolCall,
  packetCursor,
  packetRunId,
} from '../src/renderer/src/shared/chat-packet.ts';

test('a thinking packet is recognised', () => {
  assert.equal(isThinking({ type: 'thinking', content: 'hmm' }), true);
  assert.equal(isThinking({ type: 'chunk', content: 'hmm' }), false);
});

test('a chunk packet is recognised only with content', () => {
  assert.equal(isAnswerChunk({ type: 'chunk', content: 'hello' }), true);
  assert.equal(isAnswerChunk({ type: 'chunk' }), false);
});

test('a tool packet is recognised only with a name', () => {
  assert.equal(isToolCall({ type: 'tool_call', name: 'read_file' }), true);
  assert.equal(isToolCall({ type: 'tool_call' }), false);
});

test('a terminal packet is a done', () => {
  assert.equal(isTerminal({ type: 'done' }), true);
  assert.equal(isTerminal({ type: 'runtime_status' }), false);
});

test('an error and a quota failure are failures', () => {
  assert.equal(isFailure({ type: 'error' }), true);
  assert.equal(isFailure({ type: 'quota_exceeded' }), true);
  assert.equal(isFailure({ type: 'done' }), false);
});

test('the cursor of a packet is the position it carries', () => {
  assert.equal(packetCursor({ type: 'chunk', event_cursor: '2026-01-01|abc' }), '2026-01-01|abc');
  assert.equal(packetCursor({ type: 'chunk' }), null);
  assert.equal(packetCursor({ type: 'chunk', event_cursor: '' }), null);
});

test('the run of a packet is the run it names', () => {
  assert.equal(packetRunId({ type: 'runtime_status', run_id: 'r-1' }), 'r-1');
  assert.equal(packetRunId({ type: 'runtime_status' }), null);
});
