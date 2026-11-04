import { apiRequest, apiRequestText } from './http.ts';

/**
 * The workspace files of one Agent.
 *
 * The server owns the files. The client lists a directory, reads one file,
 * writes one file, and deletes one file.
 */

/** One entry of a directory. */
export interface WorkspaceEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string;
  version_token: string | null;
}

/** The content of one file. */
export interface WorkspaceFile {
  path: string;
  content: string;
  version_token: string | null;
}

/** The list of one directory inside the workspace of an Agent. */
export async function listDirectory(
  baseUrl: string,
  token: string,
  agentId: string,
  path = '',
): Promise<WorkspaceEntry[]> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  try {
    return await apiRequest<WorkspaceEntry[]>(
      `${baseUrl}/api/agents/${agentId}/files/${query}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Read one text file of the workspace. */
export async function readWorkspaceFile(
  baseUrl: string,
  token: string,
  agentId: string,
  path: string,
): Promise<WorkspaceFile> {
  return apiRequest<WorkspaceFile>(
    `${baseUrl}/api/agents/${agentId}/files/content?path=${encodeURIComponent(path)}`,
    { token },
  );
}

/** Write one text file of the workspace. */
export async function writeWorkspaceFile(
  baseUrl: string,
  token: string,
  agentId: string,
  path: string,
  content: string,
  expectedVersionToken: string | null,
): Promise<void> {
  await apiRequest<unknown>(
    `${baseUrl}/api/agents/${agentId}/files/content?path=${encodeURIComponent(path)}`,
    {
      token,
      method: 'PUT',
      body: JSON.stringify({ content, expected_version_token: expectedVersionToken }),
    },
  );
}

/** Delete one file of the workspace. */
export async function deleteWorkspaceFile(
  baseUrl: string,
  token: string,
  agentId: string,
  path: string,
): Promise<void> {
  await apiRequest<unknown>(
    `${baseUrl}/api/agents/${agentId}/files/content?path=${encodeURIComponent(path)}`,
    { token, method: 'DELETE' },
  );
}

/**
 * Read one file of the workspace as bytes.
 *
 * The download endpoint answers with the file itself, so the client asks for
 * the text of the answer and hands it to the operating system.
 */
export async function downloadWorkspaceFile(
  baseUrl: string,
  token: string,
  agentId: string,
  path: string,
): Promise<string> {
  const answer = await apiRequestText(
    `${baseUrl}/api/agents/${agentId}/files/download?path=${encodeURIComponent(path)}`,
    { token },
  );
  return answer.body;
}

/** Whether a file is text the client can edit. */
export function isEditableFile(entry: WorkspaceEntry): boolean {
  if (entry.is_dir) return false;
  if (!entry.name.includes('.')) return true;
  const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(extension);
}

const TEXT_EXTENSIONS = new Set([
  'md',
  'txt',
  'json',
  'yaml',
  'yml',
  'csv',
  'tsv',
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'html',
  'css',
  'sh',
  'toml',
  'ini',
  'log',
  'xml',
]);
