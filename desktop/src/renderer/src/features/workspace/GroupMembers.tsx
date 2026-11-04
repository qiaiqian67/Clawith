import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createGroup,
  inviteGroupMember,
  listGroupMembers,
  listMemberCandidates,
  removeGroupMember,
  type Group,
  type GroupMember,
  type GroupMemberCandidate,
} from '../../shared/groups.ts';
import './group-members.css';

/**
 * The creation of a group and the members of one.
 *
 * The server owns the groups. The dialog names a group and its first members;
 * the roster shows who is in it and lets a member be invited or removed.
 */

export interface CreateGroupDialogProps {
  serverUrl: string;
  token: string | null;
  open: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}

export function CreateGroupDialog(props: CreateGroupDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [candidates, setCandidates] = useState<GroupMemberCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open || !props.token) return;
    let cancelled = false;
    void (async () => {
      const [users, agents] = await Promise.all([
        listMemberCandidates(props.serverUrl, props.token!, 'user'),
        listMemberCandidates(props.serverUrl, props.token!, 'agent'),
      ]);
      if (cancelled) return;
      setCandidates([...users, ...agents]);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.serverUrl, props.token]);

  const toggle = useCallback((participantId: string) => {
    setSelected((current) =>
      current.includes(participantId)
        ? current.filter((item) => item !== participantId)
        : [...current, participantId],
    );
  }, []);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || !props.token) return;
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(props.serverUrl, props.token, {
        name: trimmed,
        memberParticipantIds: selected,
      });
      props.onCreated(group);
      setName('');
      setSelected([]);
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [name, props, selected, t]);

  if (!props.open) return null;

  return (
    <div className="zx-dialog-scrim" onClick={props.onClose}>
      <div className="zx-dialog" onClick={(event) => event.stopPropagation()}>
        <h2 className="zx-dialog-title">{t('group.createTitle')}</h2>

        <label className="zx-field">
          <span className="zx-field-label">{t('group.name')}</span>
          <input
            className="zx-field-input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className="zx-member-picker">
          <span className="zx-field-label">{t('group.members')}</span>
          {candidates.length === 0 ? (
            <p className="zx-member-empty">{t('group.noCandidates')}</p>
          ) : (
            <ul className="zx-member-list">
              {candidates.map((candidate) => (
                <li key={candidate.participant_id}>
                  <button
                    type="button"
                    className="zx-member-choice"
                    data-selected={selected.includes(candidate.participant_id) ? 'true' : undefined}
                    onClick={() => toggle(candidate.participant_id)}
                  >
                    <span className="zx-member-type" data-type={candidate.participant_type}>
                      {candidate.participant_type === 'agent' ? 'A' : 'U'}
                    </span>
                    <span className="zx-member-name">{candidate.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="zx-dialog-error">{error}</p> : null}

        <div className="zx-dialog-actions">
          <button type="button" className="zx-button-ghost" onClick={props.onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="zx-button-primary"
            disabled={!name.trim() || busy}
            onClick={() => void submit()}
          >
            {busy ? t('common.loading') : t('group.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface GroupRosterProps {
  serverUrl: string;
  token: string | null;
  groupId: string;
}

export function GroupRoster(props: GroupRosterProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [candidates, setCandidates] = useState<GroupMemberCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!props.token) return;
    const list = await listGroupMembers(props.serverUrl, props.token, props.groupId);
    setMembers(list);
  }, [props.groupId, props.serverUrl, props.token]);

  // The first load is a request to the server, so the state changes when
  // the answer arrives and not while the effect runs.
  useEffect(() => {
    if (!props.token) return;
    const token = props.token;
    let cancelled = false;
    void (async () => {
      const [roster, users, agents] = await Promise.all([
        listGroupMembers(props.serverUrl, token, props.groupId),
        listMemberCandidates(props.serverUrl, token, 'user'),
        listMemberCandidates(props.serverUrl, token, 'agent'),
      ]);
      if (cancelled) return;
      setMembers(roster);
      setCandidates([...users, ...agents]);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.groupId, props.serverUrl, props.token]);

  const available = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          !members.some((member) => member.participant_id === candidate.participant_id),
      ),
    [candidates, members],
  );

  const invite = useCallback(
    async (participantId: string) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await inviteGroupMember(props.serverUrl, props.token, props.groupId, participantId);
        await reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [props, reload, t],
  );

  const remove = useCallback(
    async (memberId: string) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await removeGroupMember(props.serverUrl, props.token, props.groupId, memberId);
        await reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [props, reload, t],
  );

  return (
    <section className="zx-roster" aria-label={t('group.members')}>
      <h2 className="zx-roster-title">{t('group.members')}</h2>

      <ul className="zx-roster-list">
        {members.map((member) => (
          <li key={member.id} className="zx-roster-row">
            <span className="zx-member-type" data-type={member.participant_type}>
              {member.participant_type === 'agent' ? 'A' : 'U'}
            </span>
            <span className="zx-roster-name">{member.display_name}</span>
            {member.role === 'owner' ? (
              <span className="zx-roster-role">{t('group.owner')}</span>
            ) : null}
            <button
              type="button"
              className="zx-roster-remove"
              disabled={busy}
              aria-label={t('group.removeMember')}
              onClick={() => void remove(member.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {available.length > 0 ? (
        <div className="zx-roster-add">
          <span className="zx-field-label">{t('group.addMember')}</span>
          <ul className="zx-roster-candidates">
            {available.slice(0, 12).map((candidate) => (
              <li key={candidate.participant_id}>
                <button
                  type="button"
                  className="zx-roster-add-button"
                  disabled={busy}
                  onClick={() => void invite(candidate.participant_id)}
                >
                  + {candidate.display_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="zx-dialog-error">{error}</p> : null}
    </section>
  );
}
