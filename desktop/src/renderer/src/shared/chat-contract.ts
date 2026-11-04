/**
 * The contract of the Web Chat surface.
 *
 * The server owns the truth about a conversation: the sessions, the messages,
 * and the live event stream. The client renders that truth and sends intents.
 * Every shape the server sends is declared here, so a packet that changes is
 * a type error on both sides.
 */

/** One chat session of one agent. */
export interface ChatSession {
  id: string;
  agent_id: string | null;
  title: string | null;
  source_channel: string;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
  tool_call_count: number;
  unread_count: number;
  is_primary: boolean;
}

/** One message of a session, as the server stores it. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_call';
  content: string;
  created_at: string | null;
  cursor: string | null;
  /** The tool name, on a tool_call message. */
  toolName?: string;
  toolArgs?: unknown;
  toolStatus?: string;
  toolResult?: string;
  toolThinking?: string;
  toolCallId?: string;
  /** The reasoning of the assistant, when it produced any. */
  thinking?: string;
}

/** The lifecycle of the Run that holds a session lane. */
export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_user'
  | 'waiting_external'
  | 'waiting_agent'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** The one Run that holds a Direct Chat session lane. */
export interface ActiveRun {
  run_id: string;
  thread_id: string | null;
  session_id: string | null;
  status: RunStatus;
  waiting_type: string | null;
  waiting_reason: string | null;
  correlation_id: string | null;
  model_step_count: number;
  can_resume: boolean;
  can_cancel: boolean;
  pending_tool_reconciliations: PendingToolReconciliation[];
}

/** One Tool whose outcome the server cannot confirm. */
export interface PendingToolReconciliation {
  execution_id: string;
  tool_call_id: string | null;
  tool_name: string;
  result_summary: string | null;
  error_code: string | null;
  can_reconcile: boolean;
  workspace_resolution: boolean;
  resolution_status: 'applied' | 'not_saved' | 'conflicted' | 'unavailable' | 'partial' | null;
  saved_count: number;
  pending_count: number;
  conflicted_count: number;
  unverified_count: number;
}

/** The runtime state of a session. */
export interface SessionRuntimeState {
  active_run: ActiveRun | null;
}
