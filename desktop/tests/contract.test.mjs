import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeServerUrl } from '../src/main/server-url.ts';
import { wheelIndex, wheelOffset } from '../src/renderer/src/features/onboarding/language-wheel-math.ts';

test('a server address without a scheme gets https', () => {
  assert.equal(normalizeServerUrl('zerox.example.com'), 'https://zerox.example.com');
});

test('a trailing slash is removed from a server address', () => {
  assert.equal(normalizeServerUrl('https://zerox.example.com/'), 'https://zerox.example.com');
});

test('a path on the server address is kept', () => {
  assert.equal(normalizeServerUrl('https://example.com/zerox'), 'https://example.com/zerox');
});

test('a blank server address is refused', () => {
  assert.throws(() => normalizeServerUrl('   '), /must not be blank/);
});

test('a server address with another scheme is refused', () => {
  assert.throws(() => normalizeServerUrl('ftp://example.com'), /http or https/);
});

test('the wheel is a loop, so a step past the end starts at the front', () => {
  assert.equal(wheelIndex(4, 4), 0);
  assert.equal(wheelIndex(-1, 4), 3);
});

test('the row in the centre has an offset of zero', () => {
  assert.equal(wheelOffset(2, 2, 4), 0);
});

test('the row above the centre has a negative offset', () => {
  assert.equal(wheelOffset(1, 2, 4), -1);
});
