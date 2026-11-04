import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listExperience, type ExperienceEntry } from '../../shared/experience.ts';
import {
  readWorkspaceFile,
  writeWorkspaceFile,
  type WorkspaceFile,
} from '../../shared/agent-files.ts';
import { MarkdownView } from './MarkdownView';

/**
 * What one Agent knows: its durable memory, and the experience library of the
 * organization.
 *
 * The memory is a file of the workspace, so it uses the same read and write
 * as the file panel.
 */

const MEMORY_PATH = 'memory/memory.md';

export interface AgentKnowledgePanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
}

export function AgentKnowledgePanel(props: AgentKnowledgePanelProps) {
  const { t } = useTranslation();
  const [memory, setMemory] = useState<WorkspaceFile | null>(null);
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.token) return;
    let cancelled = false;
    void (async () => {
      try {
        const [file, library] = await Promise.all([
          readWorkspaceFile(props.baseUrl, props.token!, props.agentId, MEMORY_PATH).catch(
            () => null,
          ),
          listExperience(props.baseUrl, props.token!),
        ]);
        if (cancelled) return;
        setMemory(file);
        setDraft(file?.content ?? '');
        setEntries(library);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.agentId, props.baseUrl, props.token, t]);

  const save = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    try {
      await writeWorkspaceFile(
        props.baseUrl,
        props.token,
        props.agentId,
        MEMORY_PATH,
        draft,
        memory?.version_token ?? null,
      );
      setMemory({ path: MEMORY_PATH, content: draft, version_token: memory?.version_token ?? null });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [draft, memory, props, t]);

  return (
    <div className="zx-agent-form">
      <section className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentKnowledge.memory')}</h3>
        <p className="zx-agent-hint">{t('agentKnowledge.memoryHint')}</p>
        <textarea
          className="zx-field-textarea zx-file-editor"
          rows={12}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
        />
        <div className="zx-agent-actions">
          <button type="button" className="zx-button-primary" disabled={busy} onClick={() => void save()}>
            {busy ? t('common.loading') : t('common.confirm')}
          </button>
          {saved ? <span className="zx-agent-saved">{t('agentSettings.saved')}</span> : null}
        </div>
      </section>

      <section className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentKnowledge.experience')}</h3>
        {entries.length === 0 ? (
          <p className="zx-agent-empty">{t('agentKnowledge.noExperience')}</p>
        ) : (
          <ul className="zx-agent-list">
            {entries.map((entry) => (
              <li key={entry.id} className="zx-agent-item zx-agent-item-column">
                <div className="zx-agent-item-text">
                  <strong>{entry.title}</strong>
                  <small>{entry.applicability || entry.origin}</small>
                </div>
                <div className="zx-experience-body">
                  <MarkdownView content={entry.body} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="zx-agent-hint" data-tone="danger">{error}</p> : null}
    </div>
  );
}
