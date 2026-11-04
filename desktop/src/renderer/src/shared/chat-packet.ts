/**
 * The contract of the chat socket.
 *
 * The client and the server agree on the shape of a packet. The server owns
 * the truth about a conversation, so the client only sends intents.
 */

/** The base of every packet the client sends. */
export interface ClientPacket {
  /** The text of the message. */
  content: string;
  /** The text shown to the user, when it differs from the text for the model. */
  display_content?: string;
  /** The name of the file the message carries. */
  file_name?: string;
  /** The model the message uses. */
  model_id?: string;
  /** The Run the message answers. */
  run_id?: string;
  /** The correlation of the Run the message answers. */
  correlation_id?: string;
}

/** A packet that stops the Run in flight. */
export interface AbortPacket {
  type: 'abort';
  run_id: string;
}

/** A packet that attaches to a Run that is still running. */
export interface AttachPacket {
  type: 'attach_run';
  run_id: string;
  /** The position of the last event the client saw. */
  cursor?: string;
}

/** Any packet the client sends. */
export type OutgoingPacket = ClientPacket | AbortPacket | AttachPacket;

/**
 * The shape of a packet the server sends.
 *
 * The fields are optional, because the server sends the fields that fit the
 * packet. The reader narrows on `type` and then reads the fields it needs.
 */
export interface IncomingPacket {
  type: string;
  content?: string;
  message?: string;
  code?: string;
  stage?: string;
  trace_id?: string;
  role?: string;
  name?: string;
  call_id?: string;
  args?: Record<string, unknown>;
  status?: string;
  result?: string;
  reasoning_content?: string;
  execution_status?: string | null;
  error_code?: string | null;
  run_id?: string;
  agent_id?: string;
  session_id?: string;
  event?: string;
  event_cursor?: string;
  attempt_id?: string;
  sequence?: number;
  reset?: boolean;
  correlation_id?: string;
  message_id?: string;
  runtime_status?: string;
  delivery_error?: string;
  environment?: string;
  screenshot_url?: string;
}

/** Whether the packet carries a chunk of the answer. */
export function isAnswerChunk(packet: IncomingPacket): boolean {
  return packet.type === 'chunk' && typeof packet.content === 'string';
}

/** Whether the packet carries the reasoning of the model. */
export function isThinking(packet: IncomingPacket): boolean {
  return packet.type === 'thinking' && typeof packet.content === 'string';
}

/** Whether the packet reports a tool call. */
export function isToolCall(packet: IncomingPacket): boolean {
  return packet.type === 'tool_call' && typeof packet.name === 'string';
}

/** Whether the packet ends a Run. */
export function isTerminal(packet: IncomingPacket): boolean {
  return packet.type === 'done';
}

/** Whether the packet reports a failure. */
export function isFailure(packet: IncomingPacket): boolean {
  return packet.type === 'error' || packet.type === 'quota_exceeded';
}

/** The position of a packet, when it carries one. */
export function packetCursor(packet: IncomingPacket): string | null {
  return typeof packet.event_cursor === 'string' && packet.event_cursor ? packet.event_cursor : null;
}

/** The Run a packet belongs to, when it names one. */
export function packetRunId(packet: IncomingPacket): string | null {
  return typeof packet.run_id === 'string' && packet.run_id ? packet.run_id : null;
}
