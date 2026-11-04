import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  installMarketSkill,
  listSkills,
  searchMarket,
  type MarketSkill,
  type SkillSummary,
} from '../../shared/marketplace.ts';
import './marketplace.css';

/**
 * The market of skills.
 *
 * The organization has the skills it installed, and the market has the ones
 * it may install. A skill is a set of instructions an assistant follows, so
 * installing one changes what every assistant of the organization can do.
 */

export interface MarketplacePanelProps {
  baseUrl: string;
  token: string | null;
}

export function MarketplacePanel(props: MarketplacePanelProps) {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState<SkillSummary[]>([]);
  const [results, setResults] = useState<MarketSkill[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const list = await listSkills(props.baseUrl, props.token);
    setInstalled(list);
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const search = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const found = await searchMarket(props.baseUrl, props.token, query.trim());
    setResults(found);
    if (found.length === 0) setNote(t('marketplace.noResult'));
    setBusy(false);
  }, [props.baseUrl, props.token, query, t]);

  const install = useCallback(
    async (slug: string) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        await installMarketSkill(props.baseUrl, props.token, slug);
        await load();
        setNote(t('marketplace.installed_note'));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
        <header className="zx-view-head">
          <div>
            <h1 className="zx-view-title">
              {t('marketplace.title')} <span>{t('marketplace.subtitle')}</span>
            </h1>
            <p className="zx-view-subtitle">{t('marketplace.description')}</p>
          </div>
          <div className="zx-marketplace-search">
            <input
              className="zx-field-input"
              value={query}
              placeholder={t('marketplace.searchPlaceholder')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void search();
              }}
            />
            <button
              type="button"
              className="zx-button-primary"
              disabled={busy}
              onClick={() => void search()}
            >
              {t('marketplace.search')}
            </button>
          </div>
        </header>

        {note ? <p className="zx-agent-saved">{note}</p> : null}
        {error ? <p className="zx-field-error">{error}</p> : null}

        {results.length > 0 ? (
          <section className="zx-card">
            <div className="zx-card-head">
              <h2 className="zx-card-title">{t('marketplace.results')}</h2>
              <span className="zx-card-note">{results.length}</span>
            </div>
            {results.map((skill) => (
              <div key={skill.slug} className="zx-row">
                <span className="zx-row-text">
                  <strong>{skill.displayName || skill.slug}</strong>
                  <small>{skill.description || skill.author || ''}</small>
                </span>
                {skill.version ? <span className="zx-badge">v{skill.version}</span> : null}
                <button
                  type="button"
                  className="zx-button-ghost"
                  disabled={busy}
                  onClick={() => void install(skill.slug)}
                >
                  {t('marketplace.install')}
                </button>
              </div>
            ))}
          </section>
        ) : null}

        <section className="zx-card">
          <div className="zx-card-head">
            <h2 className="zx-card-title">{t('marketplace.installed')}</h2>
            <span className="zx-card-note">{installed.length}</span>
          </div>
          {loading ? (
            <p className="zx-view-empty">{t('common.loading')}</p>
          ) : installed.length === 0 ? (
            <p className="zx-view-empty">{t('marketplace.noInstalled')}</p>
          ) : (
            installed.map((skill) => (
              <div key={skill.id} className="zx-row">
                <span className="zx-row-text">
                  <strong>{skill.name}</strong>
                  <small>{skill.description || skill.category || ''}</small>
                </span>
                <span className="zx-badge">{skill.source}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
