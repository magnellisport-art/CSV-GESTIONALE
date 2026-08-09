import React, { useState, useEffect } from 'react';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '';
const SESSION_KEY = 'gestionale-unlocked';

/**
 * Blocco d'accesso molto semplice, puramente deterrente.
 *
 * IMPORTANTE: questa NON è vera sicurezza. La password è inclusa nel codice
 * JavaScript spedito al browser e chiunque ispezioni il sito può recuperarla.
 * Serve solo a scoraggiare accessi casuali (es. link condiviso per errore),
 * non a proteggere dati sensibili. Se ti serve un accesso realmente sicuro
 * (utenti/password veri, permessi diversi per bar/chioschi), usa Supabase Auth:
 * https://supabase.com/docs/guides/auth
 *
 * Se VITE_APP_PASSWORD non è impostata, il gate è disattivato e l'app si apre
 * direttamente.
 */
export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(!APP_PASSWORD);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (APP_PASSWORD && sessionStorage.getItem(SESSION_KEY) === '1') {
      setUnlocked(true);
    }
  }, []);

  if (unlocked) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
    } else {
      setError(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 w-full max-w-xs">
        <h1 className="text-sm font-semibold text-slate-800 mb-1">Gestionale Magazzino Circolo</h1>
        <p className="text-xs text-slate-500 mb-4">Inserisci la password per accedere</p>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Password"
        />
        {error && <div className="text-xs text-red-600 mb-2">Password errata, riprova.</div>}
        <button type="submit" className="w-full bg-blue-600 text-white text-sm rounded-md py-2 hover:bg-blue-700">
          Entra
        </button>
      </form>
    </div>
  );
}
