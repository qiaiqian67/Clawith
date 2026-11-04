import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listInstalledTools } from '../../shared/platform-api.ts';
import { listTools, type ToolSummary } from '../../shared/tools.ts';

/**
 * The tools of the organization, and the ones that are installed.
 *
 * A tool is a thing an assistant can do. The list of the tools says what
 * the platform offers; the list of the installed ones says what the
 * assistants of this organization really use.
 */

export interface InstalledToolsListProps {
  baseUrl: string;
  token: string | null;
}

export function InstalledToolsList(props: InstalledToolsListProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [installed, setInstalled] = useState<Array<{ id: string; tool_id: string; agent_id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [toolList, installedList] = await Promise.all([
      listTools(props.baseUrl, props.token),
      listInstalledTools(props.baseUrl, props.token),
    ]);
    setTools(toolList);
    setInstalled(installedList);
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const byCategory = new Map<string, ToolSummary[]>();
  for (const tool of tools) {
    const key = tool.category || 'other';
    byCategory.set(key, [...(byCategory.get(key) ?? []), tool]);
  }

  if (loading) return <p className="zx-view-empty">{t('common.loading')}</p>;

  return (
    <>
      <section className="zx-card">
        <div className="zx-card-head">
          <h2 className="zx-card-title">{t('enterprise.installedTools')}</h2>
          <span className="zx-card-note">{installed.length}</span>
        </div>
        {installed.length === 0 ? (
          <p className="zx-view-empty">{t('enterprise.noInstalledTools')}</p>
        ) : (
          installed.map((row) => (
            <div key={row.id} className="zx-row">
              <span className="zx-row-text">
                <strong>{row.name}</strong>
                <small>{row.agent_id}</small>
              </span>
            </div>
          ))
        )}
      </section>

      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category} className="zx-card">
          <div className="zx-card-head">
            <h2 className="zx-card-title">{category}</h2>
            <span className="zx-card-note">{items.length}</span>
          </div>
          {items.map((tool) => (
            <div key={tool.id} className="zx-row">
              <span className="zx-row-text">
                <strong>{tool.display_name || tool.name}</strong>
                <small>{tool.description || ''}</small>
              </span>
              {tool.requires_config ? <span className="zx-badge">{t('enterprise.needsKeys')}</span> : null}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
