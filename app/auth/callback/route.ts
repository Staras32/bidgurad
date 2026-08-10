import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/projects';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL('/auth?error=config', url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL('/auth?error=link', url.origin));
}
