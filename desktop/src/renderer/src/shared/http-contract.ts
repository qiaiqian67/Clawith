/**
 * One request to the server, as a value.
 *
 * The renderer asks the main process for every request, because a page on
 * `app://` is an origin of its own: a call to another origin is a cross-origin
 * call, and the server would have to allow that origin. The main process has
 * no origin, so the call reaches any server the user configured.
 */

/** One request the renderer asks of the main process. */
export interface HttpRequest {
  /** The absolute address of the request. */
  url: string;
  /** The method of the request. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The headers of the request. */
  headers: Record<string, string>;
  /** The text body of the request. */
  body?: string;
  /** How long the client waits, in milliseconds. */
  timeoutMs?: number;
}

/** The answer of one request. */
export interface HttpResponse {
  /** The status the server answered. Zero means the server was not there. */
  status: number;
  /** The text body of the answer. */
  body: string;
}

/** One file the renderer uploads. */
export interface HttpUploadRequest {
  /** The address of the upload endpoint. */
  url: string;
  /** The headers of the request. */
  headers: Record<string, string>;
  /** The name of the file. */
  fileName: string;
  /** The type of the file. */
  contentType: string;
  /** The bytes of the file, base64 encoded. */
  dataBase64: string;
}
