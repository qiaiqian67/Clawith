import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AgentAutomationPanel } from './AgentAutomationPanel';
import { AgentFilesPanel } from './AgentFilesPanel';
import { AgentKnowledgePanel } from './AgentKnowledgePanel';
import { AgentSettingsForm } from './AgentSettingsForm';
import { SkillsPanel } from './SkillsPanel';
import { AgentWorkTab } from './AgentWorkTab';
import { ChannelsPanel } from './ChannelsPanel';
import { CollaborationTab } from './CollaborationTab';
import { TakeControlPanel } from './TakeControlPanel';
import './agent-panel.css';

/**
 * The panel of one Agent: its settings, its files, what it knows, and its
 * automation.
 */

export type AgentPanelTab =
  | 'settings'
  | 'files'
  | 'knowledge'
  | 'automation'
  | 'skills'
  | 'work'
  | 'collaboration'
  | 'channels'
  | 'control';

export interface AgentPanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
  agentName: string;
  /** The session that runs in the browser or on the computer. */
  sessionId?: string | null;
}

export function AgentPanel(props: AgentPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AgentPanelTab>('settings');

  const tabs: Array<{ id: AgentPanelTab; label: string }> = [
    { id: 'settings', label: t('agentPanel.settings') },
    { id: 'files', label: t('agentPanel.files') },
    { id: 'knowledge', label: t('agentPanel.knowledge') },
    { id: 'automation', label: t('agentPanel.automation') },
    { id: 'skills', label: t('skills.title') },
    { id: 'work', label: t('agentWork.title') },
    { id: 'collaboration', label: t('collaboration.title') },
    { id: 'channels', label: t('channels.title') },
    { id: 'control', label: t('takeControl.title') },
  ];

  return (
    <div className="zx-agent-panel">
      <nav className="zx-agent-tabs" aria-label={props.agentName}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className="zx-agent-tab"
            data-active={tab === item.id ? 'true' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="zx-agent-body">
        {tab === 'settings' ? (
          <AgentSettingsForm baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'files' ? (
          <AgentFilesPanel baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'knowledge' ? (
          <AgentKnowledgePanel baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'automation' ? (
          <AgentAutomationPanel baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'skills' ? <SkillsPanel baseUrl={props.baseUrl} token={props.token} /> : null}
        {tab === 'work' ? (
          <AgentWorkTab baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'channels' ? (
          <ChannelsPanel baseUrl={props.baseUrl} token={props.token} agentId={props.agentId} />
        ) : null}
        {tab === 'control' ? (
          <TakeControlPanel
            baseUrl={props.baseUrl}
            token={props.token}
            agentId={props.agentId}
            sessionId={props.sessionId ?? null}
          />
        ) : null}
        {tab === 'collaboration' ? (
          <CollaborationTab
            baseUrl={props.baseUrl}
            token={props.token}
            agentId={props.agentId}
            agentName={props.agentName}
          />
        ) : null}
      </div>
    </div>
  );
}
