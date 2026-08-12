import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

export async function requireAuthenticatedUser(): Promise<User | NextResponse> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Paskyrų serveris nesukonfigūruotas.' }, { status: 503 });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: 'Prisijunkite, kad galėtumėte atlikti analizę.' }, { status: 401 });
  }
  return data.user;
}

export function rejectCrossSiteRequest(request: NextRequest): NextResponse | null {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ error: 'Užklausa atmesta.' }, { status: 403 });
  }
  return null;
}

export function checkUserRateLimit(userId: string): NextResponse | null {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || current.resetAt <= now) {
    requestWindows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Per daug analizės užklausų. Palaukite kelias minutes ir bandykite dar kartą.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  current.count += 1;
  return null;
}
