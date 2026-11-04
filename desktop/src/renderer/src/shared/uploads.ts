import { desktopApi } from './bridge.ts';
import { apiRequest } from './http.ts';

/**
 * The upload of a file into the workspace of an agent.
 *
 * The platform stores the file and answers with its path. The client then
 * sends the path with the message, so the agent reads the file from its own
 * workspace.
 */

/** The answer of the upload endpoint. */
export interface UploadResult {
  status: string;
  path: string;
  url: string;
  filename: string;
  size: number;
  extracted_text_path: string | null;
}

/**
 * The directory the uploads of a chat go to.
 *
 * The platform refuses every directory but `workspace` and `skills`, so the
 * client names the one it wants.
 */
export const UPLOAD_DIRECTORY = 'workspace/uploads';

/** The file types the composer accepts. */
export const ACCEPTED_UPLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/zip',
];

/** The largest file the client sends, in bytes. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Whether a file may be sent. */
export function isUploadAccepted(file: { type: string; size: number }): boolean {
  if (file.size > MAX_UPLOAD_BYTES) return false;
  if (!file.type) return true;
  return ACCEPTED_UPLOAD_TYPES.includes(file.type);
}

/**
 * Upload one file into the workspace of an agent.
 *
 * The platform names the file after the one the client sent, so the answer
 * carries the path the agent reads.
 */
export async function uploadAttachment(
  baseUrl: string,
  token: string,
  agentId: string,
  file: File,
): Promise<UploadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dataBase64 = toBase64(bytes);
  const url = `${baseUrl}/api/agents/${agentId}/files/upload`;

  const bridge = desktopApi();
  const answer = bridge
    ? await bridge.uploadFile({
        url,
        headers: { Authorization: `Bearer ${token}` },
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        dataBase64,
      })
    : await uploadInPage(url, token, file);

  if (answer.status === 0) {
    throw new Error('The server could not be reached.');
  }
  if (answer.status >= 400) {
    throw new Error(readDetail(answer.body, `The server answered ${answer.status}.`));
  }
  return JSON.parse(answer.body) as UploadResult;
}

/** Base64 of the bytes of a file. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** The upload of a page that has no bridge. */
async function uploadInPage(
  url: string,
  token: string,
  file: File,
): Promise<{ status: number; body: string }> {
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: '' };
  }
}

/** The message of a failure that the server sent as JSON. */
function readDetail(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    // A body that is not JSON carries no message.
  }
  return fallback;
}

export { apiRequest };
