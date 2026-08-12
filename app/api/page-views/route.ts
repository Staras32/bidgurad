import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (Number(request.headers.get('content-length') ?? 0) > 500) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  try {
    const body = (await request.json()) as { pathname?: unknown };
    const pathname = typeof body.pathname === 'string' ? body.pathname.split('?')[0].slice(0, 160) : '';
    if (!pathname.startsWith('/')) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Deliberately log only the route and time: no cookie, IP, account ID,
    // query string, document name, or imported content is retained here.
    console.info('[page-view]', { pathname, occurredAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
