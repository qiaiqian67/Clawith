/**
 * The images of a message.
 *
 * The platform carries an image inside the text of a message, as a marker that
 * holds a data URL. The interface draws the image and shows the marker as
 * text, so a message that carries one reads like a message with a picture in
 * it.
 */

/** The marker of an image inside the text of a message. */
const IMAGE_MARKER = /\[image_data:(data:image\/[^;,\]]+;base64,[A-Za-z0-9+/=]+)\]/gi;

/** One image of a message. */
export interface MessageImage {
  /** The data URL of the image. */
  src: string;
  /** The mime type of the image. */
  mimeType: string;
}

/** The text of a message without its image markers. */
export function stripImageMarkers(text: string): string {
  return (text ?? '').replace(IMAGE_MARKER, '').trim();
}

/** The images of a message. */
export function messageImages(text: string): MessageImage[] {
  const images: MessageImage[] = [];
  for (const match of (text ?? '').matchAll(IMAGE_MARKER)) {
    const src = match[1];
    const mimeType = /^data:(image\/[^;,]+)/i.exec(src)?.[1] ?? 'image/png';
    images.push({ src, mimeType });
  }
  return images;
}

/**
 * The text of a message with the images replaced by a short marker.
 *
 * The model reads the text, so the marker keeps the place of the image in the
 * message.
 */
export function textWithImageMarkers(text: string): string {
  return (text ?? '').replace(IMAGE_MARKER, '[图片]');
}
