import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Package, Warehouse, Truck, ArrowLeftRight, ClipboardList,
  History, AlertTriangle, Users, FileDown, Save, Search, Plus, Trash2,
  Edit2, X, Check, Upload, Download, ScanLine, ChevronDown, RotateCcw,
  ShieldCheck, Menu
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

/* ============================== COSTANTI ============================== */

const WAREHOUSES = [
  { id: 'generale', label: 'Magazzino Generale', short: 'Generale' },
  { id: 'padel', label: 'Chiosco Padel', short: 'Padel' },
  { id: 'tennis', label: 'Chiosco Tennis', short: 'Tennis' },
  { id: 'circolo', label: 'Chiosco Circolo', short: 'Circolo' },
  { id: 'shop', label: 'Chiosco Shop', short: 'Shop' },
];

const WH_MAP = Object.fromEntries(WAREHOUSES.map(w => [w.id, w]));

const MOV_LABELS = {
  carico: 'Carico',
  trasferimento: 'Trasferimento',
  rettifica: 'Rettifica Inventario',
  rettifica_carico: 'Correzione Carico',
  scarico: 'Scarico',
};

const COLORS = {
  verde: '#16a34a', giallo: '#ca8a04', rosso: '#dc2626', esaurito: '#6b7280'
};

const CHART_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#0891b2', '#65a30d', '#db2777'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowStr = () => new Date().toLocaleString('it-IT');
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtNum = (n) => (Number(n) || 0).toLocaleString('it-IT');

function stockKey(wh, articleId) { return `${wh}:${articleId}`; }

function emptyDB() {
  return {
    version: 1,
    articles: [],   // {id, codice, ean, descrizione, categoria, sottocategoria, marca, unita, prezzoAcquisto, prezzoVendita, scortaMinima, scortaConsigliata, fornitoreId, note, attivo}
    suppliers: [],  // {id, nome, piva, contatti, note, attivo}
    stock: {},      // "wh:articleId" -> qty
    movements: [],  // {id, date, type, articleId, wh, whFrom, whTo, qty, note, documento, fornitoreId, prezzoAcquisto, refId, createdAt}
    inventories: [], // {id, date, wh, note, items:[{articleId, teorica, reale, diff}], createdAt}
  };
}

function getStatus(qty, minimo, consigliata) {
  const min = Number(minimo) || 0;
  if (qty <= 0) return 'esaurito';
  if (qty < min) return 'rosso';
  const soglia = min > 0 ? min * 1.2 : (Number(consigliata) || min) * 0.5;
  if (qty <= soglia) return 'giallo';
  return 'verde';
}

const STATUS_LABEL = { verde: 'OK', giallo: 'In esaurimento', rosso: 'Sotto minimo', esaurito: 'Esaurito' };

/* ============================== APP ROOT ============================== */

export default function GestionaleMagazzino() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  /* -------- load -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('gestionale-db', false);
        setDb(res && res.value ? { ...emptyDB(), ...JSON.parse(res.value) } : emptyDB());
      } catch (e) {
        setDb(emptyDB());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, id: uid() });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3200);
  }, []);

  const persist = useCallback(async (next) => {
    setDb(next);
    setSaving(true);
    try {
      const ok = await window.storage.set('gestionale-db', JSON.stringify(next), false);
      if (!ok) showToast('Errore nel salvataggio dei dati', 'error');
    } catch (e) {
      showToast('Errore nel salvataggio dei dati', 'error');
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  const askConfirm = useCallback((message, onConfirm, danger = true) => {
    setConfirmState({ message, onConfirm, danger });
  }, []);

  if (loading || !db) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-500 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm">Caricamento dati magazzino...</span>
        </div>
      </div>
    );
  }

  const ctx = { db, persist, showToast, askConfirm };

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'articoli', label: 'Articoli', icon: Package },
    { id: 'magazzino', label: 'Magazzino', icon: Warehouse },
    { id: 'carichi', label: 'Carichi', icon: Truck },
    { id: 'trasferimenti', label: 'Trasferimenti', icon: ArrowLeftRight },
    { id: 'inventario', label: 'Inventario', icon: ClipboardList },
    { id: 'movimenti', label: 'Movimenti', icon: History },
    { id: 'riordino', label: 'Riordino', icon: AlertTriangle },
    { id: 'fornitori', label: 'Fornitori', icon: Users },
    { id: 'backup', label: 'Report & Backup', icon: Save },
  ];

  return (
    <div className="w-full h-full min-h-[700px] bg-slate-100 text-slate-800 font-sans flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button className="md:hidden p-1.5 rounded hover:bg-slate-700" onClick={() => setNavOpen(v => !v)}>
            <Menu size={20} />
          </button>
          <Warehouse size={20} className="text-blue-400" />
          <div>
            <div className="font-semibold text-sm leading-tight">Gestionale Magazzino Circolo</div>
            <div className="text-[11px] text-slate-400 leading-tight">Bar &amp; Chioschi</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck size={14} className={saving ? 'animate-pulse text-amber-400' : 'text-emerald-400'} />
          {saving ? 'Salvataggio...' : 'Dati salvati'}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar nav */}
        <div className={`${navOpen ? 'block' : 'hidden'} md:block w-48 bg-slate-800 shrink-0 overflow-y-auto`}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); setNavOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-left border-l-2 transition-colors ${
                  active ? 'bg-slate-700 border-blue-400 text-white' : 'border-transparent text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === 'dashboard' && <DashboardTab {...ctx} />}
          {tab === 'articoli' && <ArticoliTab {...ctx} />}
          {tab === 'magazzino' && <MagazzinoTab {...ctx} />}
          {tab === 'carichi' && <CarichiTab {...ctx} />}
          {tab === 'trasferimenti' && <TrasferimentiTab {...ctx} />}
          {tab === 'inventario' && <InventarioTab {...ctx} />}
          {tab === 'movimenti' && <MovimentiTab {...ctx} />}
          {tab === 'riordino' && <RiordinoTab {...ctx} />}
          {tab === 'fornitori' && <FornitoriTab {...ctx} />}
          {tab === 'backup' && <BackupTab {...ctx} />}
        </div>
      </div>

      {toast && <Toast toast={toast} />}
      {confirmState && <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />}
    </div>
  );
}

/* ============================== UI PRIMITIVI ============================== */

function Toast({ toast }) {
  const color = toast.type === 'error' ? 'bg-red-600' : toast.type === 'warn' ? 'bg-amber-600' : 'bg-emerald-600';
  return (
    <div className={`fixed bottom-4 right-4 ${color} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[100] max-w-xs`}>
      {toast.msg}
    </div>
  );
}

