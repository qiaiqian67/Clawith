import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  deleteWorkspaceFile,
  downloadWorkspaceFile,
  isEditableFile,
  listDirectory,
  readWorkspaceFile,
  writeWorkspaceFile,
  type WorkspaceEntry,
  type WorkspaceFile,
} from '../../shared/agent-files.ts';

/**
 * The workspace files of one Agent: a directory list, and an editor for the
 * text files.
 */

export interface AgentFilesPanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
}

export function AgentFilesPanel(props: AgentFilesPanelProps) {
  const { t } = useTranslation();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [open, setOpen] = useState<WorkspaceFile | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    async (target: string) => {
      if (!props.token) return;
      setError(null);
      const list = await listDirectory(props.baseUrl, props.token, props.agentId, target);
      setEntries(list);
      setPath(target);
      setOpen(null);
    },
    [props.agentId, props.baseUrl, props.token],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(''), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openFile = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!props.token) return;
      if (!isEditableFile(entry)) {
        // A binary file cannot be edited, so it is saved instead.
        setBusy(true);
        setError(null);
        try {
          const body = await downloadWorkspaceFile(
            props.baseUrl,
            props.token,
            props.agentId,
            entry.path,
          );
          saveToDisk(entry.name, body);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('common.retry'));
        } finally {
          setBusy(false);
        }
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const file = await readWorkspaceFile(props.baseUrl, props.token, props.agentId, entry.path);
        setOpen(file);
        setDraft(file.content);
        setSaved(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [props, t],
  );

  const save = useCallback(async () => {
    if (!open || !props.token) return;
    setBusy(true);
    setError(null);
    try {
      await writeWorkspaceFile(
        props.baseUrl,
        props.token,
        props.agentId,
        open.path,
        draft,
        open.version_token,
      );
      setOpen({ ...open, content: draft });
      setSaved(true);
      await load(path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [draft, load, open, path, props, t]);

  const remove = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await deleteWorkspaceFile(props.baseUrl, props.token, props.agentId, entry.path);
        await load(path);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, path, props, t],
  );

  const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

  if (open) {
    return (
      <div className="zx-agent-form">
        <div className="zx-agent-actions">
          <button type="button" className="zx-button-ghost" onClick={() => setOpen(null)}>
            {t('common.back')}
          </button>
          <span className="zx-agent-hint">{open.path}</span>
        </div>
        <textarea
          className="zx-field-textarea zx-file-editor"
          rows={20}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
        />
        {error ? <p className="zx-agent-hint" data-tone="danger">{error}</p> : null}
        <div className="zx-agent-actions">
          <button type="button" className="zx-button-primary" disabled={busy} onClick={() => void save()}>
            {busy ? t('common.loading') : t('common.confirm')}
          </button>
          {saved ? <span className="zx-agent-saved">{t('agentSettings.saved')}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="zx-agent-form">
      <div className="zx-agent-actions">
        <span className="zx-agent-hint">/{path}</span>
        {path ? (
          <button type="button" className="zx-button-ghost" onClick={() => void load(parentPath)}>
            {t('common.back')}
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="zx-agent-empty">{t('agentFiles.empty')}</p>
      ) : (
        <ul className="zx-agent-list">
          {entries.map((entry) => (
            <li key={entry.path} className="zx-agent-item">
              <span className="zx-agent-item-text">
                <strong>
                  {entry.is_dir ? '📁 ' : '📄 '}
                  {entry.name}
                </strong>
                <small>{entry.is_dir ? t('agentFiles.folder') : formatSize(entry.size)}</small>
              </span>
              <button
                type="button"
                className="zx-button-ghost"
                onClick={() => (entry.is_dir ? void load(entry.path) : void openFile(entry))}
              >
                {entry.is_dir ? t('common.open') : t('agentFiles.edit')}
              </button>
              {!entry.is_dir ? (
                <button
                  type="button"
                  className="zx-agent-danger"
                  disabled={busy}
                  onClick={() => void remove(entry)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="zx-agent-hint" data-tone="danger">{error}</p> : null}
    </div>
  );
}

/** Hand one file to the operating system as a download. */
function saveToDisk(name: string, body: string): void {
  const blob = new Blob([body]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
