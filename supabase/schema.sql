-- ============================================================
-- Schema Supabase per il Gestionale Magazzino Circolo
-- Esegui questo script nell'editor SQL del tuo progetto Supabase
-- (Dashboard Supabase -> SQL Editor -> New query -> incolla e "Run")
-- ============================================================

-- Tabella chiave-valore che sostituisce lo storage persistente delle
-- Claude Artifact. L'intera app salva qui i suoi dati (articoli, giacenze,
-- movimenti, inventari, backup) sotto forma di stringhe JSON, esattamente
-- come faceva con window.storage.
create table if not exists kv_store (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Abilita la Row Level Security (richiesta da Supabase per tabelle esposte via API)
alter table kv_store enable row level security;

-- ATTENZIONE - SICUREZZA:
-- La policy sotto consente a chiunque possieda la "anon key" pubblica del
-- progetto (quella che finisce nel codice del sito) di leggere e scrivere
-- liberamente su questa tabella. Per un gestionale interno ad uso del
-- circolo, protetto anche dalla password lato app (VITE_APP_PASSWORD),
-- è una scelta accettabile per iniziare rapidamente.
--
-- Se in futuro vuoi una sicurezza più solida (utenti reali con login,
-- permessi diversi per bar/chioschi), sostituisci questa policy con regole
-- basate su Supabase Auth: https://supabase.com/docs/guides/auth
create policy "Consenti lettura e scrittura al ruolo anonimo"
  on kv_store
  for all
  using (true)
  with check (true);

-- Indice per velocizzare le ricerche per prefisso (usate dalla funzione
-- storage.list, es. per elencare i backup salvati)
create index if not exists kv_store_key_prefix_idx on kv_store (key text_pattern_ops);
