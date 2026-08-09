import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti. ' +
    'Crea un file .env (vedi .env.example) con i valori del tuo progetto Supabase.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const TABLE = 'kv_store';

/**
 * Adapter che replica l'API window.storage usata dall'artifact originale
 * (get/set/delete/list), ma appoggiandosi a una tabella chiave-valore su Supabase
 * invece dello storage di Claude. Il parametro `shared` viene accettato per
 * compatibilità ma ignorato: in questa app, pensata per essere usata da più
 * postazioni (bar + chioschi) contemporaneamente, tutti i dati sono condivisi
 * di default, non essendoci un sistema di utenti separati.
 */
export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: data.value, shared: true };
  },

  async set(key, value) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return { key, value, shared: true };
  },

  async delete(key) {
    const { error } = await supabase.from(TABLE).delete().eq('key', key);
    if (error) throw error;
    return { key, deleted: true, shared: true };
  },

  async list(prefix) {
    let query = supabase.from(TABLE).select('key');
    if (prefix) query = query.like('key', `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix, shared: true };
  },
};
