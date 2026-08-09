'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

import { Alert, Button, Card, CardContent, Input } from '@/components/ui';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const configured = isSupabaseConfigured();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Prisijungimo serveris dar nesukonfigūruotas.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/projects` },
        });
        if (signUpError) throw signUpError;
        if (data.session) router.push('/projects');
        else setNotice('Patvirtinimo nuorodą išsiuntėme el. paštu.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        router.push('/projects');
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nepavyko prisijungti. Bandykite dar kartą.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} /> Grįžti į BOQ importą
        </Link>
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <ShieldCheck size={21} />
          </span>
          <div>
            <p className="font-semibold text-gray-900">BidGuard</p>
            <p className="text-xs text-gray-500">Saugus projektų išsaugojimas</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {mode === 'login' ? 'Prisijungti' : 'Sukurti paskyrą'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {mode === 'login'
                ? 'Pasiekite savo BOQ projektus ir darbų paketus.'
                : 'Išsaugokite projektus saugiai ir pasiekite juos iš kito įrenginio.'}
            </p>

            {!configured && (
              <Alert variant="warning" title="Reikalinga serverio konfigūracija" className="mt-5">
                Prisijungimas bus aktyvus įdiegus Supabase aplinkos raktus.
              </Alert>
            )}
            {error && <Alert variant="error" title="Nepavyko" className="mt-5">{error}</Alert>}
            {notice && <Alert variant="success" title="Patikrinkite el. paštą" className="mt-5">{notice}</Alert>}

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-700">El. paštas</span>
                <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail size={16} />} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-700">Slaptažodis</span>
                <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<LockKeyhole size={16} />} />
                {mode === 'register' && <span className="mt-1.5 block text-xs text-gray-400">Mažiausiai 8 simboliai.</span>}
              </label>
              <Button type="submit" size="lg" isLoading={loading} disabled={!configured} className="w-full">
                {mode === 'login' ? 'Prisijungti' : 'Registruotis'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              {mode === 'login' ? 'Dar neturite paskyros?' : 'Jau turite paskyrą?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice(''); }} className="font-medium text-primary-600 hover:text-primary-700">
                {mode === 'login' ? 'Registruotis' : 'Prisijungti'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
