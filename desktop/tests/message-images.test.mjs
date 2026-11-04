import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  messageImages,
  stripImageMarkers,
  textWithImageMarkers,
} from '../src/renderer/src/shared/message-images.ts';

const IMAGE = '[image_data:data:image/png;base64,iVBORw0KGgo=]';

test('the images of a message are found', () => {
  const images = messageImages(`look ${IMAGE} here`);
  assert.equal(images.length, 1);
  assert.equal(images[0].mimeType, 'image/png');
  assert.match(images[0].src, /^data:image\/png;base64,/);
});

test('a message without an image has no images', () => {
  assert.deepEqual(messageImages('plain text'), []);
});

test('the marker is removed from the text', () => {
  assert.equal(stripImageMarkers(`look ${IMAGE} here`), 'look  here');
});

test('the marker is replaced by a short label', () => {
  assert.equal(textWithImageMarkers(`look ${IMAGE} here`), 'look [图片] here');
});
