'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PrivacyAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    void fetch('/api/page-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
