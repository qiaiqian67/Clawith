/**
 * The runtime state of a session, and the way to attach to a Run.
 *
 * The server owns the truth about the Run that holds a session lane. The
 * client reads that truth, and asks the server to attach to the Run when the
 * socket was lost in the middle of it.
 */

import type { ActiveRun } from './chat-contract.ts';

export { type ActiveRun };

/** Whether the Run is still doing work. */
export function isRunActive(run: ActiveRun | null): boolean {
  if (!run) return false;
  return !['completed', 'failed', 'cancelled'].includes(run.status);
}

/** Whether the Run waits for the user to answer. */
export function isWaitingForUser(run: ActiveRun | null): boolean {
  return run?.status === 'waiting_user';
}
