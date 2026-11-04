import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inlineText, parseInline, parseMarkdown } from '../src/renderer/src/shared/markdown.ts';

test('a paragraph is one block', () => {
  const blocks = parseMarkdown('Hello there.');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'paragraph');
  assert.equal(inlineText(blocks[0].inlines), 'Hello there.');
});

test('a fenced code block keeps its text and language', () => {
  const blocks = parseMarkdown('```python\nprint(1)\n```');
  assert.equal(blocks[0].kind, 'code');
  assert.equal(blocks[0].language, 'python');
  assert.equal(blocks[0].text, 'print(1)');
});

test('a heading carries its level', () => {
  const blocks = parseMarkdown('## The title');
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[0].level, 2);
});

test('an unordered list is one block with its items', () => {
  const blocks = parseMarkdown('- one\n- two');
  assert.equal(blocks[0].kind, 'list');
  assert.equal(blocks[0].ordered, false);
  assert.equal(blocks[0].items.length, 2);
});

test('an ordered list is marked as ordered', () => {
  const blocks = parseMarkdown('1. one\n2. two');
  assert.equal(blocks[0].kind, 'list');
  assert.equal(blocks[0].ordered, true);
});

test('a table keeps its header and rows', () => {
  const blocks = parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.equal(blocks[0].kind, 'table');
  assert.equal(blocks[0].header.length, 2);
  assert.equal(blocks[0].rows.length, 1);
  assert.equal(blocks[0].rows[0].length, 2);
});

test('a block quote is one block', () => {
  const blocks = parseMarkdown('> quoted');
  assert.equal(blocks[0].kind, 'quote');
  assert.equal(inlineText(blocks[0].inlines), 'quoted');
});

test('a rule is its own block', () => {
  const blocks = parseMarkdown('---');
  assert.equal(blocks[0].kind, 'rule');
});

test('bold, italic, strike and code are separate marks', () => {
  const marks = parseInline('a **b** *c* ~~d~~ `e`');
  const kinds = marks.map((mark) => mark.kind);
  assert.ok(kinds.includes('bold'));
  assert.ok(kinds.includes('italic'));
  assert.ok(kinds.includes('strike'));
  assert.ok(kinds.includes('code'));
});

test('a link keeps its text and its address', () => {
  const marks = parseInline('[the docs](https://example.com/docs)');
  const link = marks.find((mark) => mark.kind === 'link');
  assert.ok(link);
  assert.equal(link.text, 'the docs');
  assert.equal(link.href, 'https://example.com/docs');
});

test('markup in a message stays text', () => {
  const blocks = parseMarkdown('<script>alert(1)</script>');
  assert.equal(blocks[0].kind, 'paragraph');
  assert.equal(inlineText(blocks[0].inlines), '<script>alert(1)</script>');
});

test('an empty text has no blocks', () => {
  assert.deepEqual(parseMarkdown(''), []);
  assert.deepEqual(parseMarkdown('   \n  '), []);
});
