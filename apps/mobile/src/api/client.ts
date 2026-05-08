import { HealthResponseSchema, type HealthResponse } from '@aphno/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/v1/health`);
  if (!res.ok) throw new Error(`health failed: ${res.status}`);
  const json = await res.json();
  return HealthResponseSchema.parse(json);
}
