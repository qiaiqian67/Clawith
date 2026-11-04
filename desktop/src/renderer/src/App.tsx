import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageGate } from './features/onboarding/LanguageGate';
import { FirstRunFlow } from './features/onboarding/FirstRunFlow';
import { ServerSetup } from './features/onboarding/ServerSetup';
import { StartupSplash } from './features/startup/StartupSplash';
import { UpdateBanner } from './features/startup/UpdateBanner';
import { OfflineBanner } from './features/startup/OfflineBanner';
import { AccountLogin } from './features/login/AccountLogin';
import { AccountRegister } from './features/login/AccountRegister';
import { VerifyEmail } from './features/login/VerifyEmail';
import { AgentSetup } from './features/workspace/AgentSetup';
import { ChatPanel } from './features/workspace/ChatPanel';
import { WorkspaceSidebar, type SidebarAgent } from './features/workspace/WorkspaceSidebar';
import { GroupPanel } from './features/workspace/GroupPanel';
import { CreateGroupDialog } from './features/workspace/GroupMembers';
import { AgentPanel } from './features/workspace/AgentPanel';
import { ApprovalBanner } from './features/workspace/ApprovalBanner';
import { SettingsSheet } from './features/workspace/SettingsSheet';
import { NavRail, type WorkspaceView } from './features/workspace/NavRail';
import { AgentTasksPage } from './features/workspace/AgentTasksPage';
import { AgentTriggersPage } from './features/workspace/AgentTriggersPage';
import { PlazaPanel } from './features/plaza/PlazaPanel';
import { MessagesPanel } from './features/messages/MessagesPanel';
import { EnterprisePanel } from './features/enterprise/EnterprisePanel';
import { DashboardPanel } from './features/dashboard/DashboardPanel';
import { OkrPanel } from './features/okr/OkrPanel';
import { AdminPanel } from './features/admin/AdminPanel';
import { LibraryPanel } from './features/library/LibraryPanel';
import { MarketplacePanel } from './features/marketplace/MarketplacePanel';
import { ForgotPassword } from './features/login/ForgotPassword';
import { desktopApi } from './shared/bridge';
import { ApiError, useClient, type MultiTenantResult, type SignInResult } from './shared/api-client';
import { listSessions } from './shared/chat-api';
import { createSession } from './shared/sessions';
import { listGroups, type Group } from './shared/groups';
import { applyAppearance, watchSystemAppearance } from './shared/appearance';
import { onSessionExpired } from './shared/http';
import { unreadCount } from './shared/notifications.ts';
import { checkServer } from './shared/server-reach';
import type { ChatSession } from './shared/chat-contract';
import type { AppBootstrap, AppPreferences, ServerState } from './shared/contract';
import './features/workspace/workspace.css';
import './brand/logo.css';

/**
 * The client of the ZeroX platform.
 *
 * The screens are a sequence, and each one decides whether the next one
 * shows: the server, the language, the sign-in, the first run, then the
 * workspace. The state that decides is the server the client points at and
 * the credential it holds for that server.
 */

type Stage = 'loading' | 'server' | 'language' | 'login' | 'onboarding' | 'workspace';

const RESEND_SECONDS = 60;

