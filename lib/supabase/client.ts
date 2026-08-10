'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicConfig, isSupabaseConfigured } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.key);
  }

  return browserClient;
}

export { isSupabaseConfigured };
