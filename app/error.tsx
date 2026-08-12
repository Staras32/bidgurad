'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    const pathname = window.location.pathname;
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message.slice(0, 300),
        digest: error.digest?.slice(0, 100),
        pathname,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
          <AlertTriangle size={22} aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-gray-950">Nepavyko atlikti veiksmo</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Klaida užregistruota. Pabandykite veiksmą pakartoti — jūsų išsaugoti projektai nebuvo ištrinti.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
            <RotateCcw size={15} aria-hidden /> Bandyti dar kartą
          </button>
          <Link href="/" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            Grįžti į pradžią
          </Link>
        </div>
      </div>
    </main>
  );
}
