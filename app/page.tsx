'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Bell, CheckCircle2, ChevronDown, FileSpreadsheet, FolderKanban, LayoutDashboard, ListChecks, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import './dashboard.css';

const positions = [
  { code: '1.1', name: 'Statybvietės paruošimas', unit: 'kompl.', qty: 1, price: 1800, status: 'ok' },
  { code: '1.2', name: 'Ašių nužymėjimas ir geodezija', unit: 'kompl.', qty: 1, price: 760, status: 'ok' },
  { code: '2.1', name: 'Grunto kasimas iki projektinės altitudės', unit: 'm³', qty: 485, price: 9, status: 'risk' },
  { code: '2.2', name: 'Smėlio pagrindo įrengimas ir tankinimas', unit: 'm³', qty: 216, price: 25.5, status: 'ok' },
  { code: '3.1', name: 'Monolitiniai gelžbetonio pamatai C25/30', unit: 'm³', qty: 138, price: 188, status: 'risk' },
  { code: '3.2', name: 'Armatūros karkasų montavimas B500B', unit: 't', qty: 18.6, price: 228, status: 'missing' },
  { code: '4.1', name: 'Išorės sienų mūras 250 mm', unit: 'm²', qty: 624, price: 58.3, status: 'ok' },
];

const euro = (value: number) => new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'risk'>('all');
  const [margin, setMargin] = useState(14);
  const [selected, setSelected] = useState(4);
  const visible = useMemo(() => positions.filter((row) => {
    const filterMatch = filter === 'all' || (filter === 'risk' ? row.status !== 'ok' : row.status === 'ok');
    return filterMatch && `${row.code} ${row.name}`.toLowerCase().includes(query.toLowerCase());
  }), [filter, query]);
  const direct = 268400;
  const total = direct * (1 + margin / 100);
  const active = positions[selected] ?? positions[0];

  return <div className="bg-app">
    <header className="bg-topbar">
      <Link href="/" className="bg-brand"><span className="bg-logo"><ShieldCheck size={17} /></span>BidGuard</Link>
      <button className="bg-project"><span /> Verslo centro „Neris“ statyba <ChevronDown size={14} /></button>
      <div className="bg-profile"><button aria-label="Pranešimai"><Bell size={17} /></button><span>MS</span></div>
    </header>
    <aside className="bg-sidebar">
      <Link href="/new-project" className="bg-new"><Plus size={16} /> Naujas projektas</Link>
      <p>Darbo erdvė</p><nav>
        <Link href="/" className="active"><LayoutDashboard size={16} /> Apžvalga</Link>
        <Link href="/new-project"><FileSpreadsheet size={16} /> BOQ importas</Link>
        <Link href="/supplier-quotes"><BarChart3 size={16} /> Rizikos analizė <b>3</b></Link>
        <a href="#estimate"><ListChecks size={16} /> Sąmata</a>
      </nav><p>Projektas</p><nav>
        <a href="#"><FolderKanban size={16} /> Dokumentai</a><a href="#"><Users size={16} /> Komanda</a><a href="#"><Settings size={16} /> Nustatymai</a>
      </nav><div className="bg-saved"><span /><div><strong>Automatiškai išsaugota</strong><small>prieš 12 sek.</small></div></div>
    </aside>
    <main className="bg-main">
      <section className="bg-heading"><div><p>Projektai / Verslo centras „Neris“ / <strong>Apžvalga</strong></p><h1>Konkursinė sąmata</h1><span>BOQ-2026-014 · Įkelta 2026-08-09 · 127 pozicijos</span></div><div><Link href="/new-project" className="bg-button secondary"><FileSpreadsheet size={15} /> Keisti BOQ</Link><Link href="/supplier-quotes" className="bg-button primary"><ShieldCheck size={15} /> Analizuoti pasiūlymus</Link></div></section>
      <section className="bg-metrics">
        <article><label>Tiesioginės sąnaudos</label><strong>{euro(direct)}</strong><small><i>↑ 2,4%</i> nuo pradinio BOQ</small></article>
        <article><label>Antkainis</label><div className="bg-margin"><strong>{margin}%</strong><input aria-label="Antkainis" type="range" min="5" max="25" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></div><small>{euro(total - direct)} projekto marža</small></article>
        <article className="highlight"><label>Pasiūlymo vertė</label><strong>{euro(total)}</strong><small>be PVM · 284 € / m²</small></article>
        <article className="attention"><label>Reikia dėmesio</label><strong><span>3</span> pozicijos</strong><small>Galima įtaka: <b>+18 400 €</b></small></article>
      </section>
      <section className="bg-table-card" id="estimate"><div className="bg-toolbar"><div className="bg-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Visos</button><button className={filter === 'ok' ? 'active' : ''} onClick={() => setFilter('ok')}>Patikrintos</button><button className={filter === 'risk' ? 'active' : ''} onClick={() => setFilter('risk')}>Rizikos <span>3</span></button>
      </div><div className="bg-tools"><label><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ieškoti pozicijos..." /></label><button aria-label="Filtrai"><SlidersHorizontal size={15} /></button><Link href="/new-project"><Plus size={14} /> Pridėti pozicijas</Link></div></div>
      <div className="bg-table-wrap"><table><thead><tr><th>Kodas</th><th>Darbų pavadinimas</th><th>Vnt.</th><th>Kiekis</th><th>Vieneto kaina</th><th>Suma</th><th>Būsena</th></tr></thead><tbody><tr className="bg-group"><td colSpan={7}><ChevronDown size={14} /><strong>01</strong> Statybos darbai <span>7 pozicijos</span><b>{euro(82340)}</b></td></tr>
      {visible.map((row) => { const index = positions.indexOf(row); return <tr key={row.code} className={selected === index ? 'selected' : ''} onClick={() => setSelected(index)}><td>{row.code}</td><td><strong>{row.name}</strong>{row.status === 'risk' && <small>AI aptiko kainos nuokrypį</small>}</td><td>{row.unit}</td><td>{row.qty.toLocaleString('lt-LT')}</td><td>{row.price.toLocaleString('lt-LT')} €</td><td><b>{euro(row.qty * row.price)}</b></td><td>{row.status === 'ok' ? <span className="bg-status ok"><CheckCircle2 size={12} /> Patikrinta</span> : row.status === 'risk' ? <span className="bg-status risk"><AlertTriangle size={12} /> Rizika</span> : <span className="bg-status missing">○ Trūksta kainos</span>}</td></tr>})}</tbody></table></div><footer>Rodoma {visible.length} iš 127 pozicijų <span>1 / 13</span></footer></section>
    </main>
    <aside className="bg-inspector"><div className="bg-inspector-title"><small>Pozicija {active.code}</small><h2>{active.name}</h2></div><div className="bg-ai"><ShieldCheck size={18} /><div><strong>BidGuard įžvalga</strong><p>Šios pozicijos kaina yra <b>11,8% aukštesnė</b> nei panašiuose 2026 m. projektuose.</p><Link href="/supplier-quotes">Palyginti rinkos kainas →</Link></div></div><section><h3>Kainos sudėtis</h3><div className="bg-price"><span>Medžiagos</span><strong>{euro(active.price * .72)}</strong></div><div className="bg-bar"><i /></div><div className="bg-price"><span>Darbas</span><strong>{euro(active.price * .28)}</strong></div><div className="bg-bar labor"><i /></div><div className="bg-unit"><span>Vieneto kaina</span><strong>{euro(active.price)}</strong></div></section><section><h3>Rizikos veiksniai <span>2</span></h3><div className="bg-risk"><i>!</i><div><strong>Kainos nuokrypis</strong><p>+11,8% nuo rinkos medianos</p></div></div><div className="bg-risk blue"><i>i</i><div><strong>Didelis kiekis</strong><p>Patikrinkite kiekių žiniaraštį</p></div></div></section><section><h3>Pastabos</h3><textarea defaultValue="Patikrinti tiekėjo pasiūlymą ir transportavimo kainą." /><button>Išsaugoti pastabą</button></section></aside>
  </div>;
}
