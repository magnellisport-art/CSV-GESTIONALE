import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { storage } from './lib/supabaseStorage';
import GestionaleMagazzino from './App.jsx';
import PasswordGate from './components/PasswordGate.jsx';

// L'app originale (creata come Claude Artifact) usa window.storage.get/set/delete/list
// per salvare i dati. Qui colleghiamo quelle stesse chiamate a Supabase, così il
// codice del gestionale resta identico e non deve sapere nulla dell'hosting.
window.storage = storage;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PasswordGate>
      <GestionaleMagazzino />
    </PasswordGate>
  </React.StrictMode>
);
