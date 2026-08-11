'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock3, FileSpreadsheet, FolderOpen, LogOut, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { Alert, Button, Card, CardContent, EmptyState, Input, Skeleton } from '@/components/ui';
import type { StoredBoqProject } from '@/lib/projects';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<StoredBoqProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/auth'); return; }
      const { data, error: queryError } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
      if (queryError) setError(queryError.message);
      else setProjects((data ?? []) as StoredBoqProject[]);
      setLoading(false);
    };
    void load();
  }, [router]);

  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    router.push('/');
  };

  const removeProject = async (project: StoredBoqProject) => {
    if (!window.confirm(`Pašalinti projektą „${project.name}“?`)) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id);
    if (deleteError) setError(deleteError.message);
    else setProjects((current) => current.filter((item) => item.id !== project.id));
  };

  const startRename = (project: StoredBoqProject) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setError('');
  };

  const renameProject = async (project: StoredBoqProject) => {
    const name = editingName.trim();
    if (!name) {
      setError('Projekto pavadinimas negali būti tuščias.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setRenamingId(project.id);
    setError('');
    const { data, error: renameError } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', project.id)
      .select('name, updated_at')
      .single();
    setRenamingId(null);
    if (renameError || !data) {
      setError('Nepavyko pakeisti projekto pavadinimo. Bandykite dar kartą.');
      return;
    }
    setProjects((current) => current.map((item) => (
      item.id === project.id ? { ...item, name: data.name, updated_at: data.updated_at } : item
    )));
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white"><ShieldCheck size={18} /></span>
            <span className="font-semibold">BidGuard</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut size={15} /> Atsijungti</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">Darbo erdvė</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Mano projektai</h1>
            <p className="mt-2 text-sm text-gray-500">Sąmatos ir patvirtinti darbų paketai vienoje vietoje.</p>
          </div>
          <Link href="/"><Button size="lg"><Plus size={18} /> Naujas sąmatos projektas</Button></Link>
        </div>

        {!isSupabaseConfigured() && <Alert variant="warning" title="Projektų saugykla dar neaktyvuota" className="mt-6">Reikia pridėti Supabase aplinkos raktus ir paleisti duomenų bazės migraciją.</Alert>}
        {error && <Alert variant="error" title="Nepavyko įkelti projektų" className="mt-6">{error}</Alert>}

        {loading ? (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((n) => <Skeleton key={n} className="h-44" />)}</div>
        ) : projects.length === 0 ? (
          <Card className="mt-7"><CardContent className="py-14"><EmptyState icon={<FolderOpen size={28} />} title="Dar nėra išsaugotų projektų" description="Importuokite pirmą sąmatą, patikrinkite pozicijas ir išsaugokite darbų paketus." action={<Link href="/"><Button>Importuoti sąmatą</Button></Link>} /></CardContent></Card>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="group transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><FileSpreadsheet size={20} /></span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => startRename(project)} aria-label={`Pervadinti ${project.name}`} className="rounded-md p-2 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-700"><Pencil size={15} /></button>
                      <button type="button" onClick={() => removeProject(project)} aria-label={`Pašalinti ${project.name}`} className="rounded-md p-2 text-gray-300 transition-colors hover:bg-danger-50 hover:text-danger-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {editingId === project.id ? (
                    <form
                      className="mt-4 space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void renameProject(project);
                      }}
                    >
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                        maxLength={120}
                        aria-label={`Naujas projekto „${project.name}“ pavadinimas`}
                        className="font-medium"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" isLoading={renamingId === project.id}>Išsaugoti</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Atšaukti</Button>
                      </div>
                    </form>
                  ) : (
                    <h2 className="mt-4 truncate font-semibold text-gray-900" title={project.name}>{project.name}</h2>
                  )}
                  <p className="mt-1 truncate text-xs text-gray-500">{project.source_file_name}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
                    <span>{project.rows.length} pozicijos</span><span>·</span><span>{project.packages.length} paketai</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400"><Clock3 size={13} /> {new Intl.DateTimeFormat('lt-LT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(project.updated_at))}</div>
                  <Link href={`/?project=${project.id}`} className="mt-5 block"><Button variant="secondary" className="w-full"><FolderOpen size={15} /> Atidaryti</Button></Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
