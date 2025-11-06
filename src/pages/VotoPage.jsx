import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../SupabaseClient.js';
import '../App.css'; // Assicurati che il percorso sia corretto

// Funzione helper per le classi CSS dei messaggi (identica a AdminPage)
const getMessaggioClassName = (tipo) => {
  if (tipo === 'error') return 'messaggio messaggio-error';
  if (tipo === 'warn') return 'messaggio messaggio-warn';
  if (tipo === 'success') return 'messaggio messaggio-success';
  return 'messaggio';
};

function VotoPage() {
  const [votazioneStato, setVotazioneStato] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // *** LOGICA MESSAGGI ALLINEATA AD ADMINPAGE ***
  const [messaggio, setMessaggio] = useState({ testo: '', tipo: '' }); // {testo, tipo}

  // Stati per il login
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [codiceInserito, setCodiceInserito] = useState('');

  // Stato del partecipante loggato
  const [partecipante, setPartecipante] = useState(null); // Contiene {id, nome, cognome, voto_espresso}

  // --- Funzioni Helper per Stili Dinamici ---
  
  const { haGiaVotato, votazioneChiusa } = useMemo(() => {
    const haGiaVotato = !!partecipante?.voto_espresso;
    const votazioneChiusa = !votazioneStato?.attiva;
    return { haGiaVotato, votazioneChiusa };
  }, [partecipante, votazioneStato]);

  const getVotoBtnClassName = (voto) => {
    let className = 'btn-voto';
    if (partecipante?.voto_espresso === voto) {
      className += ' voted';
    }
    return className;
  };

  // --- Caricamento Dati e Realtime ---

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('votazione_stato')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      setVotazioneStato(data);

    } catch (error) {
      console.error("Errore nel fetchStatoVotazione:", error.message);
      setMessaggio({ testo: 'Impossibile caricare lo stato della votazione.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Canale 1: Ascolta i cambiamenti dello STATO VOTAZIONE (globale)
    const statoChannel = supabase
      .channel('votazione_stato_channel_voto')
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'votazione_stato',
          filter: 'id=eq.1'
        }, 
        (payload) => {
          console.log('Realtime: stato votazione aggiornato!', payload.new);
          setVotazioneStato(payload.new);
        }
      )
      .subscribe();
      
    // Canale 2: Ascolta i cambiamenti SUL MIO VOTO
    let votoChannel = null;
    if (partecipante) {
      votoChannel = supabase
        .channel(`voto_personale_channel_${partecipante.id}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'partecipanti',
            filter: `id=eq.${partecipante.id}`
          },
          (payload) => {
            console.log('Realtime: Il mio voto è stato aggiornato!', payload.new);
            setPartecipante(payload.new);
          }
        )
        .subscribe();
    }

    // Cleanup
    return () => {
      supabase.removeChannel(statoChannel);
      if (votoChannel) {
        supabase.removeChannel(votoChannel);
      }
    };
  }, [partecipante]); 

  // --- Gestione Eventi ---

  const handleAccesso = async (e) => {
    e.preventDefault();
    setMessaggio({ testo: '', tipo: '' }); // Resetta messaggio

    if (!nome.trim() || !cognome.trim() || !codiceInserito.trim()) {
      setMessaggio({ testo: 'Tutti i campi (Nome, Cognome, Codice) sono obbligatori.', tipo: 'error' });
      return;
    }
    
    if (!votazioneStato) {
       setMessaggio({ testo: 'Stato votazione non ancora caricato. Riprova.', tipo: 'warn' });
       return;
    }
    
    // LOGICA LOGO: Aggiunta
    if (votazioneStato.codice_accesso !== codiceInserito.trim()) {
      setMessaggio({ testo: 'Codice di accesso ERRATO.', tipo: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partecipanti')
        .upsert(
          { 
            nome: nome.trim(), 
            cognome: cognome.trim() 
          },
          { 
            onConflict: 'nome_cognome_unique',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) throw error;
      
      console.log('Accesso riuscito:', data);
      setPartecipante(data);
      setMessaggio({ testo: 'Accesso effettuato. Benvenuto.', tipo: 'success' });

    } catch (error) { // *** QUESTO E' IL BLOCCO CORRETTO ***
      console.error("Errore Upsert partecipante:", error.message);
      if (error.message.includes('duplicate key')) {
         setMessaggio({ testo: 'Errore: combinazione Nome/Cognome già presente.', tipo: 'error' });
      } else {
         setMessaggio({ testo: 'Errore imprevisto during l\'accesso.', tipo: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVoto = async (votoScelto) => {
    if (haGiaVotato || votazioneChiusa || !partecipante) return;

    setLoading(true);
    setMessaggio({ testo: '', tipo: '' }); // Resetta

    try {
      const { data, error } = await supabase
        .from('partecipanti')
        .update({ voto_espresso: votoScelto })
        .eq('id', partecipante.id)
        .select()
        .single();
      
      if (error) throw error;

      console.log('Voto registrato:', data);
      setMessaggio({ testo: 'Voto registrato con successo!', tipo: 'success' });

    } catch (error) {
      console.error("Errore during la registrazione del voto:", error.message);
      setMessaggio({ testo: 'Errore: impossibile registrare il voto.', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- Rendering ---

  if (loading && !partecipante) return <div className="voto-container"><p>Caricamento...</p></div>;

  // Vista 1: Schermata di Login
  if (!partecipante) {
    return (
      <div className="voto-container">
        {/* LOGO AGGIUNTO */}
        <img 
          src="/logo.png" 
          alt="Logo Scuola" 
          className="logo-scuola"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h2>Accesso Votazione</h2>
        <p>Inserisci i tuoi dati e il codice della seduta.</p>
        
        <form onSubmit={handleAccesso} className="login-form">
          <input 
            type="text" 
            placeholder="Nome" 
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Cognome" 
            value={cognome}
            onChange={(e) => setCognome(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Codice Votazione" 
            value={codiceInserito}
            onChange={(e) => setCodiceInserito(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Accesso in corso...' : 'Accedi per Votare'}
          </button>
        </form>
        {messaggio.testo && (
          <p className={getMessaggioClassName(messaggio.tipo)}>{messaggio.testo}</p>
        )}
        <div className="stato-footer">
          Stato: 
          <strong className={votazioneStato?.attiva ? 'attivo' : 'non-attivo'}>
             {votazioneStato?.attiva ? ' APERTA' : ' CHIUSA'}
          </strong>
        </div>
      </div>
    );
  }

  // Vista 2: Schermata di Voto
  return (
    <div className="voto-container">
      {/* LOGO AGGIUNTO */}
      <img 
        src="/logo.png" 
        alt="Logo Scuola" 
        className="logo-scuola"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      
      <h3>Benvenuto, {partecipante.nome} {partecipante.cognome}</h3>
      <p>Delibera del Giorno:</p>
      <h2 className="tema-delibera">
        {votazioneStato?.tema_delibera || 'Nessun tema impostato.'}
      </h2>
      
      <div className="voto-buttons">
        <button 
          className={getVotoBtnClassName('FAVOREVOLE')}
          onClick={() => handleVoto('FAVOREVOLE')}
          disabled={loading || haGiaVotato || votazioneChiusa}
        >
          Favorevole
        </button>
        <button 
          className={getVotoBtnClassName('CONTRARIO')}
          onClick={() => handleVoto('CONTRARIO')}
          disabled={loading || haGiaVotato || votazioneChiusa}
        >
          Contrario
        </button>
        <button 
          className={getVotoBtnClassName('ASTENUTO')}
          onClick={() => handleVoto('ASTENUTO')}
          disabled={loading || haGiaVotato || votazioneChiusa}
        >
          Astenuto
        </button>
      </div>

      {messaggio.testo && (
        <p className={getMessaggioClassName(messaggio.tipo)}>{messaggio.testo}</p>
      )}

      {/* Messaggio di stato persistente */}
      {!haGiaVotato && votazioneChiusa && (
         <p className="messaggio messaggio-error">
           La votazione è CHIUSA. Non è possibile votare.
         </p>
      )}
      {haGiaVotato && (
         <p className="messaggio messaggio-success">
           Hai già votato: <strong>{partecipante.voto_espresso}</strong>.
           {votazioneChiusa && " La votazione è ora chiusa."}
         </p>
      )}
      {!haGiaVotato && !votazioneChiusa && (
          <p className="messaggio">La votazione è APERTA. Esprimi il tuo voto.</p>
      )}

    </div>
  );
}


export default VotoPage;
