// Importa il client Supabase
// NOTA: Usiamo il percorso relativo corretto per il deploy Vercel
import { createClient } from '@supabase/supabase-js';

// Funzione "Handler" principale (standard Vercel)
// Vercel eseguirà questa funzione quando l'URL /api/keep-alive viene visitato.
export default async function handler(request, response) {
  
  // Leggi le chiavi segrete dalle Variabili d'Ambiente di Vercel
  // NON usiamo 'import.meta.env' qui perché siamo in un ambiente serverless,
  // usiamo 'process.env'
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('API Keep-Alive: Variabili Supabase non trovate.');
    return response.status(500).json({ error: 'Configurazione server mancante.' });
  }

  try {
    // Inizializza il client Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Esegui la query "ping"
    // Facciamo una semplice lettura (innocua) dalla tabella di stato.
    // Usiamo .limit(1) per efficienza massima.
    const { data, error }_ = await supabase
      .from('votazione_stato')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    // Se tutto va bene, rispondi con successo
    console.log('API Keep-Alive: Ping a Supabase eseguito con successo.');
    return response.status(200).json({ message: 'Database pingato con successo.' });

  } catch (error) {
    // Se c'è un errore nella connessione o nella query
    console.error('API Keep-Alive: Errore durante il ping a Supabase:', error.message);
    return response.status(500).json({ error: 'Errore durante il ping al database.', details: error.message });
  }
}