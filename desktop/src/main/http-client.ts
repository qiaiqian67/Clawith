import type { HttpRequest, HttpResponse, HttpUploadRequest } from '../renderer/src/shared/http-contract';

/**
 * The requests of the renderer.
 *
 * Main performs every request, because the page runs on `app://` and the
 * server lives on another origin. The main process has no origin, so it
 * reaches any server the user configured.
 */

/** The response of one request, with a zero status when the server is away. */
export async function performRequest(request: HttpRequest): Promise<HttpResponse> {
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.timeoutMs ? { signal: AbortSignal.timeout(request.timeoutMs) } : {}),
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: '' };
  }
}

/** Upload one file, as a multipart request. */
export async function performUpload(request: HttpUploadRequest): Promise<HttpResponse> {
  try {
    const form = new FormData();
    const bytes = Buffer.from(request.dataBase64, 'base64');
    form.append('file', new Blob([bytes], { type: request.contentType }), request.fileName);
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: form,
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: '' };
  }
}
