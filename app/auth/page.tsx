'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

import { Alert, Button, Card, CardContent, Input } from '@/components/ui';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

function safeNextPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/projects';
}

function authErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'Neteisingas el. paštas arba slaptažodis.';
  if (message.includes('email not confirmed')) return 'Pirmiausia patvirtinkite el. pašto adresą.';
  if (message.includes('user already registered')) return 'Paskyra su šiuo el. paštu jau sukurta.';
  if (message.includes('password should be') || message.includes('weak password')) return 'Slaptažodis neatitinka saugumo reikalavimų.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Per daug bandymų. Palaukite kelias minutes ir bandykite dar kartą.';
  if (message.includes('session missing') || message.includes('invalid token')) return 'Nuoroda nebegalioja. Užsisakykite naują slaptažodžio atkūrimo laišką.';
  return 'Veiksmo atlikti nepavyko. Patikrinkite duomenis ir bandykite dar kartą.';
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nextPath, setNextPath] = useState('/projects');
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get('mode');
    const next = safeNextPath(params.get('next'));
    setNextPath(next);
    if (requestedMode === 'reset') setMode('reset');
    if (params.get('error') === 'link') setError('Patvirtinimo nuoroda nebegalioja arba jau buvo panaudota.');
    if (params.get('error') === 'config') setError('Prisijungimo serveris dar nesukonfigūruotas.');

    const supabase = getSupabaseBrowserClient();
    if (!supabase || requestedMode === 'reset') {
      setInitializing(false);
      return;
    }

    let active = true;
    const checkUser = async () => {
      const response = await supabase.auth.getUser();
      if (!active) return;
      if (response.data.user) router.replace(next);
      else setInitializing(false);
    };
    void checkUser();
    return () => { active = false; };
  }, [router]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setPasswordConfirmation('');
    setShowPassword(false);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Prisijungimo serveris dar nesukonfigūruotas.');
      return;
    }

    if ((mode === 'register' || mode === 'reset') && password !== passwordConfirmation) {
      setError('Slaptažodžiai nesutampa.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const callback = new URL('/auth/callback', window.location.origin);
        callback.searchParams.set('next', nextPath);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callback.toString() },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push(nextPath);
          router.refresh();
        } else {
          setNotice('Patvirtinimo nuorodą išsiuntėme el. paštu. Atidarykite ją šiame įrenginyje.');
        }
      } else if (mode === 'forgot') {
        const callback = new URL('/auth/callback', window.location.origin);
        callback.searchParams.set('next', '/auth?mode=reset');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: callback.toString(),
        });
        if (resetError) throw resetError;
        setNotice('Jei paskyra egzistuoja, slaptažodžio atkūrimo nuorodą išsiuntėme el. paštu.');
      } else if (mode === 'reset') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice('Slaptažodis atnaujintas. Nukreipiame į projektus…');
        window.setTimeout(() => {
          router.push('/projects');
          router.refresh();
        }, 700);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.push(nextPath);
        router.refresh();
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'login'
    ? 'Prisijungti'
    : mode === 'register'
      ? 'Sukurti paskyrą'
      : mode === 'forgot'
        ? 'Atkurti slaptažodį'
        : 'Naujas slaptažodis';

  const description = mode === 'login'
    ? 'Pasiekite savo darbų kiekių žiniaraščius ir darbų paketus.'
    : mode === 'register'
      ? 'Išsaugokite projektus saugiai ir pasiekite juos iš kito įrenginio.'
      : mode === 'forgot'
        ? 'Įveskite paskyros el. paštą — atsiųsime saugią atkūrimo nuorodą.'
        : 'Sukurkite naują, tik šiai paskyrai naudojamą slaptažodį.';

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
        <div className="flex items-center gap-3 text-sm text-gray-500" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
          Tikrinama sesija…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft size={16} /> Grįžti į žiniaraščio importą
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
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>

            {!configured && (
              <Alert variant="warning" title="Prisijungimas ruošiamas" className="mt-5">
                Paskyrų serveris dar neprijungtas. Žiniaraščio importu galite naudotis be paskyros.
              </Alert>
            )}
            {error && <Alert variant="error" title="Nepavyko" className="mt-5">{error}</Alert>}
            {notice && <Alert variant="success" title="Atlikta" className="mt-5">{notice}</Alert>}

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
              {mode !== 'reset' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-700">El. paštas</span>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="vardas@imone.lt"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    leftIcon={<Mail size={16} />}
                  />
                </label>
              )}

              {mode !== 'forgot' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-700">
                    {mode === 'reset' ? 'Naujas slaptažodis' : 'Slaptažodis'}
                  </span>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    leftIcon={mode === 'reset' ? <KeyRound size={16} /> : <LockKeyhole size={16} />}
                    rightIcon={(
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį'}
                        className="rounded text-gray-400 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  />
                  {(mode === 'register' || mode === 'reset') && (
                    <span className="mt-1.5 block text-xs text-gray-400">Mažiausiai 8 simboliai.</span>
                  )}
                </label>
              )}

              {(mode === 'register' || mode === 'reset') && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-700">Pakartokite slaptažodį</span>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    leftIcon={<LockKeyhole size={16} />}
                  />
                </label>
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => changeMode('forgot')} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                    Pamiršote slaptažodį?
                  </button>
                </div>
              )}

              <Button type="submit" size="lg" isLoading={loading} disabled={!configured || Boolean(notice)} className="w-full">
                {mode === 'login' ? 'Prisijungti' : mode === 'register' ? 'Registruotis' : mode === 'forgot' ? 'Siųsti atkūrimo nuorodą' : 'Išsaugoti slaptažodį'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              {mode === 'login' ? 'Dar neturite paskyros?' : mode === 'register' ? 'Jau turite paskyrą?' : 'Prisiminėte slaptažodį?'}{' '}
              <button
                type="button"
                onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                {mode === 'login' ? 'Registruotis' : 'Prisijungti'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