export function App() {
  const { i18n } = useTranslation();
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [serverState, setServerState] = useState<ServerState>({ active: null, servers: [] });
  const [stage, setStage] = useState<Stage>('loading');
  const [sessionNote, setSessionNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const api = desktopApi();
      const state = api ? await api.getBootstrap() : null;
      if (cancelled) return;
      if (state) {
        setBootstrap(state);
        setServerState(state.serverState);
        void i18n.changeLanguage(state.preferences.language);
        setStage(resolveStage(state));
      } else {
        // The page runs without the desktop bridge. It keeps its own state.
        setStage('language');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [i18n]);

  // The appearance follows the preference, and the system while the
  // preference asks for it.
  const appearance = bootstrap?.preferences.theme ?? 'system';
  useEffect(() => {
    applyAppearance(appearance);
    return watchSystemAppearance(appearance, () => applyAppearance(appearance));
  }, [appearance]);

  // A session that ended returns the client to the sign-in screen once.
  const { t } = useTranslation();
  useEffect(
    () =>
      onSessionExpired(() => {
        void desktopApi()?.clearCredential();
        setSessionNote(t('session.expired'));
        setBootstrap((current) => (current ? { ...current, credential: null } : current));
        setStage('login');
      }),
    [t],
  );

  const client = useClient(serverState);

  if (stage === 'loading') {
    return <StartupSplash ready={false} progress={null} />;
  }

  if (stage === 'server') {
    return (
      <ServerSetup
        initialUrl={serverState.active?.url}
        suggestion={bootstrap?.suggestedServerUrl}
        onConnect={(url) => {
          void (async () => {
            await desktopApi()?.addServer(url);
            const state = await desktopApi()?.getBootstrap();
            if (!state) return;
            setBootstrap(state);
            setServerState(state.serverState);
            setStage(resolveStage({ ...state, preferences: { ...state.preferences, onboardingCompleted: true } }));
          })();
        }}
      />
    );
  }

  if (stage === 'language') {
    return <LanguageGate />;
  }

  return (
    <SignedInStage
      stage={stage}
      bootstrap={bootstrap}
      serverState={serverState}
      client={client}
      sessionNote={sessionNote}
      onServerState={setServerState}
      onPreferences={(theme) =>
        setBootstrap((current) =>
          current ? { ...current, preferences: { ...current.preferences, theme } } : current,
        )
      }
      onSignedOut={() => {
        setBootstrap((current) => (current ? { ...current, credential: null } : current));
        setStage('login');
      }}
      onSignedIn={(credential) => {
        // A session that cannot be written is still usable now; the user signs
        // in again at the next start instead of losing this one.
        void Promise.resolve(desktopApi()?.setCredential(credential)).catch(() => undefined);
        setSessionNote(null);
        setBootstrap((current) => (current ? { ...current, credential } : current));
        setStage('workspace');
      }}
      onStage={setStage}
    />
  );
}

/**
 * The stage the stored state asks for.
 *
 * A client with no server cannot sign in, so it asks for the address first.
 * A client whose first run is not done shows the first run. A client without
 * a session shows the sign-in.
 */
function resolveStage(state: AppBootstrap): Stage {
  if (state.serverState.servers.length === 0 || state.serverState.active === null) {
    return 'server';
  }
  if (!state.preferences.onboardingCompleted) {
    return 'onboarding';
  }
  return state.credential?.accessToken ? 'workspace' : 'login';
}

interface SignedInStageProps {
  stage: Stage;
  bootstrap: AppBootstrap | null;
  serverState: ServerState;
  client: ReturnType<typeof useClient>;
  /** The note of a session that ended, when there is one. */
  sessionNote: string | null;
  onServerState: (state: ServerState) => void;
  /** The appearance the user chose. */
  onPreferences: (appearance: AppPreferences['theme']) => void;
  /** The user signed out, so the client returns to the sign-in screen. */
  onSignedOut: () => void;
  onSignedIn: (credential: {
    serverId: string;
    userId: string | null;
    accessToken: string | null;
    displayName: string | null;
  }) => void;
  onStage: (stage: Stage) => void;
}

function SignedInStage(props: SignedInStageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [agents, setAgents] = useState<SidebarAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<WorkspaceView>('workbench');
  const [role, setRole] = useState('member');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);
  const [forgotDone, setForgotDone] = useState(false);
  const [unread, setUnread] = useState(0);

  const [setupOpen, setSetupOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [invitationRequired, setInvitationRequired] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [codeAccepted, setCodeAccepted] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResendIn, setVerifyResendIn] = useState(0);
  /** The session a new account already holds, for an account that is active. */
  const [pendingCredential, setPendingCredential] = useState<{
    serverId: string;
    userId: string | null;
    accessToken: string | null;
    displayName: string | null;
  } | null>(null);
  /** Whether the new account works before its address is verified. */
  const [canSkip, setCanSkip] = useState(false);

  const token = props.bootstrap?.credential?.accessToken ?? null;
  const serverId = props.serverState.active?.id ?? '';
  const serverUrl = props.client.baseUrl.replace(/\/api$/, '');
  /** The person who is signed in. */
  const userId = props.bootstrap?.credential?.userId ?? null;
  /** The organization the session is in. The server knows it; the client asks when it needs it. */
  const tenantId = null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const read = () => {
      void unreadCount(serverUrl, token).then((count) => {
        if (!cancelled) setUnread(count);
      });
    };
    const first = window.setTimeout(read, 1500);
    const clock = window.setInterval(read, 60000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(clock);
    };
  }, [serverUrl, token]);

  // A first run on a server the client cannot reach is a dead end, so the
  // address screen comes back with the reason.
  const [serverMissing, setServerMissing] = useState(false);
  useEffect(() => {
    if (props.stage !== 'login' && props.stage !== 'onboarding') return;
    let cancelled = false;
    void (async () => {
      const reach = await checkServer(serverUrl);
      if (!cancelled) setServerMissing(reach === 'offline');
    })();
    return () => {
      cancelled = true;
    };
  }, [props.stage, serverUrl]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await props.client.me(token);
        if (!cancelled) setRole(me.role ?? 'member');
      } catch {
        // A role that cannot be read leaves the administration closed, which
        // is the safe reading.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.client, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = (await props.client.listAgents(token)) as SidebarAgent[];
        if (cancelled) return;
        setAgents(list);
        setActiveAgentId((current) => current ?? list[0]?.id ?? null);
      } catch {
        // The list is not on the path to the workspace; a failure here leaves
        // the workspace empty rather than blocking the client.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.client, token]);

  // The sessions of the active agent. The primary session is the one the
  // workspace opens with.
  useEffect(() => {
    if (!token || !activeAgentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listSessions(props.client.baseUrl, token, activeAgentId);
        if (cancelled) return;
        setSessions(list);
        setActiveSessionId((current) => {
          if (current && list.some((session) => session.id === current)) return current;
          const primary = list.find((session) => session.is_primary);
          return primary?.id ?? list[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgentId, props.client.baseUrl, token]);

  // The groups of the organization.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const list = await listGroups(props.client.baseUrl, token);
      if (cancelled) return;
      setGroups(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.client.baseUrl, token]);

  const startSession = useCallback(async () => {
    if (!token || !activeAgentId) return;
    setSessionError(null);
    try {
      const created = await createSession(props.client.baseUrl, token, activeAgentId);
      setSessions((current) => [...current, created as unknown as ChatSession]);
      setActiveSessionId(created.id);
    } catch (cause) {
      setSessionError(cause instanceof Error ? cause.message : t('common.retry'));
    }
  }, [activeAgentId, props.client.baseUrl, t, token]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const requestCode = useCallback(
    async (address: string) => {
      setSending(true);
      setError(null);
      try {
        await props.client.requestLoginCode(address);
        setEmail(address);
        setResendIn(RESEND_SECONDS);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : t('common.retry'));
      } finally {
        setSending(false);
      }
    },
    [props.client, t],
  );

  const verifyCode = useCallback(
    async (address: string, code: string) => {
      setVerifying(true);
      setError(null);
      try {
        const result = await props.client.verifyLoginCode(address, code);
        if ((result as MultiTenantResult).requires_tenant_selection) {
          const choice = (result as MultiTenantResult).tenants[0];
          if (!choice?.tenant_id) {
            setError(t('common.retry'));
            return;
          }
          const signed = await props.client.verifyLoginCodeForTenant(address, code, choice.tenant_id);
          props.onSignedIn(toCredential(signed, serverId));
          return;
        }
        props.onSignedIn(toCredential(result as SignInResult, serverId));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : t('common.retry'));
      } finally {
        setVerifying(false);
      }
    },
    [props, serverId, t],
  );

  const finishOnboarding = useCallback(async () => {
    setOnboardingError(null);
    try {
      await desktopApi()?.setPreferences({ onboardingCompleted: true });
      props.onStage(props.bootstrap?.credential?.accessToken ? 'workspace' : 'login');
    } catch {
      setOnboardingError(t('common.retry'));
    }
  }, [props, t]);

  if (props.stage === 'onboarding') {
    return (
      <FirstRunFlow
        ready={false}
        error={onboardingError ?? (serverMissing ? t('serverSetup.unreachable') : null)}
        onStartFree={() => void finishOnboarding()}
        onUsePlan={() => void finishOnboarding()}
        onRetry={() => void finishOnboarding()}
      />
    );
  }

  // The code the server mails after an account is made. The account is not
  // active until the code names it, so this screen comes before the workspace.
  if (props.stage === 'login' && verifyEmail) {
    return (
      <VerifyEmail
        email={verifyEmail}
        verified={codeAccepted}
        verifying={confirmingCode}
        error={verifyError}
        resendIn={verifyResendIn}
        onBack={() => {
          setVerifyEmail(null);
          setVerifyError(null);
          setRegisterOpen(true);
        }}
        onSkip={
          canSkip && pendingCredential ? () => props.onSignedIn(pendingCredential) : undefined
        }
        onResend={() => {
          setVerifyError(null);
          setVerifyResendIn(RESEND_SECONDS);
          void props.client.resendVerification(verifyEmail).catch(() => undefined);
        }}
        onVerify={(code) => {
          setConfirmingCode(true);
          setVerifyError(null);
          void (async () => {
            try {
              const signed = await props.client.verifyEmail(code);
              setCodeAccepted(true);
              props.onSignedIn(toCredential(signed, serverId));
            } catch (cause) {
              setVerifyError(cause instanceof ApiError ? cause.message : t('common.retry'));
            } finally {
              setConfirmingCode(false);
            }
          })();
        }}
      />
    );
  }

  if (props.stage === 'login' && forgotOpen) {
    return (
      <ForgotPassword
        busy={forgotBusy}
        error={forgotError}
        sentTo={forgotSentTo}
        done={forgotDone}
        onRequest={(email) => {
          setForgotBusy(true);
          setForgotError(null);
          void (async () => {
            try {
              await props.client.forgotPassword(email);
              setForgotSentTo(email);
            } catch (cause) {
              setForgotError(cause instanceof ApiError ? cause.message : t('common.retry'));
            } finally {
              setForgotBusy(false);
            }
          })();
        }}
        onReset={(token, password) => {
          setForgotBusy(true);
          setForgotError(null);
          void (async () => {
            try {
              await props.client.resetPassword(token, password);
              setForgotDone(true);
            } catch (cause) {
              setForgotError(cause instanceof ApiError ? cause.message : t('common.retry'));
            } finally {
              setForgotBusy(false);
            }
          })();
        }}
        onBack={() => {
          setForgotOpen(false);
          setForgotSentTo(null);
          setForgotDone(false);
          setForgotError(null);
        }}
      />
    );
  }

  if (props.stage === 'login' && registerOpen) {
    return (
      <AccountRegister
        busy={registering}
        error={registerError}
        invitationRequired={invitationRequired}
        onCancel={() => {
          setRegisterOpen(false);
          setRegisterError(null);
        }}
        onRegister={(input) => {
          setRegistering(true);
          setRegisterError(null);
          void (async () => {
            try {
              const signed = await props.client.register(input);
              if (signed.needsVerification) {
                // The account exists but the server wants its address named
                // by the mailed code. The first account of a server is
                // active at once, so it may go in before it verifies; a later
                // one may not, and the client learns which by asking.
                setPendingCredential(toCredential(signed, serverId));
                setCanSkip(await isActive(props.client, signed.access_token));
                setVerifyEmail(input.email);
                setVerifyResendIn(RESEND_SECONDS);
                setRegisterOpen(false);
                return;
              }
              props.onSignedIn(toCredential(signed, serverId));
            } catch (cause) {
              setRegisterError(cause instanceof ApiError ? cause.message : t('common.retry'));
            } finally {
              setRegistering(false);
            }
          })();
        }}
      />
    );
  }

  if (props.stage === 'login' || !token) {
    return (
      <AccountLogin
        email={email}
        sending={sending}
        verifying={verifying}
        error={error ?? props.sessionNote ?? (serverMissing ? t('serverSetup.unreachable') : null)}
        resendIn={resendIn}
        onRequestCode={(address) => void requestCode(address)}
        onVerifyCode={(address, code) => void verifyCode(address, code)}
        onChangeEmail={() => {
          setEmail(null);
          setError(null);
        }}
        onResend={() => {
          if (email) void requestCode(email);
        }}
        onSignUp={() => {
          setRegisterOpen(true);
          setRegisterError(null);
          void (async () => {
            const config = await props.client.registrationConfig();
            setInvitationRequired(config.invitation_code_required);
          })();
        }}
        onForgot={() => {
          setForgotOpen(true);
          setForgotError(null);
        }}
      />
    );
  }

  return (
    <div className="zx-shell">
      <NavRail
        view={view}
        onChange={setView}
        unread={unread}
        showAdmin={role === 'platform_admin' || role === 'org_admin'}
        servers={props.serverState.servers.map((server) => ({
          id: server.id,
          name: server.name,
          url: server.url,
        }))}
        activeServerId={props.serverState.active?.id ?? null}
        onSelectServer={(serverId) => {
          // The credential belongs to a server, so a switch reads the
          // credential of the server the client now points at. The switch is
          // one operation, so the interface never shows a token of another
          // server.
          void (async () => {
            await desktopApi()?.selectServer(serverId);
            const state = await desktopApi()?.getBootstrap();
            if (!state) return;
            props.onServerState(state.serverState);
            props.onSignedIn({
              serverId: state.credential?.serverId ?? serverId,
              userId: state.credential?.userId ?? null,
              accessToken: state.credential?.accessToken ?? null,
              displayName: state.credential?.displayName ?? null,
            });
          })();
        }}
        accountName={props.bootstrap?.credential?.displayName ?? null}
        appVersion={props.bootstrap?.appVersion ?? '0.0.0'}
        appearance={props.bootstrap?.preferences.theme ?? 'system'}
        onAppearance={(appearance) => {
          void desktopApi()?.setPreferences({ theme: appearance }).then((preferences) => {
            props.onPreferences(preferences.theme);
          });
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => {
          void (async () => {
            await desktopApi()?.clearCredential();
            props.onSignedOut();
          })();
        }}
      />

      <div className="zx-page">
        <div className="zx-page-card">
          {view === 'agents' ? (
            <WorkspaceSidebar
              agents={agents}
              activeAgentId={activeAgentId}
              serverName={props.serverState.active?.name ?? ''}
              sessions={sessions}
              activeSessionId={activeSessionId}
              sessionError={sessionError}
              groups={groups}
              activeGroupId={activeGroupId}
              onCreateGroup={() => setGroupDialogOpen(true)}
              onSelectGroup={(groupId) => {
                setActiveGroupId(groupId);
                setSetupOpen(false);
              }}
              onSelectAgent={(agentId) => {
                setActiveGroupId(null);
                setAgentPanelOpen(false);
                setActiveAgentId(agentId);
                setSetupOpen(false);
              }}
              onSelectSession={setActiveSessionId}
              onCreateAgent={() => setSetupOpen(true)}
              onCreateSession={() => void startSession()}
            />
          ) : null}

          <main className="zx-pane">
            <OfflineBanner serverUrl={serverUrl} />
            <UpdateBanner />
            <ApprovalBanner baseUrl={serverUrl} token={token} agentId={activeAgentId} />
            {view === 'workbench' ? (
              <DashboardPanel
                baseUrl={serverUrl}
                token={token}
                accountName={props.bootstrap?.credential?.displayName ?? null}
                onGo={(next) => setView(next)}
                onOpenAgent={(agentId) => {
                  setView('agents');
                  setActiveAgentId(agentId);
                  setSetupOpen(false);
                }}
              />
            ) : view === 'okr' ? (
              <OkrPanel
                baseUrl={serverUrl}
                token={token}
                canEdit={role === 'platform_admin' || role === 'org_admin'}
              />
            ) : view === 'admin' ? (
              <AdminPanel baseUrl={serverUrl} token={token} role={role} />
            ) : view === 'library' ? (
              <LibraryPanel
                baseUrl={serverUrl}
                token={token}
                canEdit={role === 'platform_admin' || role === 'org_admin'}
              />
            ) : view === 'marketplace' ? (
              <MarketplacePanel baseUrl={serverUrl} token={token} />
            ) : view === 'tasks' ? (
              <AgentTasksPage
                baseUrl={serverUrl}
                token={token}
                agents={agents}
                activeAgentId={activeAgentId}
                onPickAgent={setActiveAgentId}
              />
            ) : view === 'triggers' ? (
              <AgentTriggersPage
                baseUrl={serverUrl}
                token={token}
                agents={agents}
                activeAgentId={activeAgentId}
                onPickAgent={setActiveAgentId}
              />
            ) : view === 'plaza' ? (
              <PlazaPanel
                baseUrl={serverUrl}
                token={token}
                accountName={props.bootstrap?.credential?.displayName ?? null}
                accountId={props.bootstrap?.credential?.userId ?? null}
              />
            ) : view === 'messages' ? (
              <MessagesPanel baseUrl={serverUrl} token={token} onUnread={setUnread} />
            ) : view === 'enterprise' ? (
              <EnterprisePanel
                baseUrl={serverUrl}
                token={token}
                userId={userId}
                tenantId={tenantId}
              />
            ) : setupOpen ? (
              <AgentSetup
                baseUrl={serverUrl}
                token={token}
                submitting={creating}
                error={onboardingError}
                onCancel={() => setSetupOpen(false)}
                onCreate={(draft) => {
                  setCreating(true);
                  void (async () => {
                    try {
                      await props.client.createAgent(token, {
                        name: draft.name,
                        role_description: draft.roleDescription,
                        template_id: draft.templateId,
                        primary_model_id: draft.modelId,
                      });
                      const list = (await props.client.listAgents(token)) as SidebarAgent[];
                      setAgents(list);
                      setSetupOpen(false);
                    } catch (cause) {
                      setOnboardingError(cause instanceof ApiError ? cause.message : t('common.retry'));
                    } finally {
                      setCreating(false);
                    }
                  })();
                }}
              />
            ) : activeGroupId ? (
              <GroupPanel
                serverUrl={serverUrl}
                token={token}
                group={groups.find((group) => group.id === activeGroupId) ?? null}
              />
            ) : agentPanelOpen && activeAgentId ? (
              <AgentPanel
                baseUrl={serverUrl}
                token={token}
                agentId={activeAgentId}
                agentName={agents.find((agent) => agent.id === activeAgentId)?.name ?? ''}
                sessionId={activeSessionId}
              />
            ) : (
              <ChatPanel
                serverUrl={serverUrl}
                token={token}
                agentId={activeAgentId}
                sessionId={activeSessionId}
                language={props.bootstrap?.preferences.language}
                agentName={agents.find((agent) => agent.id === activeAgentId)?.name ?? ''}
                onOpenPanel={() => setAgentPanelOpen(true)}
                onCreateSession={() => void startSession()}
              />
            )}
          </main>
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={props.bootstrap?.preferences.theme ?? 'system'}
        onAppearance={(appearance) => {
          void desktopApi()?.setPreferences({ theme: appearance }).then((preferences) => {
            props.onPreferences(preferences.theme);
          });
        }}
        servers={props.serverState.servers}
        activeServerId={props.serverState.active?.id ?? null}
        onRemoveServer={(serverId) => {
          void desktopApi()?.removeServer(serverId).then((state) => {
            props.onServerState(state);
          });
        }}
        onSignOut={() => {
          void (async () => {
            await desktopApi()?.clearCredential();
            props.onSignedOut();
          })();
        }}
        accountName={props.bootstrap?.credential?.displayName ?? null}
      />

      <CreateGroupDialog
        serverUrl={serverUrl}
        token={token}
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onCreated={(group) => {
          setGroups((current) => [...current, group]);
          setActiveGroupId(group.id);
        }}
      />
    </div>
  );
}

/**
 * Whether the server already lets this session work.
 *
 * The answer comes from the surface the workspace itself calls, so the offer
 * to go in before verifying appears only when the workspace will load.
 */
async function isActive(client: ReturnType<typeof useClient>, token: string): Promise<boolean> {
  try {
    await client.listAgents(token);
    return true;
  } catch {
    return false;
  }
}

function toCredential(
  result: SignInResult,
  serverId: string,
): { serverId: string; userId: string | null; accessToken: string | null; displayName: string | null } {
  return {
    serverId,
    userId: result.user?.id ?? null,
    accessToken: result.access_token ?? null,
    displayName: result.user?.display_name ?? null,
  };
}
