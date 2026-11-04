import { desktopApi } from './bridge.ts';

/**
 * The notice of a finished answer.
 *
 * An answer arrives while the user is in another window, and the window of
 * the client is often hidden in the tray. The operating system shows the
 * notice, so the answer is not missed.
 */

/** The notice of one finished answer. */
export interface AnswerNotice {
  /** The name of the agent that answered. */
  agentName: string;
  /** The first words of the answer. */
  text: string;
}

/**
 * Tell the user that an answer is ready.
 *
 * A window with the focus already shows the answer, so it gets no notice.
 */
export async function notifyAnswer(notice: AnswerNotice): Promise<void> {
  const bridge = desktopApi();
  if (!bridge) return;
  try {
    if (await bridge.isFocused()) return;
  } catch {
    return;
  }
  const body = firstLine(notice.text);
  if (!body) return;
  try {
    await bridge.notify({ title: notice.agentName || 'ZeroX', body });
  } catch {
    // A notice the system refuses costs nothing: the answer is in the chat.
  }
}

/** The first useful line of an answer. */
function firstLine(text: string): string {
  const cleaned = (text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
}
