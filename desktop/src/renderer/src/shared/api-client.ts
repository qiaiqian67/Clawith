import { useMemo } from 'react';

import { activeServerUrl } from '../shared/bridge';
import { apiRequest, ApiError } from '../shared/http';
import type { ServerState } from '../shared/contract';

/**
 * The client of the sign-in surface of the API.
 *
 * One owner for the base address: the active server. A call names a path
 * under `/api`, and the client resolves it against that address. A failure
 * carries the status code, so the interface can tell a wrong code from a
 * server that is not there.
 */

export { ApiError };

export interface SignInResult {
  access_token: string;
  user: {
    id: string;
    email: string | null;
    display_name: string;
    role: string;
    tenant_id: string | null;
  };
  needs_company_setup: boolean;
}

export interface TenantChoice {
  tenant_id: string | null;
  tenant_name: string;
  tenant_slug: string;
  logo_url: string | null;
}

export interface MultiTenantResult {
  requires_tenant_selection: true;
  login_identifier: string;
  tenants: TenantChoice[];
}

export class ZeroXClient {
  private readonly serverState: ServerState;

  constructor(serverState: ServerState) {
    this.serverState = serverState;
  }

  /** The address of the API on the active server. */
  get baseUrl(): string {
    return `${activeServerUrl(this.serverState)}/api`;
  }

  private request<T>(path: string, options: { method?: 'GET' | 'POST'; body?: string; token?: string } = {}): Promise<T> {
    return apiRequest<T>(`${this.baseUrl}${path}`, {
      method: options.method,
      body: options.body,
      token: options.token,
    });
  }

  /** Ask the server for a one-time sign-in code. */
  async requestLoginCode(email: string): Promise<void> {
    await this.request('/auth/login/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** Create an account, and sign in with it. */
  async register(input: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<SignInResult & { needsVerification: boolean }> {
    const created = await apiRequest<{
      access_token: string;
      user: SignInResult['user'] & { email_verified?: boolean };
      needs_company_setup: boolean;
    }>(`${this.baseUrl}/auth/register/init`, {
      method: 'POST',
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        password: input.password,
        display_name: input.displayName ?? null,
      }),
    });
    return {
      access_token: created.access_token,
      user: created.user,
      needs_company_setup: created.needs_company_setup ?? true,
      // The server mails a code to every new address, so an unverified
      // account has to name that code before it can do anything.
      needsVerification: created.user?.email_verified === false,
    };
  }

  /**
   * Verify the address of a new account with the code the server mailed.
   *
   * The answer is a session for the account, so the client signs in with the
   * code instead of asking for another one.
   */
  async verifyEmail(code: string): Promise<SignInResult> {
    const verified = await apiRequest<{
      access_token: string;
      user: SignInResult['user'];
      needs_company_setup?: boolean;
    }>(`${this.baseUrl}/auth/verify-email`, {
      method: 'POST',
      body: JSON.stringify({ token: code.trim() }),
    });
    return {
      access_token: verified.access_token,
      user: verified.user,
      needs_company_setup: verified.needs_company_setup ?? false,
    };
  }

  /** Ask the server to mail a new verification code. */
  async resendVerification(email: string): Promise<void> {
    await apiRequest<unknown>(`${this.baseUrl}/auth/resend-verification`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** Ask the server to mail a link that resets the password. */
  async forgotPassword(email: string): Promise<void> {
    await apiRequest<unknown>(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** Set a new password with the token of that link. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiRequest<unknown>(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  }

  /** Whether the server asks for an invitation code to create an account. */
  async registrationConfig(): Promise<{ invitation_code_required: boolean }> {
    try {
      return await apiRequest<{ invitation_code_required: boolean }>(
        `${this.baseUrl}/auth/registration-config`,
      );
    } catch {
      return { invitation_code_required: false };
    }
  }

  /** Redeem a one-time sign-in code. */
  async verifyLoginCode(email: string, code: string): Promise<SignInResult | MultiTenantResult> {
    return this.request<SignInResult | MultiTenantResult>('/auth/login/code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  /** Redeem a one-time sign-in code for one organization. */
  async verifyLoginCodeForTenant(
    email: string,
    code: string,
    tenantId: string,
  ): Promise<SignInResult> {
    return this.request<SignInResult>('/auth/login/code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, tenant_id: tenantId }),
    });
  }

  /** Read the signed-in user. */
  async me(token: string): Promise<SignInResult['user']> {
    return this.request<SignInResult['user']>('/auth/me', { token });
  }

  /** List the organizations of the signed-in account. */
  async myTenants(token: string): Promise<TenantChoice[]> {
    return this.request<TenantChoice[]>('/auth/my-tenants', { token });
  }

  /** Switch to another organization and get a token for it. */
  async switchTenant(token: string, tenantId: string): Promise<{ access_token: string }> {
    return this.request<{ access_token: string }>('/auth/switch-tenant', {
      method: 'POST',
      token,
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  }

  /** The list of agents of the organization. */
  async listAgents(token: string): Promise<unknown[]> {
    return this.request<unknown[]>('/agents/', { token });
  }

  /** The agent templates the organization can start from. */
  async listAgentTemplates(
    token: string,
  ): Promise<
    Array<{ id: string; name: string; description: string; icon: string; category: string }>
  > {
    return this.request('/agents/templates', { token });
  }

  /** Create an agent. */
  async createAgent(token: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.request('/agents/', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    });
  }
}

export function useClient(serverState: ServerState): ZeroXClient {
  return useMemo(() => new ZeroXClient(serverState), [serverState]);
}
