import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listSkills, type SkillSummary } from '../../shared/skills.ts';

/**
 * The skills of the organization, as a list.
 *
 * A skill is a folder of instructions an Agent can read. The panel shows
 * which ones the organization has, so the user knows what an Agent can do.
 */

export interface SkillsPanelProps {
  baseUrl: string;
  token: string | null;
}

export function SkillsPanel(props: SkillsPanelProps) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listSkills(props.baseUrl, props.token!);
        if (cancelled) return;
        setSkills(list);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.baseUrl, props.token, t]);

  return (
    <section className="zx-agent-section">
      <h3 className="zx-agent-section-title">{t('skills.title')}</h3>
      {skills.length === 0 ? (
        <p className="zx-agent-empty">{error ?? t('skills.empty')}</p>
      ) : (
        <ul className="zx-agent-list">
          {skills.map((skill) => (
            <li key={skill.id} className="zx-agent-item">
              <span className="zx-agent-item-text">
                <strong>
                  {skill.icon ? `${skill.icon} ` : ''}
                  {skill.name}
                </strong>
                <small>{skill.description || skill.category}</small>
              </span>
              {skill.is_default ? (
                <span className="zx-roster-role">{t('skills.installed')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
