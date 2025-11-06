import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../SupabaseClient.js';
import '../App.css'; 

// Stato per i timeout dei pulsanti di conferma
let azzeraVotiTimeout = null;
let svuotaListaTimeout = null;

function AdminPage() {
  // Stato della votazione (da votazione_stato)
  const [votazioneStato, setVotazioneStato] = useState(null);
  
  // Dati per i campi input
  const [nuovoTema, setNuovoTema] = useState('');
  const [nuovoCodice, setNuovoCodice] = useState('');
  
  // Lista dei partecipanti (da partecipanti)
  const [partecipanti, setPartecipanti] = useState([]);
  
  // Lista report (dalla nuova tabella report_votazioni)
  const [reportVotazioni, setReportVotazioni] = useState([]);

  // Stati UI
  const [loading, setLoading] = useState(true);
  const [messaggio, setMessaggio] = useState({ testo: '', tipo: '' }); // {testo, tipo}
  
  // Stati per i pulsanti di conferma
  const [confirmAzzera, setConfirmAzzera] = useState(false);
  const [confirmSvuota, setConfirmSvuota] = useState(false);

  // --- 1. FETCH INIZIALE E REALTIME ---

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Carica lo stato
      const { data: statoData, error: statoError } = await supabase
        .from('votazione_stato')
        .select('*')
        .eq('id', 1)
        .single();
      if (statoError) throw statoError;
      setVotazioneStato(statoData);
      setNuovoTema(statoData.tema_delibera || '');
      setNuovoCodice(statoData.codice_accesso || '');

      // Carica i partecipanti (per foglio firma e statistiche live)
      const { data: partData, error: partError } = await supabase
        .from('partecipanti')
        .select('*');
      if (partError) throw partError;
      setPartecipanti(partData);
      
      // Carica i report (per archivio)
      const { data: reportData, error: reportError } = await supabase
        .from('report_votazioni')
        .select('*');
      if (reportError) throw reportError;
      setReportVotazioni(reportData);

    } catch (error) {
      console.error("Errore nel caricamento dati:", error.message);
      setMessaggio({ testo: "Impossibile caricare i dati.", tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Carica tutto all'inizio

    // Sottoscrizione Realtime 1: Stato Votazione
    const statoChannel = supabase
      .channel('votazione_stato_channel_admin')
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'votazione_stato',
          filter: 'id=eq.1' 
        }, 
        (payload) => {
          console.log('Realtime: stato aggiornato!', payload.new);
          setVotazioneStato(payload.new);
          setNuovoTema(payload.new.tema_delibera || '');
          setNuovoCodice(payload.new.codice_accesso || '');
        }
      )
      .subscribe();
      
    // Sottoscrizione Realtime 2: Tabella Partecipanti (per statistiche live)
    // Ascolta INSERT, UPDATE, DELETE
    const partChannel = supabase
      .channel('partecipanti_channel_admin')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'partecipanti'
        }, 
        (payload) => {
          console.log('Realtime: partecipanti aggiornati!', payload);
          // Ricarica solo i partecipanti per aggiornare le statistiche
          fetchPartecipanti();
        }
      )
      .subscribe();
      
    // Sottoscrizione Realtime 3: Tabella Report (per archivio)
    // Ascolta INSERT, DELETE
    const reportChannel = supabase
      .channel('report_channel_admin')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'report_votazioni'
        }, 
        (payload) => {
          console.log('Realtime: report aggiornati!', payload);
          // Ricarica solo i report
          fetchReport();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(statoChannel);
      supabase.removeChannel(partChannel);
      supabase.removeChannel(reportChannel);
      // Pulisce i timeout se il componente si smonta
      clearTimeout(azzeraVotiTimeout);
      clearTimeout(svuotaListaTimeout);
    };
  }, []);
  
  // Funzioni di fetch parziali per il realtime
  const fetchPartecipanti = async () => {
     const { data, error } = await supabase.from('partecipanti').select('*');
     if (data) setPartecipanti(data);
  };
  const fetchReport = async () => {
     const { data, error } = await supabase.from('report_votazioni').select('*');
     if (data) setReportVotazioni(data);
  };


  // --- 2. FUNZIONI DI CONTROLLO ADMIN ---

  // Attiva/Disattiva Votazione
  const toggleVotazione = async () => {
    if (!votazioneStato) return;
    const nuovoStato = !votazioneStato.attiva;
    setMessaggio({ testo: '', tipo: '' });
    
    try {
      // Se stiamo CHIUDENDO, salviamo il report
      if (nuovoStato === false) {
        // Calcola le statistiche *attuali* prima di chiudere
        const { totale, favorevoli, contrari, astenuti } = statistiche;
        
        console.log("Salvataggio report in corso...");
        
        // Inserisci i dati calcolati nella tabella report
        const { data: reportSalvato, error: reportError } = await supabase
          .from('report_votazioni')
          .insert({
            tema_delibera: votazioneStato.tema_delibera || 'Nessun tema',
            totale_partecipanti: totale,
            voti_favorevoli: favorevoli,
            voti_contrari: contrari,
            voti_astenuti: astenuti
          })
          .select() // Restituisci la riga appena inserita
          .single(); // Ci aspettiamo un solo inserimento
          
        if (reportError) throw reportError;

        // Aggiorna lo stato React dei report *subito*, senza aspettare il realtime
        // per far funzionare l'export immediato
        setReportVotazioni(prevReport => [...prevReport, reportSalvato]);
        
        setMessaggio({ testo: 'Votazione chiusa e report salvato.', tipo: 'success' });
      }

      // Aggiorna lo stato della votazione (APRI o CHIUDI)
      const { error } = await supabase
        .from('votazione_stato')
        .update({ attiva: nuovoStato })
        .eq('id', 1);
      if (error) throw error;
      
      if (nuovoStato === true) {
         setMessaggio({ testo: 'Votazione APERTA.', tipo: 'success' });
      }
      
    } catch (error) {
      console.error("Errore in toggleVotazione/SalvaReport:", error.message);
      setMessaggio({ testo: "Errore durante l'aggiornamento dello stato.", tipo: 'error' });
    }
  };

  // Salva Tema
  const handleSalvaTema = async (e) => {
    e.preventDefault();
    if (!nuovoTema.trim()) return;
    setMessaggio({ testo: '', tipo: '' });
    
    try {
      const { error } = await supabase
        .from('votazione_stato')
        .update({ tema_delibera: nuovoTema.trim() })
        .eq('id', 1);
      if (error) throw error;
      setMessaggio({ testo: 'Nuovo tema salvato!', tipo: 'success' });
    } catch (error) {
      console.error("Errore in salvaTema:", error.message);
      setMessaggio({ testo: "Errore durante il salvataggio del tema.", tipo: 'error' });
    }
  };

  // Salva Codice
  const handleSalvaCodice = async (e) => {
    e.preventDefault();
    if (!nuovoCodice.trim()) return;
    setMessaggio({ testo: '', tipo: '' });
    
    try {
      const { error } = await supabase
        .from('votazione_stato')
        .update({ codice_accesso: nuovoCodice.trim() })
        .eq('id', 1);
      if (error) throw error;
      setMessaggio({ testo: 'Nuovo codice salvato!', tipo: 'success' });
    } catch (error) {
      console.error("Errore in salvaCodice:", error.message);
      setMessaggio({ testo: "Errore durante il salvataggio del codice.", tipo: 'error' });
    }
  };
  
  // Azzera solo i voti (ma non i partecipanti)
  const handleAzzeraVoti = async () => {
    setMessaggio({ testo: '', tipo: '' });

    if (!confirmAzzera) {
      setConfirmAzzera(true);
      setMessaggio({ testo: 'Clicca di nuovo per confermare l\'azzeramento dei voti.', tipo: 'warn' });
      azzeraVotiTimeout = setTimeout(() => setConfirmAzzera(false), 5000);
      return;
    }
    
    // Confermato
    clearTimeout(azzeraVotiTimeout);
    setConfirmAzzera(false);

    try {
      // Imposta 'voto_espresso' a NULL per tutti
      const { error } = await supabase
        .from('partecipanti')
        .update({ voto_espresso: null })
        .neq('voto_espresso', 'IS NULL'); // Aggiorna solo dove non è già null
        
      if (error) throw error;
      setMessaggio({ testo: 'Voti azzerati. I partecipanti possono rivotare.', tipo: 'success' });
      
    } catch (error) {
      console.error("Errore in azzeraVoti:", error.message);
      setMessaggio({ testo: "Errore durante l'azzeramento dei voti.", tipo: 'error' });
    }
  };

  // Svuota lista partecipanti E report
  const handleSvuotaPartecipanti = async () => {
    setMessaggio({ testo: '', tipo: '' });
    
    if (!confirmSvuota) {
      setConfirmSvuota(true);
      setMessaggio({ testo: 'ATTENZIONE: Verranno cancellati tutti i presenti E l\'archivio storico. Clicca di nuovo per confermare.', tipo: 'error' });
      svuotaListaTimeout = setTimeout(() => setConfirmSvuota(false), 5000);
      return;
    }
    
    // Confermato
    clearTimeout(svuotaListaTimeout);
    setConfirmSvuota(false);

    try {
      // Cancella dalla tabella 'partecipanti'
      const { error: partError } = await supabase
        .from('partecipanti')
        .delete()
        .not('id', 'is', null); // Cancella tutti
        
      if (partError) throw partError;
      
      // Cancella dalla tabella 'report_votazioni'
      const { error: reportError } = await supabase
        .from('report_votazioni')
        .delete()
        .not('id', 'is', null); // Cancella tutti
      
      if (reportError) throw reportError;
      
      setMessaggio({ testo: 'Lista presenti e archivio storico sono stati SVUOTATI.', tipo: 'success' });

    } catch (error) {
      console.error("Errore in SvuotaPartecipanti:", error.message);
      setMessaggio({ testo: "Errore durante lo svuotamento delle liste.", tipo: 'error' });
    }
  };

  // --- 3. CALCOLO STATISTICHE (Live) ---

  const statistiche = useMemo(() => {
    const totale = partecipanti.length;
    const votanti = partecipanti.filter(p => p.voto_espresso).length;
    const favorevoli = partecipanti.filter(p => p.voto_espresso === 'FAVOREVOLE').length;
    const contrari = partecipanti.filter(p => p.voto_espresso === 'CONTRARIO').length;
    const astenuti = partecipanti.filter(p => p.voto_espresso === 'ASTENUTO').length;
    const mancanti = totale - votanti;
    
    return { totale, votanti, favorevoli, contrari, astenuti, mancanti };
  }, [partecipanti]);

  
  // --- 4. FUNZIONI DI EXPORT CSV ---
  
  // Funzione helper per scaricare il CSV
  const downloadCSV = (filename, csvContent) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export 1: Foglio Firma
  const handleExportFoglioFirma = () => {
    setMessaggio({ testo: '', tipo: '' });
    if (partecipanti.length === 0) {
      setMessaggio({ testo: 'Nessun partecipante da esportare.', tipo: 'warn' });
      return;
    }
    
    let csv = 'Nome;Cognome;DataOraAccesso\n'; // Intestazioni
    
    // Funzione helper per formattare la data
    const formattaData = (dataString) => {
      try {
        const data = new Date(dataString);
        return data.toLocaleString('it-IT', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } catch (e) {
        return 'Data non valida';
      }
    };
    
    partecipanti.forEach(p => {
      // Usiamo ; come separatore per Excel Italia
      // Usiamo p.created_at per la data di accesso
      csv += `${p.nome};${p.cognome};${formattaData(p.created_at)}\n`;
    });
    
    downloadCSV('foglio_firma_presenti.csv', csv);
    setMessaggio({ testo: 'Foglio firma esportato!', tipo: 'success' });
  };
  
  // Export 2: Report Voti (Archivio)
  const handleExportReportVoti = () => {
    setMessaggio({ testo: '', tipo: '' });
    if (reportVotazioni.length === 0) {
      setMessaggio({ testo: 'Nessun report nell\'archivio da esportare.', tipo: 'warn' });
      return;
    }
    
    let csv = 'Data;TemaDelibera;TotalePresenti;Favorevoli;Contrari;Astenuti\n';
    
    const formattaData = (dataString) => {
      try {
        const data = new Date(dataString);
        return data.toLocaleString('it-IT', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } catch (e) {
        return 'Data non valida';
      }
    };
    
    reportVotazioni.forEach(r => {
      // Mette il tema tra virgolette per gestire eventuali ; nel testo
      csv += `${formattaData(r.created_at)};"${r.tema_delibera}";${r.totale_partecipanti};${r.voti_favorevoli};${r.voti_contrari};${r.voti_astenuti}\n`;
    });
    
    downloadCSV('report_archivio_votazioni.csv', csv);
     setMessaggio({ testo: 'Archivio report esportato!', tipo: 'success' });
  };

  // --- 5. RENDERING ---
  
  if (loading) return <div className="admin-container"><p>Caricamento...</p></div>;
  if (!votazioneStato) return <div className="admin-container"><p>Nessun dato sulla votazione trovato.</p></div>;

  const getMessaggioClassName = (tipo) => {
    if (tipo === 'error') return 'messaggio messaggio-error';
    if (tipo === 'warn') return 'messaggio messaggio-warn';
    if (tipo === 'success') return 'messaggio messaggio-success';
    return 'messaggio';
  };

  return (
    <div className="admin-container">
      {/* LOGO AGGIUNTO */}
      <img 
        src="/logo.png" 
        alt="Logo Scuola" 
        className="logo-scuola"
        onError={(e) => { e.target.style.display = 'none'; }} // Nasconde se il logo non carica
      />
      <h2>Pannello Amministratore</h2>
      
      {messaggio.testo && (
        <p className={getMessaggioClassName(messaggio.tipo)}>{messaggio.testo}</p>
      )}
      
      {/* Layout a griglia */}
      <div className="admin-layout-grid">
        
        {/* Colonna Sinistra (Controlli) */}
        <div className="admin-col-sinistra">
          
          <div className="admin-section">
            <h3>Stato Votazione</h3>
            <p>
              Stato attuale: 
              <strong className={votazioneStato.attiva ? 'attivo' : 'non-attivo'}>
                {votazioneStato.attiva ? ' APERTA' : ' CHIUSA'}
              </strong>
            </p>
            <button 
              onClick={toggleVotazione} 
              className={votazioneStato.attiva ? 'btn-stop' : 'btn-start'}
            >
              {votazioneStato.attiva ? 'Chiudi Votazione (e Salva Report)' : 'Apri Votazione'}
            </button>
          </div>
          
          <div className="admin-section">
            <h3>Imposta Tema (per prossima votazione)</h3>
            <form onSubmit={handleSalvaTema} className="form-codice">
              <label htmlFor="nuovo-tema">Tema della Delibera:</label>
              <input 
                type="text" 
                id="nuovo-tema"
                value={nuovoTema}
                onChange={(e) => setNuovoTema(e.target.value)}
                placeholder="Es. Approvazione Bilancio"
              />
              <button type="submit" className="btn-primary">
                Salva Tema
              </button>
            </form>
          </div>
          
           <div className="admin-section">
            <h3>Imposta Codice (per questa seduta)</h3>
            <form onSubmit={handleSalvaCodice} className="form-codice">
              <label htmlFor="nuovo-codice">Codice di Accesso:</label>
              <input 
                type="text" 
                id="nuovo-codice"
                value={nuovoCodice}
                onChange={(e) => setNuovoCodice(e.target.value)}
                placeholder="Es. VOTO2025"
              />
              <button type="submit" className="btn-primary">
                Salva Codice
              </button>
            </form>
          </div>
        </div>
        
        {/* Colonna Destra (Statistiche e Azioni) */}
        <div className="admin-col-destra">
          
          <div className="admin-section">
            <h3>Statistiche in Tempo Reale</h3>
            <div className="stat-grid">
              <div className="stat-item">
                <span>Totale Presenti</span>
                <strong>{statistiche.totale}</strong>
              </div>
              <div className="stat-item">
                <span>Voti Espressi</span>
                <strong>{statistiche.votanti}</strong>
              </div>
              <div className="stat-item">
                <span>Voti Mancanti</span>
                <strong>{statistiche.mancanti}</strong>
              </div>
              <div className="stat-item">
                <span style={{ color: 'var(--colore-secondario)' }}>Favorevoli</span>
                <strong>{statistiche.favorevoli}</strong>
              </div>
              <div className="stat-item">
                <span style={{ color: 'var(--colore-stop)' }}>Contrari</span>
                <strong>{statistiche.contrari}</strong>
              </div>
              <div className="stat-item">
                <span style={{ color: 'var(--colore-wait)' }}>Astenuti</span>
                <strong>{statistiche.astenuti}</strong>
              </div>
            </div>
          </div>
          
          <div className="admin-section">
            <h3>Azioni e Report</h3>
            <div className="admin-actions">
              <button onClick={handleAzzeraVoti} className="btn-secondary">
                {confirmAzzera ? 'CONFERMI?' : 'Azzera Voti Attuali'}
              </button>
              <button onClick={handleExportFoglioFirma} className="btn-export">
                Scarica Foglio Firma
              </button>
              <button onClick={handleExportReportVoti} className="btn-export">
                Scarica Report Voti (Archivio)
              </button>
              <button onClick={handleSvuotaPartecipanti} className="btn-stop">
                 {confirmSvuota ? 'CONFERMI SVUOTA?' : 'Svuota Lista Partecipanti'}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}


export default AdminPage;
