# Gestionale Magazzino Circolo — pacchetto per il deploy

Questa è la versione del gestionale (Articoli, Magazzino, Carichi,
Trasferimenti, Inventario, Movimenti, Riordino, Fornitori, Dashboard,
Backup) pronta per essere ospitata fuori da Claude, con un vero database
condiviso (Supabase) così che più postazioni (bar + chioschi) possano
usarla contemporaneamente vedendo sempre gli stessi dati aggiornati.

Il codice dell'app è identico a quello mostrato in chat: l'unica
differenza è che il salvataggio dei dati ora passa da Supabase invece che
dallo storage interno di Claude.

---

## Cosa ti serve prima di iniziare

- Un account gratuito su **[supabase.com](https://supabase.com)** (database)
- Un account gratuito su **[vercel.com](https://vercel.com)** oppure
  **[netlify.com](https://netlify.com)** (hosting del sito)
- Un account gratuito su **[github.com](https://github.com)** (per caricare
  il codice — sia Vercel che Netlify si collegano a una repository GitHub)

Nessuno di questi passaggi richiede di scrivere codice: sono tutti click
su interfacce web.

---

## Passo 1 — Crea il progetto Supabase (il database)

1. Vai su [supabase.com](https://supabase.com), crea un account e poi un
   nuovo progetto (scegli una regione vicina, es. Europa).
2. Attendi 1-2 minuti che il progetto sia pronto.
3. Nel menu a sinistra vai su **SQL Editor** → **New query**.
4. Apri il file `supabase/schema.sql` incluso in questo pacchetto, copia
   tutto il contenuto, incollalo nell'editor e premi **Run**.
   Questo crea la tabella che conterrà tutti i dati del gestionale.
5. Vai su **Project Settings** (icona ingranaggio) → **API**. Ti serviranno
   due valori tra poco:
   - **Project URL** (es. `https://xxxxxxxx.supabase.co`)
   - **anon public key** (una lunga stringa)

Tienili a portata di mano per il Passo 3.

---

## Passo 2 — Carica il codice su GitHub

1. Crea un nuovo repository su GitHub (può essere privato).
2. Carica tutti i file di questo pacchetto nel repository (puoi trascinare
   la cartella direttamente nell'interfaccia web di GitHub, oppure usare
   Git da riga di comando se preferisci).

---

## Passo 3 — Pubblica il sito (Vercel o Netlify)

### Opzione A — Vercel

1. Vai su [vercel.com](https://vercel.com), accedi con GitHub.
2. **Add New → Project**, seleziona il repository appena creato.
3. Vercel riconosce automaticamente che è un progetto Vite: lascia le
   impostazioni di build predefinite.
4. Prima di premere Deploy, apri **Environment Variables** e aggiungi:
   - `VITE_SUPABASE_URL` = il Project URL copiato dal Passo 1
   - `VITE_SUPABASE_ANON_KEY` = la anon public key copiata dal Passo 1
   - `VITE_APP_PASSWORD` = una password a tua scelta (facoltativo, vedi
     avviso di sicurezza più sotto)
5. Premi **Deploy**. Dopo 1-2 minuti avrai un link pubblico tipo
   `https://tuo-progetto.vercel.app`.

### Opzione B — Netlify

1. Vai su [netlify.com](https://netlify.com), accedi con GitHub.
2. **Add new site → Import an existing project**, seleziona il repository.
3. Build command: `npm run build` — Publish directory: `dist`.
4. In **Site settings → Environment variables** aggiungi le stesse tre
   variabili elencate sopra.
5. Deploya. Otterrai un link tipo `https://tuo-progetto.netlify.app`.

Da qui in poi, ogni volta che vuoi aggiornare l'app basta caricare il
nuovo codice su GitHub: Vercel/Netlify ripubblicano automaticamente.

---

## Passo 4 — Primo accesso

Apri il link pubblico. Se hai impostato `VITE_APP_PASSWORD`, ti verrà
chiesta la password prima di entrare. Da lì il gestionale funziona
esattamente come quello che hai già usato in chat: i dati che inserisci
vengono salvati su Supabase e sono visibili da qualunque dispositivo apra
lo stesso link (utile per far vedere lo stesso magazzino da bar e
chioschi contemporaneamente).

---

## Avviso di sicurezza (importante)

Questa configurazione è pensata per essere **semplice e rapida**, adatta
a un uso interno con link non condiviso pubblicamente. Due cose da sapere:

1. **La password d'accesso (`VITE_APP_PASSWORD`) non è una vera
   sicurezza**: è scritta nel codice che il browser scarica, quindi una
   persona esperta potrebbe recuperarla. Serve solo a scoraggiare accessi
   casuali, non ad proteggere dati sensibili da un attacco mirato.
2. **La policy del database (`schema.sql`) permette a chiunque abbia la
   "anon key" pubblica di leggere e scrivere i dati.** Va bene per iniziare,
   ma se in futuro vuoi login reali con utenti e permessi diversi per
   bar/chioschi, il passo successivo è attivare **Supabase Auth**
   (https://supabase.com/docs/guides/auth) — un lavoro aggiuntivo che
   possiamo affrontare quando vorrai.

Per un circolo sportivo con accesso interno, questa configurazione è
generalmente sufficiente: il punto debole più realistico non è un attacco
informatico ma la condivisione involontaria del link.

---

## Sviluppo in locale (facoltativo)

Se qualcuno vuole modificare il codice prima di pubblicarlo:

```bash
npm install
cp .env.example .env   # poi compila .env con i tuoi valori Supabase
npm run dev
```

Apri `http://localhost:5173`.

---

## Struttura del progetto

```
├── src/
│   ├── App.jsx                 → il gestionale (identico alla versione Claude)
│   ├── main.jsx                → collega Supabase e avvia l'app
│   ├── lib/supabaseStorage.js  → traduce le chiamate dell'app in query Supabase
│   └── components/PasswordGate.jsx → schermata password opzionale
├── supabase/schema.sql         → script da eseguire su Supabase
├── .env.example                → modello delle variabili d'ambiente
└── package.json
```
