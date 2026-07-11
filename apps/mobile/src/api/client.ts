import type {
  AuthTokenResponse,
  CreateExpense,
  UpdateExpense,
  CreateSettlement,
  FeedResponse,
  Friend,
  NotificationList,
  Expense,
  Group,
  GroupBalances,
  GroupDetail,
  HealthResponse,
  OtpRequestResponse,
  Settlement,
  UpdateProfile,
  User,
} from '@aphno/shared';
import { storage } from '../lib/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

const TOKEN_KEY = 'aphno.token';

export const auth = {
  token: storage.get(TOKEN_KEY),
  set(token: string) {
    this.token = token;
    storage.set(TOKEN_KEY, token);
  },
  clear() {
    this.token = null;
    storage.remove(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      // Only set a JSON content-type when there's actually a body — otherwise
      // Fastify rejects bodyless DELETE/POST with FST_ERR_CTP_EMPTY_JSON_BODY.
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export const api = {
  health: () => request<HealthResponse>('GET', '/v1/health'),

  // auth
  requestOtp: (phone: string) =>
    request<OtpRequestResponse>('POST', '/v1/auth/otp/request', { phone }),
  verifyOtp: (phone: string, code: string) =>
    request<AuthTokenResponse>('POST', '/v1/auth/otp/verify', { phone, code }),
  googleAuth: (idToken: string) =>
    request<AuthTokenResponse>('POST', '/v1/auth/google', { idToken }),

  // users
  me: () => request<User>('GET', '/v1/users/me'),
  updateMe: (patch: UpdateProfile) => request<User>('PATCH', '/v1/users/me', patch),

  // groups
  listGroups: () => request<Group[]>('GET', '/v1/groups'),
  createGroup: (name: string, memberPhones?: string[]) =>
    request<GroupDetail>('POST', '/v1/groups', { name, memberPhones }),
  getGroup: (id: string) => request<GroupDetail>('GET', `/v1/groups/${id}`),
  addMember: (id: string, phone: string, name?: string) =>
    request<GroupDetail>('POST', `/v1/groups/${id}/members`, { phone, name }),
  balances: (id: string) => request<GroupBalances>('GET', `/v1/groups/${id}/balances`),

  // expenses
  listExpenses: (groupId: string) => request<Expense[]>('GET', `/v1/groups/${groupId}/expenses`),
  addExpense: (groupId: string, body: CreateExpense) =>
    request<Expense>('POST', `/v1/groups/${groupId}/expenses`, body),
  updateExpense: (id: string, body: UpdateExpense) =>
    request<Expense>('PATCH', `/v1/expenses/${id}`, body),
  deleteExpense: (id: string) => request<void>('DELETE', `/v1/expenses/${id}`),

  // settlements
  listSettlements: (groupId: string) =>
    request<Settlement[]>('GET', `/v1/groups/${groupId}/settlements`),
  createSettlement: (groupId: string, body: CreateSettlement) =>
    request<Settlement>('POST', `/v1/groups/${groupId}/settlements`, body),
  completeSettlement: (id: string, upiTxnRef?: string) =>
    request<Settlement>('POST', `/v1/settlements/${id}/complete`, { upiTxnRef }),

  // friends (1-on-1)
  friends: () => request<Friend[]>('GET', '/v1/friends'),
  addFriend: (phone: string, name?: string) =>
    request<Friend>('POST', '/v1/friends', name ? { phone, name } : { phone }),

  // feed
  feed: (limit = 40) => request<FeedResponse>('GET', `/v1/feed?limit=${limit}`),

  // notifications
  notifications: (limit = 50) =>
    request<NotificationList>('GET', `/v1/notifications?limit=${limit}`),
  markNotificationsRead: (ids?: string[]) =>
    request<{ updated: number }>('POST', '/v1/notifications/read', ids ? { ids } : {}),
};

// WebSocket URL for the real-time channel (http→ws, https→wss).
export const wsUrl = () => `${BASE_URL.replace(/^http/, 'ws')}/v1/ws`;

// ₹ formatting helpers (amounts are integer paise).
export const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
export const toPaise = (rupeeStr: string) => Math.round(parseFloat(rupeeStr) * 100);
