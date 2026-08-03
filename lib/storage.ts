/**
 * Paprastas localStorage sluoksnis projektų/šablonų išsaugojimui.
 * V2: pakeisti tikra DB (Postgres/Supabase), kad duomenys būtų pasiekiami
 * ne tik viename naršyklės profilyje.
 */
export const storage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  delete(key: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
  listKeys(prefix: string): string[] {
    if (typeof window === 'undefined') return [];
    return Object.keys(window.localStorage).filter((k) => k.startsWith(prefix));
  },
};
