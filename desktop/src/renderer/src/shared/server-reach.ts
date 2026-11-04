import { apiRequestText } from './http.ts';

/**
 * The reach of a server.
 *
 * The client asks the server whether it is there, and the server answers.
 * A server that is not there is not an error the user has to read; it is a
 * state the interface shows.
 */

/** The state of one server. */
export type ServerReach = 'online' | 'offline' | 'checking';

/** Ask one server whether it is there. */
export async function checkServer(url: string): Promise<ServerReach> {
  const base = url.replace(/\/+$/, '');
  const answer = await apiRequestText(`${base}/api/health`, { timeoutMs: 5000 });
  return answer.status > 0 && answer.status < 400 ? 'online' : 'offline';
}

/** Ask every server of the client whether it is there. */
export async function checkServers(
  servers: ReadonlyArray<{ id: string; url: string }>,
): Promise<Record<string, ServerReach>> {
  const entries = await Promise.all(
    servers.map(async (server) => [server.id, await checkServer(server.url)] as const),
  );
  return Object.fromEntries(entries);
}