function ConfirmDialog({ state, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className={state.danger ? 'text-red-500 shrink-0 mt-0.5' : 'text-blue-500 shrink-0 mt-0.5'} />
          <div className="text-sm text-slate-700">{state.message}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">Annulla</button>
          <button
            onClick={() => { state.onConfirm(); onClose(); }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[90] p-3">
      <div className={`bg-white rounded-lg shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const bg = { verde: 'bg-emerald-100 text-emerald-700', giallo: 'bg-amber-100 text-amber-700', rosso: 'bg-red-100 text-red-700', esaurito: 'bg-slate-200 text-slate-600' }[status];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${bg}`}>{STATUS_LABEL[status]}</span>;
}

function Card({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-start justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-semibold text-slate-800 mt-1">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {Icon && <div className={`p-2 rounded-md ${accent || 'bg-blue-50 text-blue-600'}`}><Icon size={18} /></div>}
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <label className={`block text-xs font-medium text-slate-600 mb-1 ${className || ''}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400";
const btnPrimary = "px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5";
const btnDanger = "px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5";

function EmptyState({ text, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
      {Icon && <Icon size={28} className="opacity-40" />}
      <div className="text-sm">{text}</div>
    </div>
  );
}

function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ============================== HELPERS DI DOMINIO ============================== */

function useArticleMaps(db) {
  return useMemo(() => {
    const byId = Object.fromEntries(db.articles.map(a => [a.id, a]));
    const byEan = Object.fromEntries(db.articles.filter(a => a.ean).map(a => [a.ean, a]));
    const byCode = Object.fromEntries(db.articles.filter(a => a.codice).map(a => [a.codice.toLowerCase(), a]));
    return { byId, byEan, byCode };
  }, [db.articles]);
}

function getQty(db, wh, articleId) {
  return db.stock[stockKey(wh, articleId)] || 0;
}

function totalQty(db, articleId) {
  return WAREHOUSES.reduce((s, w) => s + getQty(db, w.id, articleId), 0);
}

function supplierName(db, id) {
  const s = db.suppliers.find(s => s.id === id);
  return s ? s.nome : '—';
}

function categories(db) {
  return Array.from(new Set(db.articles.map(a => a.categoria).filter(Boolean))).sort();
}

/* ============================== DASHBOARD ============================== */

function DashboardTab({ db }) {
  const activeArticles = db.articles.filter(a => a.attivo !== false);
  const totalValue = activeArticles.reduce((sum, a) => sum + totalQty(db, a.id) * (Number(a.prezzoAcquisto) || 0), 0);

  let sottoMinimo = 0, esauriti = 0;
  activeArticles.forEach(a => {
    const q = totalQty(db, a.id);
    const st = getStatus(q, a.scortaMinima, a.scortaConsigliata);
    if (st === 'rosso') sottoMinimo++;
    if (st === 'esaurito') esauriti++;
  });

  const startOfMonth = todayStr().slice(0, 7);
  const movMonth = db.movements.filter(m => m.date && m.date.startsWith(startOfMonth));
  const carichiMonth = movMonth.filter(m => m.type === 'carico').length;
  const trasfMonth = movMonth.filter(m => m.type === 'trasferimento').length;

  const byCategory = useMemo(() => {
    const map = {};
    activeArticles.forEach(a => {
      const cat = a.categoria || 'Senza categoria';
      const val = totalQty(db, a.id) * (Number(a.prezzoAcquisto) || 0);
      map[cat] = (map[cat] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [db]);

  const byWarehouse = WAREHOUSES.map(w => ({
    name: w.short,
    value: activeArticles.reduce((s, a) => s + getQty(db, w.id, a.id) * (Number(a.prezzoAcquisto) || 0), 0)
  }));

  const last30 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: key.slice(5) });
    }
    return days.map(d => ({
      label: d.label,
      movimenti: db.movements.filter(m => m.date === d.key).length
    }));
  }, [db.movements]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Aggiornato al ${nowStr()}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Valore magazzino" value={fmtMoney(totalValue)} icon={Warehouse} />
        <Card label="Articoli attivi" value={fmtNum(activeArticles.length)} icon={Package} />
        <Card label="Sotto minimo / esauriti" value={`${sottoMinimo} / ${esauriti}`} icon={AlertTriangle} accent="bg-red-50 text-red-600" />
        <Card label="Movimenti nel mese" value={fmtNum(movMonth.length)} sub={`${carichiMonth} carichi · ${trasfMonth} trasferimenti`} icon={History} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700 mb-3">Valore per categoria</div>
          {byCategory.length === 0 ? <EmptyState text="Nessun dato disponibile" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700 mb-3">Valore per magazzino</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byWarehouse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                {byWarehouse.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtMoney(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <div className="text-sm font-medium text-slate-700 mb-3">Trend movimenti (14 giorni)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="movimenti" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ============================== ARTICOLI ============================== */

function ArticoliTab({ db, persist, showToast, askConfirm }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // article obj or {} for new
  const [importOpen, setImportOpen] = useState(false);

  const cats = categories(db);

  const filtered = db.articles.filter(a => {
    if (!showInactive && a.attivo === false) return false;
    if (catFilter && a.categoria !== catFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (![a.codice, a.ean, a.descrizione, a.marca, a.categoria].some(f => (f || '').toLowerCase().includes(s))) return false;
    }
    return true;
  }).sort((a, b) => (a.descrizione || '').localeCompare(b.descrizione || ''));

  function saveArticle(article) {
    const isNew = !article.id;
    const codiceLower = (article.codice || '').trim().toLowerCase();
    const dup = db.articles.find(a => a.id !== article.id && a.codice && a.codice.trim().toLowerCase() === codiceLower && codiceLower);
    if (dup) { showToast('Codice articolo già esistente', 'error'); return; }
    const next = { ...db };
    if (isNew) {
      next.articles = [...db.articles, { ...article, id: uid(), attivo: true }];
    } else {
      next.articles = db.articles.map(a => a.id === article.id ? { ...article } : a);
    }
    persist(next);
    setEditing(null);
    showToast(isNew ? 'Articolo creato' : 'Articolo aggiornato');
  }

  function toggleActive(article) {
    const next = { ...db, articles: db.articles.map(a => a.id === article.id ? { ...a, attivo: a.attivo === false } : a) };
    persist(next);
    showToast(article.attivo === false ? 'Articolo riattivato' : 'Articolo disattivato');
  }

  function exportExcel() {
    const rows = db.articles.map(a => ({
      Codice: a.codice, EAN: a.ean, Descrizione: a.descrizione, Categoria: a.categoria, Sottocategoria: a.sottocategoria,
      Marca: a.marca, UnitaMisura: a.unita, PrezzoAcquisto: a.prezzoAcquisto, PrezzoVendita: a.prezzoVendita,
      ScortaMinima: a.scortaMinima, ScortaConsigliata: a.scortaConsigliata, Fornitore: supplierName(db, a.fornitoreId),
      Note: a.note, Attivo: a.attivo !== false ? 'SI' : 'NO'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Articoli');
    XLSX.writeFile(wb, `articoli_${todayStr()}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Articoli" subtitle={`${db.articles.filter(a => a.attivo !== false).length} articoli attivi`}>
        <button className={btnSecondary} onClick={() => setImportOpen(true)}><Upload size={14} /> Importa Excel</button>
        <button className={btnSecondary} onClick={exportExcel}><FileDown size={14} /> Esporta Excel</button>
        <button className={btnPrimary} onClick={() => setEditing({})}><Plus size={14} /> Nuovo articolo</button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Cerca per codice, EAN, descrizione, marca..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={`${inputCls} w-auto`} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 px-2">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Mostra disattivati
        </label>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Codice</th>
              <th className="text-left px-3 py-2">Descrizione</th>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-left px-3 py-2">Marca</th>
              <th className="text-right px-3 py-2">Prezzo acq.</th>
              <th className="text-right px-3 py-2">Prezzo vend.</th>
              <th className="text-right px-3 py-2">Giacenza tot.</th>
              <th className="text-left px-3 py-2">Stato</th>
              <th className="text-right px-3 py-2">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const q = totalQty(db, a.id);
              const st = getStatus(q, a.scortaMinima, a.scortaConsigliata);
              return (
                <tr key={a.id} className={`border-t border-slate-100 hover:bg-slate-50 ${a.attivo === false ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 font-mono">{a.codice}</td>
                  <td className="px-3 py-2">{a.descrizione}</td>
                  <td className="px-3 py-2 text-slate-500">{a.categoria}{a.sottocategoria ? ` / ${a.sottocategoria}` : ''}</td>
                  <td className="px-3 py-2 text-slate-500">{a.marca}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(a.prezzoAcquisto)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(a.prezzoVendita)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtNum(q)} {a.unita}</td>
                  <td className="px-3 py-2"><StatusBadge status={st} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(a)} className="text-slate-400 hover:text-blue-600 p-1"><Edit2 size={14} /></button>
                    <button onClick={() => toggleActive(a)} className="text-slate-400 hover:text-red-600 p-1">
                      {a.attivo === false ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text="Nessun articolo trovato" icon={Package} />}
      </div>

      {editing && <ArticleModal db={db} article={editing} onClose={() => setEditing(null)} onSave={saveArticle} />}
      {importOpen && <ImportArticoliModal db={db} persist={persist} showToast={showToast} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function ArticleModal({ db, article, onClose, onSave }) {
  const [form, setForm] = useState({
    codice: '', ean: '', descrizione: '', categoria: '', sottocategoria: '', marca: '', unita: 'pz',
    prezzoAcquisto: '', prezzoVendita: '', scortaMinima: '', scortaConsigliata: '', fornitoreId: '', note: '',
    ...article
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title={article.id ? 'Modifica articolo' : 'Nuovo articolo'} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Codice *"><input className={inputCls} value={form.codice} onChange={e => set('codice', e.target.value)} /></Field>
        <Field label="EAN (codice a barre)"><input className={inputCls} value={form.ean} onChange={e => set('ean', e.target.value)} /></Field>
        <Field label="Descrizione *" className="col-span-2"><input className={inputCls} value={form.descrizione} onChange={e => set('descrizione', e.target.value)} /></Field>
        <Field label="Categoria"><input className={inputCls} list="cat-list" value={form.categoria} onChange={e => set('categoria', e.target.value)} /></Field>
        <Field label="Sottocategoria"><input className={inputCls} value={form.sottocategoria} onChange={e => set('sottocategoria', e.target.value)} /></Field>
        <datalist id="cat-list">{categories(db).map(c => <option key={c} value={c} />)}</datalist>
        <Field label="Marca"><input className={inputCls} value={form.marca} onChange={e => set('marca', e.target.value)} /></Field>
        <Field label="Unità di misura"><input className={inputCls} value={form.unita} onChange={e => set('unita', e.target.value)} placeholder="pz, kg, lt..." /></Field>
        <Field label="Prezzo acquisto (€)"><input type="number" step="0.01" className={inputCls} value={form.prezzoAcquisto} onChange={e => set('prezzoAcquisto', e.target.value)} /></Field>
        <Field label="Prezzo vendita (€)"><input type="number" step="0.01" className={inputCls} value={form.prezzoVendita} onChange={e => set('prezzoVendita', e.target.value)} /></Field>
        <Field label="Scorta minima"><input type="number" className={inputCls} value={form.scortaMinima} onChange={e => set('scortaMinima', e.target.value)} /></Field>
        <Field label="Scorta consigliata"><input type="number" className={inputCls} value={form.scortaConsigliata} onChange={e => set('scortaConsigliata', e.target.value)} /></Field>
        <Field label="Fornitore" className="col-span-2">
          <select className={inputCls} value={form.fornitoreId} onChange={e => set('fornitoreId', e.target.value)}>
            <option value="">Nessuno</option>
            {db.suppliers.filter(s => s.attivo !== false).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <Field label="Note" className="col-span-2"><textarea className={inputCls} rows={2} value={form.note} onChange={e => set('note', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button
          className={btnPrimary}
          disabled={!form.codice.trim() || !form.descrizione.trim()}
          onClick={() => onSave(form)}
        >
          <Check size={14} /> Salva
        </button>
      </div>
    </Modal>
  );
}

function ImportArticoliModal({ db, persist, showToast, onClose }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const existingCodes = new Set(db.articles.map(a => (a.codice || '').toLowerCase()));
        const parsed = json.map(r => {
          const codice = String(r.Codice || r.codice || '').trim();
          const isDup = codice && existingCodes.has(codice.toLowerCase());
          return {
            codice, ean: String(r.EAN || r.ean || '').trim(),
            descrizione: String(r.Descrizione || r.descrizione || '').trim(),
            categoria: String(r.Categoria || r.categoria || '').trim(),
            sottocategoria: String(r.Sottocategoria || '').trim(),
            marca: String(r.Marca || r.marca || '').trim(),
            unita: String(r.UnitaMisura || r.Unita || 'pz').trim() || 'pz',
            prezzoAcquisto: Number(r.PrezzoAcquisto || 0) || 0,
            prezzoVendita: Number(r.PrezzoVendita || 0) || 0,
            scortaMinima: Number(r.ScortaMinima || 0) || 0,
            scortaConsigliata: Number(r.ScortaConsigliata || 0) || 0,
            note: String(r.Note || '').trim(),
            valid: !!codice && !!(r.Descrizione || r.descrizione),
            duplicate: isDup,
          };
        });
        setRows(parsed);
      } catch (err) {
        showToast('Errore nella lettura del file Excel', 'error');
      }
    };
    reader.readAsBinaryString(file);
  }

  function confirmImport() {
    const toImport = rows.filter(r => r.valid && !r.duplicate);
    if (toImport.length === 0) { showToast('Nessun articolo valido da importare', 'error'); return; }
    const next = {
      ...db,
      articles: [...db.articles, ...toImport.map(r => ({
        id: uid(), codice: r.codice, ean: r.ean, descrizione: r.descrizione, categoria: r.categoria,
        sottocategoria: r.sottocategoria, marca: r.marca, unita: r.unita, prezzoAcquisto: r.prezzoAcquisto,
        prezzoVendita: r.prezzoVendita, scortaMinima: r.scortaMinima, scortaConsigliata: r.scortaConsigliata,
        fornitoreId: '', note: r.note, attivo: true
      }))]
    };
    persist(next);
    showToast(`${toImport.length} articoli importati`);
    onClose();
  }

  return (
    <Modal title="Importa articoli da Excel" onClose={onClose} wide>
      {!rows ? (
        <div>
          <p className="text-xs text-slate-500 mb-3">
            Il file deve avere una riga di intestazione con colonne: Codice, EAN, Descrizione, Categoria, Sottocategoria, Marca, UnitaMisura, PrezzoAcquisto, PrezzoVendita, ScortaMinima, ScortaConsigliata, Note.
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />
        </div>
      ) : (
        <div>
          <div className="text-xs text-slate-500 mb-2">
            File <strong>{fileName}</strong>: {rows.length} righe — {rows.filter(r => r.valid && !r.duplicate).length} importabili,{' '}
            {rows.filter(r => r.duplicate).length} duplicati, {rows.filter(r => !r.valid).length} non validi.
          </div>
          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-md">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5">Stato</th>
                  <th className="text-left px-2 py-1.5">Codice</th>
                  <th className="text-left px-2 py-1.5">Descrizione</th>
                  <th className="text-left px-2 py-1.5">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      {!r.valid ? <span className="text-red-600">Errore</span> : r.duplicate ? <span className="text-amber-600">Duplicato</span> : <span className="text-emerald-600">OK</span>}
                    </td>
                    <td className="px-2 py-1 font-mono">{r.codice}</td>
                    <td className="px-2 py-1">{r.descrizione}</td>
                    <td className="px-2 py-1">{r.categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button className={btnSecondary} onClick={() => setRows(null)}>Scegli un altro file</button>
            <button className={btnPrimary} onClick={confirmImport}><Check size={14} /> Conferma importazione</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============================== MAGAZZINO (GIACENZE) ============================== */

function MagazzinoTab({ db }) {
  const [wh, setWh] = useState('generale');
  const [search, setSearch] = useState('');

  const rows = db.articles.filter(a => a.attivo !== false && (
    !search || [a.codice, a.descrizione, a.ean].some(f => (f || '').toLowerCase().includes(search.toLowerCase()))
  )).sort((a, b) => (a.descrizione || '').localeCompare(b.descrizione || ''));

  return (
    <div>
      <PageHeader title="Magazzino — Giacenze" subtitle="Stato giacenze in tempo reale per magazzino" />
      <div className="flex flex-wrap gap-2 mb-3">
        {WAREHOUSES.map(w => (
          <button key={w.id} onClick={() => setWh(w.id)}
            className={`px-3 py-1.5 rounded-md text-sm border ${wh === w.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>
            {w.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Cerca articolo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Codice</th>
              <th className="text-left px-3 py-2">Descrizione</th>
              <th className="text-right px-3 py-2">Giacenza</th>
              <th className="text-right px-3 py-2">Scorta minima</th>
              <th className="text-right px-3 py-2">Valore</th>
              <th className="text-left px-3 py-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => {
              const q = getQty(db, wh, a.id);
              const st = getStatus(q, a.scortaMinima, a.scortaConsigliata);
              return (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono">{a.codice}</td>
                  <td className="px-3 py-2">{a.descrizione}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtNum(q)} {a.unita}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{fmtNum(a.scortaMinima)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(q * (Number(a.prezzoAcquisto) || 0))}</td>
                  <td className="px-3 py-2"><StatusBadge status={st} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Nessun articolo" icon={Warehouse} />}
      </div>
    </div>
  );
}

/* ============================== CARICO MERCE ============================== */

function CarichiTab({ db, persist, showToast, askConfirm }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [correcting, setCorrecting] = useState(null); // { carico, item }
  const carichi = groupMovements(db.movements.filter(m => m.type === 'carico'));

  function submitCarico({ date, fornitoreId, documento, wh, lines }) {
    const refId = uid();
    const next = { ...db, movements: [...db.movements], stock: { ...db.stock } };
    lines.forEach(l => {
      const key = stockKey(wh, l.articleId);
      next.stock[key] = (next.stock[key] || 0) + Number(l.qty);
      next.movements.push({
        id: uid(), refId, date, type: 'carico', articleId: l.articleId, wh, whFrom: null, whTo: wh,
        qty: Number(l.qty), prezzoAcquisto: Number(l.prezzo) || 0, documento, fornitoreId, note: '', createdAt: Date.now()
      });
      // aggiorna prezzo acquisto articolo se fornito
      if (l.prezzo) {
        next.articles = next.articles.map(a => a.id === l.articleId ? { ...a, prezzoAcquisto: Number(l.prezzo) } : a);
      }
    });
    if (!next.articles) next.articles = db.articles;
    persist(next);
    showToast(`Carico registrato: ${lines.length} articoli`);
    setOpen(false);
  }

  function correctQuantity(carico, item, newQty) {
    const wh = carico.wh;
    const currentNet = netQtyForRefArticle(db.movements, carico.refId, item.articleId);
    const diffQty = Number(newQty) - currentNet;
    if (diffQty === 0) { setCorrecting(null); return; }
    const key = stockKey(wh, item.articleId);
    const currentStock = db.stock[key] || 0;
    const resultStock = currentStock + diffQty;
    if (resultStock < 0) {
      showToast(`Impossibile correggere: la giacenza attuale in ${WH_MAP[wh].label} (${fmtNum(currentStock)}) è inferiore alla riduzione richiesta`, 'error');
      return;
    }
    const next = { ...db, movements: [...db.movements], stock: { ...db.stock } };
    next.stock[key] = resultStock;
    next.movements.push({
      id: uid(), refId: carico.refId, date: todayStr(), type: 'rettifica_carico', articleId: item.articleId,
      wh, whFrom: null, whTo: wh, qty: diffQty, prezzoAcquisto: item.prezzoAcquisto, documento: carico.documento,
      fornitoreId: carico.fornitoreId, note: `Correzione quantità carico del ${carico.date} (${fmtNum(currentNet)} → ${fmtNum(newQty)})`,
      createdAt: Date.now()
    });
    persist(next);
    showToast('Quantità corretta con successo');
    setCorrecting(null);
  }

  function exportExcel() {
    const rows = [];
    carichi.forEach(c => c.items.forEach(m => {
      const art = db.articles.find(a => a.id === m.articleId);
      const netQty = netQtyForRefArticle(db.movements, c.refId, m.articleId);
      rows.push({
        Data: c.date, Documento: c.documento || '', Fornitore: supplierName(db, c.fornitoreId),
        Magazzino: WH_MAP[c.wh]?.label || '', Codice: art?.codice, Descrizione: art?.descrizione,
        Quantita: netQty, PrezzoAcquisto: m.prezzoAcquisto, Totale: netQty * (Number(m.prezzoAcquisto) || 0)
      });
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carichi');
    XLSX.writeFile(wb, `carichi_${todayStr()}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Carico Merce" subtitle="Registra l'arrivo di merce da fornitore. Clicca su un carico per correggere le quantità.">
        {carichi.length > 0 && <button className={btnSecondary} onClick={exportExcel}><FileDown size={14} /> Esporta Excel</button>}
        <button className={btnPrimary} onClick={() => setOpen(true)}><Plus size={14} /> Nuovo carico</button>
      </PageHeader>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="w-6"></th>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Documento</th>
              <th className="text-left px-3 py-2">Fornitore</th>
              <th className="text-left px-3 py-2">Magazzino</th>
              <th className="text-right px-3 py-2">Righe</th>
              <th className="text-right px-3 py-2">Totale</th>
            </tr>
          </thead>
          <tbody>
            {carichi.map(c => {
              const isOpen = expanded === c.refId;
              const total = c.items.reduce((s, i) => s + netQtyForRefArticle(db.movements, c.refId, i.articleId) * (Number(i.prezzoAcquisto) || 0), 0);
              return (
                <React.Fragment key={c.refId}>
                  <tr className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : c.refId)}>
                    <td className="px-2 py-2 text-slate-400"><ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></td>
                    <td className="px-3 py-2">{c.date}</td>
                    <td className="px-3 py-2">{c.documento || '—'}</td>
                    <td className="px-3 py-2">{supplierName(db, c.fornitoreId)}</td>
                    <td className="px-3 py-2">{WH_MAP[c.wh]?.label}</td>
                    <td className="px-3 py-2 text-right">{c.items.length}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(total)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={7} className="px-3 py-2">
                        <table className="w-full text-xs bg-white rounded-md border border-slate-200 overflow-hidden">
                          <thead className="text-slate-500 text-[11px] uppercase bg-slate-50">
                            <tr>
                              <th className="text-left px-2 py-1.5">Articolo</th>
                              <th className="text-right px-2 py-1.5 w-28">Quantità</th>
                              <th className="text-right px-2 py-1.5 w-28">Prezzo acq.</th>
                              <th className="text-right px-2 py-1.5 w-28">Totale</th>
                              <th className="w-20"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.items.map(item => {
                              const art = db.articles.find(a => a.id === item.articleId);
                              const netQty = netQtyForRefArticle(db.movements, c.refId, item.articleId);
                              const corrected = netQty !== item.qty;
                              return (
                                <tr key={item.id} className="border-t border-slate-100">
                                  <td className="px-2 py-1.5">{art?.codice} — {art?.descrizione}</td>
                                  <td className="px-2 py-1.5 text-right font-medium">
                                    {fmtNum(netQty)} {art?.unita}
                                    {corrected && <span className="ml-1.5 text-[10px] text-amber-600 font-normal">(corretta)</span>}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-slate-500">{fmtMoney(item.prezzoAcquisto)}</td>
                                  <td className="px-2 py-1.5 text-right">{fmtMoney(netQty * (Number(item.prezzoAcquisto) || 0))}</td>
                                  <td className="px-2 py-1.5 text-right">
                                    <button
                                      className="text-blue-600 hover:underline text-[11px] flex items-center gap-1 ml-auto"
                                      onClick={(e) => { e.stopPropagation(); setCorrecting({ carico: c, item, netQty }); }}
                                    >
                                      <Edit2 size={12} /> Correggi
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {carichi.length === 0 && <EmptyState text="Nessun carico registrato" icon={Truck} />}
      </div>

      {open && <CaricoModal db={db} onClose={() => setOpen(false)} onSubmit={submitCarico} />}
      {correcting && (
        <CorrezioneQuantitaModal
          db={db}
          carico={correcting.carico}
          item={correcting.item}
          netQty={correcting.netQty}
          onClose={() => setCorrecting(null)}
          onConfirm={(newQty) => correctQuantity(correcting.carico, correcting.item, newQty)}
        />
      )}
    </div>
  );
}

function CorrezioneQuantitaModal({ db, carico, item, netQty, onClose, onConfirm }) {
  const [value, setValue] = useState(String(netQty));
  const art = db.articles.find(a => a.id === item.articleId);
  const num = Number(value);
  const valid = value !== '' && !isNaN(num) && num >= 0;

  return (
    <Modal title="Correggi quantità carico" onClose={onClose}>
      <div className="text-sm text-slate-700 mb-1"><strong>{art?.codice}</strong> — {art?.descrizione}</div>
      <div className="text-xs text-slate-500 mb-3">
        Carico del {carico.date} · {WH_MAP[carico.wh]?.label} · quantità attuale registrata: <strong>{fmtNum(netQty)} {art?.unita}</strong>
      </div>
      <Field label="Nuova quantità corretta">
        <input type="number" min="0" step="any" autoFocus className={inputCls} value={value} onChange={e => setValue(e.target.value)} />
      </Field>
      <p className="text-[11px] text-slate-400 mt-2">
        La correzione non cancella lo storico: verrà registrato un movimento di rettifica tracciato che aggiorna la giacenza del magazzino.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button className={btnPrimary} disabled={!valid} onClick={() => onConfirm(num)}><Check size={14} /> Conferma correzione</button>
      </div>
    </Modal>
  );
}

function netQtyForRefArticle(allMovements, refId, articleId) {
  return allMovements
    .filter(m => m.refId === refId && m.articleId === articleId && (m.type === 'carico' || m.type === 'rettifica_carico'))
    .reduce((s, m) => s + Number(m.qty), 0);
}

function groupMovements(movs) {
  const groups = {};
  movs.forEach(m => {
    const key = m.refId || m.id;
    if (!groups[key]) groups[key] = { refId: key, date: m.date, documento: m.documento, fornitoreId: m.fornitoreId, wh: m.wh || m.whFrom, whTo: m.whTo, items: [] };
    groups[key].items.push(m);
  });
  return Object.values(groups).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function CaricoModal({ db, onClose, onSubmit }) {
  const [date, setDate] = useState(todayStr());
  const [fornitoreId, setFornitoreId] = useState('');
  const [documento, setDocumento] = useState('');
  const [wh, setWh] = useState('generale');
  const [lines, setLines] = useState([]);
  const [scan, setScan] = useState('');
  const { byEan, byCode } = useArticleMaps(db);

  function addByCode(code) {
    const found = byEan[code] || byCode[code.toLowerCase()];
    if (!found) return false;
    setLines(ls => {
      const existing = ls.find(l => l.articleId === found.id);
      if (existing) return ls.map(l => l.articleId === found.id ? { ...l, qty: Number(l.qty) + 1 } : l);
      return [...ls, { articleId: found.id, qty: 1, prezzo: found.prezzoAcquisto || '' }];
    });
    return true;
  }

  function handleScan(e) {
    if (e.key === 'Enter') {
      const ok = addByCode(scan.trim());
      setScan('');
    }
  }

  function addLine(articleId) {
    if (!articleId) return;
    setLines(ls => ls.find(l => l.articleId === articleId) ? ls : [...ls, { articleId, qty: 1, prezzo: '' }]);
  }

  function updateLine(articleId, field, value) {
    setLines(ls => ls.map(l => l.articleId === articleId ? { ...l, [field]: value } : l));
  }

  function removeLine(articleId) {
    setLines(ls => ls.filter(l => l.articleId !== articleId));
  }

  const canSubmit = lines.length > 0 && lines.every(l => Number(l.qty) > 0);

  return (
    <Modal title="Nuovo carico merce" onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Field label="Data"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Documento (DDT/fattura)"><input className={inputCls} value={documento} onChange={e => setDocumento(e.target.value)} /></Field>
        <Field label="Fornitore">
          <select className={inputCls} value={fornitoreId} onChange={e => setFornitoreId(e.target.value)}>
            <option value="">Seleziona...</option>
            {db.suppliers.filter(s => s.attivo !== false).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <Field label="Magazzino destinazione">
          <select className={inputCls} value={wh} onChange={e => setWh(e.target.value)}>
            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <ScanLine size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Scansiona o digita codice/EAN e premi Invio"
            value={scan} onChange={e => setScan(e.target.value)} onKeyDown={handleScan} />
        </div>
        <select className={`${inputCls} w-auto max-w-[220px]`} onChange={e => { addLine(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="" disabled>Aggiungi articolo...</option>
          {db.articles.filter(a => a.attivo !== false).map(a => <option key={a.id} value={a.id}>{a.codice} — {a.descrizione}</option>)}
        </select>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-2 py-1.5">Articolo</th>
              <th className="text-right px-2 py-1.5 w-24">Quantità</th>
              <th className="text-right px-2 py-1.5 w-28">Prezzo acq.</th>
              <th className="text-right px-2 py-1.5 w-24">Totale</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const art = db.articles.find(a => a.id === l.articleId);
              return (
                <tr key={l.articleId} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">{art?.codice} — {art?.descrizione}</td>
                  <td className="px-2 py-1.5"><input type="number" min="0" className={`${inputCls} text-right`} value={l.qty} onChange={e => updateLine(l.articleId, 'qty', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" className={`${inputCls} text-right`} value={l.prezzo} onChange={e => updateLine(l.articleId, 'prezzo', e.target.value)} /></td>
                  <td className="px-2 py-1.5 text-right">{fmtMoney((Number(l.qty) || 0) * (Number(l.prezzo) || 0))}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => removeLine(l.articleId)} className="text-slate-400 hover:text-red-600"><X size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lines.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Nessun articolo aggiunto</div>}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button className={btnPrimary} disabled={!canSubmit} onClick={() => onSubmit({ date, fornitoreId, documento, wh, lines })}>
          <Check size={14} /> Registra carico
        </button>
      </div>
    </Modal>
  );
}

/* ============================== TRASFERIMENTI ============================== */

function TrasferimentiTab({ db, persist, showToast }) {
  const [open, setOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const allTrasferimenti = groupMovements(db.movements.filter(m => m.type === 'trasferimento'));
  const trasferimenti = allTrasferimenti.filter(t => {
    const from = t.items[0]?.whFrom, to = t.items[0]?.whTo;
    if (filterFrom && from !== filterFrom) return false;
    if (filterTo && to !== filterTo) return false;
    return true;
  });

  function submitTrasferimento({ date, whFrom, whTo, lines, note }) {
    // controllo disponibilità
    for (const l of lines) {
      const disp = getQty(db, whFrom, l.articleId);
      if (Number(l.qty) > disp) {
        showToast(`Quantità insufficiente per l'articolo selezionato in ${WH_MAP[whFrom].label} (disponibili ${disp})`, 'error');
        return false;
      }
    }
    const refId = uid();
    const next = { ...db, movements: [...db.movements], stock: { ...db.stock } };
    lines.forEach(l => {
      const kFrom = stockKey(whFrom, l.articleId);
      const kTo = stockKey(whTo, l.articleId);
      next.stock[kFrom] = (next.stock[kFrom] || 0) - Number(l.qty);
      next.stock[kTo] = (next.stock[kTo] || 0) + Number(l.qty);
      next.movements.push({
        id: uid(), refId, date, type: 'trasferimento', articleId: l.articleId, wh: null, whFrom, whTo,
        qty: Number(l.qty), note, createdAt: Date.now()
      });
    });
    persist(next);
    showToast(`Trasferimento registrato: ${lines.length} articoli`);
    setOpen(false);
    return true;
  }

  function exportExcel() {
    const rows = [];
    trasferimenti.forEach(t => t.items.forEach(m => {
      const art = db.articles.find(a => a.id === m.articleId);
      rows.push({
        Data: t.date, Da: WH_MAP[m.whFrom]?.label || '', A: WH_MAP[m.whTo]?.label || '',
        Codice: art?.codice, Descrizione: art?.descrizione, Quantita: m.qty, Note: m.note || ''
      });
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trasferimenti');
    const suffix = filterTo ? `_verso_${WH_MAP[filterTo].short}` : filterFrom ? `_da_${WH_MAP[filterFrom].short}` : '';
    XLSX.writeFile(wb, `trasferimenti${suffix}_${todayStr()}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Trasferimenti" subtitle="Sposta merce dal magazzino generale ai chioschi">
        {trasferimenti.length > 0 && <button className={btnSecondary} onClick={exportExcel}><FileDown size={14} /> Esporta Excel</button>}
        <button className={btnPrimary} onClick={() => setOpen(true)}><Plus size={14} /> Nuovo trasferimento</button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-3">
        <Field label="Filtra per origine (Da)" className="w-auto min-w-[180px]">
          <select className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)}>
            <option value="">Tutti</option>
            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Filtra per destinazione (A)" className="w-auto min-w-[180px]">
          <select className={inputCls} value={filterTo} onChange={e => setFilterTo(e.target.value)}>
            <option value="">Tutti</option>
            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
        {(filterFrom || filterTo) && (
          <button className="text-xs text-slate-500 hover:text-slate-700 self-end mb-1.5 underline" onClick={() => { setFilterFrom(''); setFilterTo(''); }}>
            Azzera filtri
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Da</th>
              <th className="text-left px-3 py-2">A</th>
              <th className="text-right px-3 py-2">Righe</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {trasferimenti.map(t => (
              <tr key={t.refId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{t.date}</td>
                <td className="px-3 py-2">{WH_MAP[t.items[0]?.whFrom]?.label}</td>
                <td className="px-3 py-2">{WH_MAP[t.items[0]?.whTo]?.label}</td>
                <td className="px-3 py-2 text-right">{t.items.length}</td>
                <td className="px-3 py-2 text-slate-500">{t.items[0]?.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trasferimenti.length === 0 && <EmptyState text={filterFrom || filterTo ? "Nessun trasferimento corrisponde ai filtri selezionati" : "Nessun trasferimento registrato"} icon={ArrowLeftRight} />}
      </div>

      {open && <TrasferimentoModal db={db} onClose={() => setOpen(false)} onSubmit={submitTrasferimento} />}
    </div>
  );
}

function TrasferimentoModal({ db, onClose, onSubmit }) {
  const [date, setDate] = useState(todayStr());
  const [whFrom, setWhFrom] = useState('generale');
  const [whTo, setWhTo] = useState('padel');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [scan, setScan] = useState('');
  const { byEan, byCode } = useArticleMaps(db);

  function addByCode(code) {
    const found = byEan[code] || byCode[code.toLowerCase()];
    if (!found) return;
    setLines(ls => ls.find(l => l.articleId === found.id) ? ls.map(l => l.articleId === found.id ? { ...l, qty: Number(l.qty) + 1 } : l) : [...ls, { articleId: found.id, qty: 1 }]);
  }

  function addLine(articleId) {
    if (!articleId) return;
    setLines(ls => ls.find(l => l.articleId === articleId) ? ls : [...ls, { articleId, qty: 1 }]);
  }
  function updateQty(articleId, qty) { setLines(ls => ls.map(l => l.articleId === articleId ? { ...l, qty } : l)); }
  function removeLine(articleId) { setLines(ls => ls.filter(l => l.articleId !== articleId)); }

  const availableWhTo = WAREHOUSES.filter(w => w.id !== whFrom);
  const canSubmit = lines.length > 0 && lines.every(l => Number(l.qty) > 0) && whFrom !== whTo;

  return (
    <Modal title="Nuovo trasferimento" onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Field label="Data"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Da">
          <select className={inputCls} value={whFrom} onChange={e => { setWhFrom(e.target.value); if (e.target.value === whTo) setWhTo(WAREHOUSES.find(w => w.id !== e.target.value).id); }}>
            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="A">
          <select className={inputCls} value={whTo} onChange={e => setWhTo(e.target.value)}>
            {availableWhTo.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Note"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} /></Field>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <ScanLine size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Scansiona o digita codice/EAN e premi Invio"
            value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addByCode(scan.trim()); setScan(''); } }} />
        </div>
        <select className={`${inputCls} w-auto max-w-[220px]`} onChange={e => { addLine(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="" disabled>Aggiungi articolo...</option>
          {db.articles.filter(a => a.attivo !== false).map(a => <option key={a.id} value={a.id}>{a.codice} — {a.descrizione}</option>)}
        </select>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-2 py-1.5">Articolo</th>
              <th className="text-right px-2 py-1.5 w-28">Disponibile</th>
              <th className="text-right px-2 py-1.5 w-24">Quantità</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const art = db.articles.find(a => a.id === l.articleId);
              const disp = getQty(db, whFrom, l.articleId);
              const over = Number(l.qty) > disp;
              return (
                <tr key={l.articleId} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">{art?.codice} — {art?.descrizione}</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{fmtNum(disp)} {art?.unita}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" min="0" className={`${inputCls} text-right ${over ? 'border-red-400 bg-red-50' : ''}`} value={l.qty} onChange={e => updateQty(l.articleId, e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => removeLine(l.articleId)} className="text-slate-400 hover:text-red-600"><X size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lines.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Nessun articolo aggiunto</div>}
      </div>
      {lines.some(l => Number(l.qty) > getQty(db, whFrom, l.articleId)) && (
        <div className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle size={13} /> Quantità superiore alla giacenza disponibile: correggi prima di procedere.</div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button
          className={btnPrimary}
          disabled={!canSubmit || lines.some(l => Number(l.qty) > getQty(db, whFrom, l.articleId))}
          onClick={() => onSubmit({ date, whFrom, whTo, lines, note })}
        >
          <Check size={14} /> Registra trasferimento
        </button>
      </div>
    </Modal>
  );
}

/* ============================== INVENTARIO ============================== */

function InventarioTab({ db, persist, showToast, askConfirm }) {
  const [wh, setWh] = useState('generale');
  const [counting, setCounting] = useState(false);
  const [reali, setReali] = useState({});
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  const articles = db.articles.filter(a => a.attivo !== false).sort((a, b) => (a.descrizione || '').localeCompare(b.descrizione || ''));
  const filtered = articles.filter(a => !search || [a.codice, a.descrizione].some(f => (f || '').toLowerCase().includes(search.toLowerCase())));

  function startCount() {
    const initial = {};
    articles.forEach(a => { initial[a.id] = getQty(db, wh, a.id); });
    setReali(initial);
    setCounting(true);
  }

  function submitInventory() {
    const items = articles.map(a => {
      const teorica = getQty(db, wh, a.id);
      const reale = Number(reali[a.id] ?? teorica);
      return { articleId: a.id, teorica, reale, diff: reale - teorica };
    });
    const changed = items.filter(i => i.diff !== 0);
    const invId = uid();
    const next = { ...db, movements: [...db.movements], stock: { ...db.stock }, inventories: [...db.inventories] };
    changed.forEach(i => {
      next.stock[stockKey(wh, i.articleId)] = i.reale;
      next.movements.push({
        id: uid(), refId: invId, date: todayStr(), type: 'rettifica', articleId: i.articleId, wh, whFrom: null, whTo: null,
        qty: i.diff, note: `Rettifica da inventario (teorica ${i.teorica} → reale ${i.reale})`, createdAt: Date.now()
      });
    });
    next.inventories.push({ id: invId, date: todayStr(), wh, note, items, createdAt: Date.now() });
    persist(next);
    showToast(`Inventario completato: ${changed.length} rettifiche su ${items.length} articoli`);
    setCounting(false);
    setNote('');
  }

  const inventoriesForWh = db.inventories.filter(i => i.wh === wh).sort((a, b) => b.createdAt - a.createdAt);
  const diffCount = counting ? articles.filter(a => Number(reali[a.id] ?? 0) !== getQty(db, wh, a.id)).length : 0;

  return (
    <div>
      <PageHeader title="Inventario" subtitle="Confronta giacenza teorica e reale e registra le rettifiche">
        {!counting && <button className={btnPrimary} onClick={startCount}><ClipboardList size={14} /> Nuovo inventario</button>}
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-3">
        {WAREHOUSES.map(w => (
          <button key={w.id} disabled={counting} onClick={() => setWh(w.id)}
            className={`px-3 py-1.5 rounded-md text-sm border disabled:opacity-40 ${wh === w.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>
            {w.label}
          </button>
        ))}
      </div>

      {counting ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-sm text-slate-600">Conteggio per <strong>{WH_MAP[wh].label}</strong> — {diffCount} differenze rilevate</div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input className={`${inputCls} pl-8 w-56`} placeholder="Cerca articolo..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5">Codice</th>
                  <th className="text-left px-2 py-1.5">Descrizione</th>
                  <th className="text-right px-2 py-1.5 w-24">Teorica</th>
                  <th className="text-right px-2 py-1.5 w-28">Reale</th>
                  <th className="text-right px-2 py-1.5 w-20">Diff.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const teorica = getQty(db, wh, a.id);
                  const reale = Number(reali[a.id] ?? teorica);
                  const diff = reale - teorica;
                  return (
                    <tr key={a.id} className={`border-t border-slate-100 ${diff !== 0 ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-2 py-1.5 font-mono">{a.codice}</td>
                      <td className="px-2 py-1.5">{a.descrizione}</td>
                      <td className="px-2 py-1.5 text-right text-slate-500">{fmtNum(teorica)}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" className={`${inputCls} text-right`} value={reali[a.id] ?? teorica}
                          onChange={e => setReali(r => ({ ...r, [a.id]: e.target.value }))} />
                      </td>
                      <td className={`px-2 py-1.5 text-right font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Field label="Note inventario" className="mt-3 max-w-md"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 mt-3">
            <button className={btnSecondary} onClick={() => setCounting(false)}>Annulla</button>
            <button className={btnPrimary} onClick={() => askConfirm(
              `Confermi il completamento dell'inventario? Verranno create ${diffCount} rettifiche tracciate.`,
              submitInventory, false
            )}><Check size={14} /> Completa inventario</button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Note</th>
                <th className="text-right px-3 py-2">Articoli</th>
                <th className="text-right px-3 py-2">Rettifiche</th>
              </tr>
            </thead>
            <tbody>
              {inventoriesForWh.map(inv => (
                <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{inv.date}</td>
                  <td className="px-3 py-2 text-slate-500">{inv.note || '—'}</td>
                  <td className="px-3 py-2 text-right">{inv.items.length}</td>
                  <td className="px-3 py-2 text-right">{inv.items.filter(i => i.diff !== 0).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {inventoriesForWh.length === 0 && <EmptyState text="Nessun inventario registrato per questo magazzino" icon={ClipboardList} />}
        </div>
      )}
    </div>
  );
}

/* ============================== MOVIMENTI ============================== */

function MovimentiTab({ db }) {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', articleId: '', type: '', wh: '' });
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const rows = db.movements.filter(m => {
    if (filters.dateFrom && m.date < filters.dateFrom) return false;
    if (filters.dateTo && m.date > filters.dateTo) return false;
    if (filters.articleId && m.articleId !== filters.articleId) return false;
    if (filters.type && m.type !== filters.type) return false;
    if (filters.wh && m.wh !== filters.wh && m.whFrom !== filters.wh && m.whTo !== filters.wh) return false;
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  function exportExcel() {
    const exportRows = rows.map(m => {
      const art = db.articles.find(a => a.id === m.articleId);
      return {
        Data: m.date, Tipo: MOV_LABELS[m.type],
        Codice: art?.codice, Descrizione: art?.descrizione,
        Magazzino: m.type === 'trasferimento' ? `${WH_MAP[m.whFrom]?.short || ''} -> ${WH_MAP[m.whTo]?.short || ''}` : (WH_MAP[m.wh]?.label || ''),
        Quantita: m.qty,
        Documento: m.documento || '',
        Fornitore: m.fornitoreId ? supplierName(db, m.fornitoreId) : '',
        Note: m.note || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');
    XLSX.writeFile(wb, `movimenti_${todayStr()}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Movimenti" subtitle={`${rows.length} movimenti trovati`}>
        {rows.length > 0 && <button className={btnSecondary} onClick={exportExcel}><FileDown size={14} /> Esporta Excel</button>}
      </PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        <Field label="Da data"><input type="date" className={inputCls} value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)} /></Field>
        <Field label="A data"><input type="date" className={inputCls} value={filters.dateTo} onChange={e => set('dateTo', e.target.value)} /></Field>
        <Field label="Tipo">
          <select className={inputCls} value={filters.type} onChange={e => set('type', e.target.value)}>
            <option value="">Tutti</option>
            {Object.entries(MOV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Magazzino">
          <select className={inputCls} value={filters.wh} onChange={e => set('wh', e.target.value)}>
            <option value="">Tutti</option>
            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Articolo">
          <select className={inputCls} value={filters.articleId} onChange={e => set('articleId', e.target.value)}>
            <option value="">Tutti</option>
            {db.articles.map(a => <option key={a.id} value={a.id}>{a.codice}</option>)}
          </select>
        </Field>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Articolo</th>
              <th className="text-left px-3 py-2">Magazzino</th>
              <th className="text-right px-3 py-2">Quantità</th>
              <th className="text-left px-3 py-2">Note / Rif.</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map(m => {
              const art = db.articles.find(a => a.id === m.articleId);
              const whLabel = m.type === 'trasferimento' ? `${WH_MAP[m.whFrom]?.short} → ${WH_MAP[m.whTo]?.short}` : WH_MAP[m.wh]?.label;
              return (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{m.date}</td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">{MOV_LABELS[m.type]}</span></td>
                  <td className="px-3 py-2">{art?.codice} — {art?.descrizione}</td>
                  <td className="px-3 py-2 text-slate-500">{whLabel}</td>
                  <td className={`px-3 py-2 text-right font-medium ${m.qty < 0 ? 'text-red-600' : 'text-slate-700'}`}>{m.qty > 0 ? `+${fmtNum(m.qty)}` : fmtNum(m.qty)}</td>
                  <td className="px-3 py-2 text-slate-500">{m.documento || m.note || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Nessun movimento trovato" icon={History} />}
      </div>
      {rows.length > 500 && <div className="text-[11px] text-slate-400 mt-2">Mostrati i primi 500 movimenti. Affina i filtri per restringere i risultati.</div>}
    </div>
  );
}

/* ============================== RIORDINO ============================== */

function RiordinoTab({ db }) {
  const items = db.articles.filter(a => a.attivo !== false).map(a => {
    const q = totalQty(db, a.id);
    const status = getStatus(q, a.scortaMinima, a.scortaConsigliata);
    const suggerita = Math.max((Number(a.scortaConsigliata) || Number(a.scortaMinima) || 0) - q, 0);
    return { ...a, q, status, suggerita };
  }).filter(a => a.status === 'rosso' || a.status === 'esaurito')
    .sort((a, b) => a.q - b.q);

  const byFornitore = {};
  items.forEach(a => {
    const key = a.fornitoreId || '_none';
    if (!byFornitore[key]) byFornitore[key] = [];
    byFornitore[key].push(a);
  });

  function exportRiordino() {
    const rows = items.map(a => ({
      Codice: a.codice, Descrizione: a.descrizione, Giacenza: a.q, ScortaMinima: a.scortaMinima,
      QuantitaSuggerita: a.suggerita, Fornitore: supplierName(db, a.fornitoreId), Stato: STATUS_LABEL[a.status]
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riordino');
    XLSX.writeFile(wb, `riordino_${todayStr()}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Riordino" subtitle={`${items.length} articoli da riordinare`}>
        {items.length > 0 && <button className={btnSecondary} onClick={exportRiordino}><FileDown size={14} /> Esporta lista</button>}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState text="Nessun articolo sotto scorta minima. Tutto in ordine!" icon={AlertTriangle} />
      ) : (
        Object.entries(byFornitore).map(([fid, arts]) => (
          <div key={fid} className="bg-white rounded-lg border border-slate-200 mb-4 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
              {fid === '_none' ? 'Fornitore non assegnato' : supplierName(db, fid)}
            </div>
            <table className="w-full text-xs">
              <thead className="text-slate-500 text-[11px] uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Codice</th>
                  <th className="text-left px-3 py-2">Descrizione</th>
                  <th className="text-right px-3 py-2">Giacenza</th>
                  <th className="text-right px-3 py-2">Minima</th>
                  <th className="text-right px-3 py-2">Da ordinare</th>
                  <th className="text-left px-3 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {arts.map(a => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono">{a.codice}</td>
                    <td className="px-3 py-2">{a.descrizione}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(a.q)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{fmtNum(a.scortaMinima)}</td>
                    <td className="px-3 py-2 text-right font-medium text-blue-600">{fmtNum(a.suggerita)} {a.unita}</td>
                    <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

/* ============================== FORNITORI ============================== */

function FornitoriTab({ db, persist, showToast }) {
  const [editing, setEditing] = useState(null);

  function save(supplier) {
    const isNew = !supplier.id;
    const next = { ...db };
    next.suppliers = isNew ? [...db.suppliers, { ...supplier, id: uid(), attivo: true }] : db.suppliers.map(s => s.id === supplier.id ? supplier : s);
    persist(next);
    setEditing(null);
    showToast(isNew ? 'Fornitore creato' : 'Fornitore aggiornato');
  }

  function toggleActive(s) {
    persist({ ...db, suppliers: db.suppliers.map(x => x.id === s.id ? { ...x, attivo: x.attivo === false } : x) });
  }

  return (
    <div>
      <PageHeader title="Fornitori" subtitle={`${db.suppliers.filter(s => s.attivo !== false).length} fornitori attivi`}>
        <button className={btnPrimary} onClick={() => setEditing({})}><Plus size={14} /> Nuovo fornitore</button>
      </PageHeader>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">P.IVA</th>
              <th className="text-left px-3 py-2">Contatti</th>
              <th className="text-right px-3 py-2">Articoli associati</th>
              <th className="text-right px-3 py-2">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {db.suppliers.map(s => (
              <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 ${s.attivo === false ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 font-medium">{s.nome}</td>
                <td className="px-3 py-2 text-slate-500">{s.piva}</td>
                <td className="px-3 py-2 text-slate-500">{s.contatti}</td>
                <td className="px-3 py-2 text-right">{db.articles.filter(a => a.fornitoreId === s.id).length}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(s)} className="text-slate-400 hover:text-blue-600 p-1"><Edit2 size={14} /></button>
                  <button onClick={() => toggleActive(s)} className="text-slate-400 hover:text-red-600 p-1">{s.attivo === false ? <RotateCcw size={14} /> : <Trash2 size={14} />}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {db.suppliers.length === 0 && <EmptyState text="Nessun fornitore registrato" icon={Users} />}
      </div>

      {editing && <SupplierModal supplier={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSave }) {
  const [form, setForm] = useState({ nome: '', piva: '', contatti: '', note: '', ...supplier });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={supplier.id ? 'Modifica fornitore' : 'Nuovo fornitore'} onClose={onClose}>
      <Field label="Nome *"><input className={inputCls} value={form.nome} onChange={e => set('nome', e.target.value)} /></Field>
      <Field label="P.IVA" className="mt-2"><input className={inputCls} value={form.piva} onChange={e => set('piva', e.target.value)} /></Field>
      <Field label="Contatti (telefono/email)" className="mt-2"><input className={inputCls} value={form.contatti} onChange={e => set('contatti', e.target.value)} /></Field>
      <Field label="Note" className="mt-2"><textarea rows={2} className={inputCls} value={form.note} onChange={e => set('note', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnSecondary} onClick={onClose}>Annulla</button>
        <button className={btnPrimary} disabled={!form.nome.trim()} onClick={() => onSave(form)}><Check size={14} /> Salva</button>
      </div>
    </Modal>
  );
}

/* ============================== BACKUP & REPORT ============================== */

function BackupTab({ db, persist, showToast, askConfirm }) {
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => { loadBackupsList(); }, []);

  async function loadBackupsList() {
    setLoadingBackups(true);
    try {
      const res = await window.storage.get('backups-list', false);
      setBackups(res && res.value ? JSON.parse(res.value) : []);
    } catch (e) {
      setBackups([]);
    } finally {
      setLoadingBackups(false);
    }
  }

  async function saveBackupSnapshot() {
    const id = uid();
    const label = new Date().toLocaleString('it-IT');
    try {
      await window.storage.set(`backup:${id}`, JSON.stringify(db), false);
      const list = [{ id, label, count: db.articles.length }, ...backups].slice(0, 20);
      await window.storage.set('backups-list', JSON.stringify(list), false);
      setBackups(list);
      showToast('Backup salvato con successo');
    } catch (e) {
      showToast('Errore nel salvataggio del backup', 'error');
    }
  }

  async function restoreSnapshot(id) {
    try {
      const res = await window.storage.get(`backup:${id}`, false);
      if (res && res.value) {
        const restored = { ...emptyDB(), ...JSON.parse(res.value) };
        persist(restored);
        showToast('Backup ripristinato');
      }
    } catch (e) {
      showToast('Errore nel ripristino del backup', 'error');
    }
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup_magazzino_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        askConfirm(
          'Il ripristino sovrascriverà tutti i dati attuali con quelli del file caricato. Procedere?',
          () => { persist({ ...emptyDB(), ...parsed }); showToast('Dati ripristinati dal file'); },
          true
        );
      } catch (err) {
        showToast('File non valido', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function exportExcelCompleto() {
    const wb = XLSX.utils.book_new();

    const articoliRows = db.articles.map(a => ({
      Codice: a.codice, EAN: a.ean, Descrizione: a.descrizione, Categoria: a.categoria, Sottocategoria: a.sottocategoria,
      Marca: a.marca, Unita: a.unita, PrezzoAcquisto: a.prezzoAcquisto, PrezzoVendita: a.prezzoVendita,
      ScortaMinima: a.scortaMinima, ScortaConsigliata: a.scortaConsigliata, Fornitore: supplierName(db, a.fornitoreId),
      GiacenzaTotale: totalQty(db, a.id), ValoreStock: totalQty(db, a.id) * (Number(a.prezzoAcquisto) || 0), Attivo: a.attivo !== false ? 'SI' : 'NO'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(articoliRows), 'Articoli');

    const magazzinoRows = db.articles.map(a => {
      const row = { Codice: a.codice, Descrizione: a.descrizione };
      WAREHOUSES.forEach(w => { row[w.short] = getQty(db, w.id, a.id); });
      row.Totale = totalQty(db, a.id);
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(magazzinoRows), 'Giacenze');

    const movRows = db.movements.map(m => {
      const art = db.articles.find(a => a.id === m.articleId);
      return {
        Data: m.date, Tipo: MOV_LABELS[m.type], Articolo: art?.codice, Descrizione: art?.descrizione,
        Magazzino: m.type === 'trasferimento' ? `${WH_MAP[m.whFrom]?.short} -> ${WH_MAP[m.whTo]?.short}` : WH_MAP[m.wh]?.label,
        Quantita: m.qty, Documento: m.documento || '', Fornitore: m.fornitoreId ? supplierName(db, m.fornitoreId) : '', Note: m.note || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movRows), 'Movimenti');

    const invRows = [];
    db.inventories.forEach(inv => inv.items.forEach(it => {
      const art = db.articles.find(a => a.id === it.articleId);
      invRows.push({ Data: inv.date, Magazzino: WH_MAP[inv.wh]?.label, Codice: art?.codice, Descrizione: art?.descrizione, Teorica: it.teorica, Reale: it.reale, Differenza: it.diff });
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Inventari');

    const fornRows = db.suppliers.map(s => ({ Nome: s.nome, PIVA: s.piva, Contatti: s.contatti, Note: s.note, Attivo: s.attivo !== false ? 'SI' : 'NO' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fornRows), 'Fornitori');

    const riordinoRows = db.articles.filter(a => a.attivo !== false).map(a => {
      const q = totalQty(db, a.id);
      const status = getStatus(q, a.scortaMinima, a.scortaConsigliata);
      return { Codice: a.codice, Descrizione: a.descrizione, Giacenza: q, ScortaMinima: a.scortaMinima, Stato: STATUS_LABEL[status], Fornitore: supplierName(db, a.fornitoreId) };
    }).filter(r => r.Stato === 'Sotto minimo' || r.Stato === 'Esaurito');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riordinoRows), 'Riordino');

    XLSX.writeFile(wb, `report_magazzino_${todayStr()}.xlsx`);
    showToast('Report Excel esportato');
  }

  const totalValue = db.articles.reduce((sum, a) => sum + totalQty(db, a.id) * (Number(a.prezzoAcquisto) || 0), 0);

  return (
    <div>
      <PageHeader title="Report & Backup" subtitle="Esportazioni, backup e ripristino dei dati" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><FileDown size={16} /> Report Excel</div>
          <p className="text-xs text-slate-500 mb-3">Esporta un file Excel multi-foglio con articoli, giacenze per magazzino, movimenti, inventari, fornitori e lista riordino.</p>
          <div className="text-xs text-slate-500 mb-3">Valore totale magazzino: <strong>{fmtMoney(totalValue)}</strong></div>
          <button className={btnPrimary} onClick={exportExcelCompleto}><FileDown size={14} /> Genera report Excel completo</button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Save size={16} /> Backup dati</div>
          <p className="text-xs text-slate-500 mb-3">Salva uno snapshot dei dati nello storage persistente, oppure scaricalo come file JSON da conservare offline.</p>
          <div className="flex gap-2 flex-wrap">
            <button className={btnPrimary} onClick={saveBackupSnapshot}><Save size={14} /> Salva backup ora</button>
            <button className={btnSecondary} onClick={downloadJSON}><Download size={14} /> Scarica JSON</button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <div className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Upload size={16} /> Ripristino</div>
          <p className="text-xs text-slate-500 mb-3">Ripristina i dati da un file di backup JSON. Questa operazione sovrascrive tutti i dati correnti.</p>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleRestoreFile} className="text-sm" />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><History size={16} /> Storico backup</div>
          {loadingBackups ? (
            <div className="text-xs text-slate-400">Caricamento...</div>
          ) : backups.length === 0 ? (
            <EmptyState text="Nessun backup salvato ancora" icon={Save} />
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
                <tr><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Articoli</th><th className="text-right px-3 py-2">Azioni</th></tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{b.label}</td>
                    <td className="px-3 py-2 text-right">{b.count}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => askConfirm('Ripristinare questo backup? I dati attuali verranno sovrascritti.', () => restoreSnapshot(b.id), true)}
                      >
                        Ripristina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
