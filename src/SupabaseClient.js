import { createClient } from '@supabase/supabase-js'

// --- NUOVA VERSIONE PER IL DEPLOY ---
// Leggiamo le "variabili d'ambiente" che imposteremo su Vercel.
// Vite richiede il prefisso "VITE_" per esporle.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// Un controllo di sicurezza. Se le chiavi non ci sono, blocca l'app
// e scrivi un errore in console (F12)
if (!supabaseUrl || !supabaseKey) {
  const errorMsg = "Errore: Variabili d'ambiente Supabase non trovate. (VITE_SUPABASE_URL o VITE_SUPABASE_KEY)"
  console.error(errorMsg);
  // Potremmo anche lanciare un errore per bloccare del tutto l'app
  // throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseKey)
