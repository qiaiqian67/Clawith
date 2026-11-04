import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listApprovals,
  resolveApproval,
  type ApprovalRequest,
} from '../../shared/approvals.ts';
import './approval-banner.css';

/**
 * The approvals of one Agent, as a banner.
 *
 * An Agent that needs a decision stops and waits. The banner is the one place
 * the user sees that, so the Agent never waits without a way to answer.
 */

export interface ApprovalBannerProps {
  baseUrl: string;
  token: string | null;
  agentId: string | null;
}

export function ApprovalBanner(props: ApprovalBannerProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!props.token || !props.agentId) {
      setPending([]);
      return;
    }
    const list = await listApprovals(props.baseUrl, props.token, props.agentId, 'pending');
    setPending(list);
  }, [props.agentId, props.baseUrl, props.token]);

  useEffect(() => {
    // The list is a request to the server, so the state changes when the
    // answer arrives and not while the effect runs.
    const timer = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  const answer = useCallback(
    async (approval: ApprovalRequest, action: 'approve' | 'reject') => {
      if (!props.token || !props.agentId) return;
      setBusy(true);
      try {
        await resolveApproval(props.baseUrl, props.token, props.agentId, approval.id, action);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load, props],
  );

  if (pending.length === 0) {
    return null;
  }

  const first = pending[0];

  return (
    <div className="zx-approval-banner" role="alert">
      <div className="zx-approval-text">
        <strong>{t('approvals.title')}</strong>
        <span className="zx-approval-detail">
          {first.action_type}
          {first.details ? ` · ${first.details}` : ''}
        </span>
      </div>
      <div className="zx-approval-actions">
        <button
          type="button"
          className="zx-button-primary"
          disabled={busy}
          onClick={() => void answer(first, 'approve')}
        >
          {t('approvals.approve')}
        </button>
        <button
          type="button"
          className="zx-button-ghost"
          disabled={busy}
          onClick={() => void answer(first, 'reject')}
        >
          {t('approvals.reject')}
        </button>
      </div>
    </div>
  );
}
