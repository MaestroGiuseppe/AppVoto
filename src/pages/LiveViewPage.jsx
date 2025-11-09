import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../SupabaseClient.js';
import '../App.css'; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Colori che corrispondono al nostro tema
const COLORS = {
  FAVOREVOLE: '#34c759',
  CONTRARIO: '#ff3b30',
  ASTENUTO: '#ff9500',
  MANCANTE: '#6c6c70'
};

function LiveViewPage() {
  const [votazioneStato, setVotazioneStato] = useState(null);
  const [partecipanti, setPartecipanti] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Calcola le statistiche e formatta i dati per il grafico
  const chartData = useMemo(() => {
    const totale = partecipanti.length;
    const favorevoli = partecipanti.filter(p => p.voto_espresso === 'FAVOREVOLE').length;
    const contrari = partecipanti.filter(p => p.voto_espresso === 'CONTRARIO').length;
    const astenuti = partecipanti.filter(p => p.voto_espresso === 'ASTENUTO').length;
    const votanti = favorevoli + contrari + astenuti;
    const mancanti = totale - votanti;

    return {
      // Dati per il grafico a barre
      voti: [
        { name: 'Favorevoli', voti: favorevoli, fill: COLORS.FAVOREVOLE },
        { name: 'Contrari', voti: contrari, fill: COLORS.CONTRARIO },
        { name: 'Astenuti', voti: astenuti, fill: COLORS.ASTENUTO },
      ],
      // Dati per i totali
      totali: {
        presenti: totale,
        votanti: votanti,
        mancanti: mancanti
      }
    };
  }, [partecipanti]);

  // Caricamento dati iniziale e sottoscrizione Realtime
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Carica stato
        const { data: statoData, error: statoError } = await supabase
          .from('votazione_stato')
          .select('*')
          .eq('id', 1)
          .single();
        if (statoError) throw statoError;
        setVotazioneStato(statoData);

        // Carica partecipanti
        const { data: partData, error: partError } = await supabase
          .from('partecipanti')
          .select('*');
        if (partError) throw partError;
        setPartecipanti(partData);
        
      } catch (err) {
        console.error("Errore caricamento dati LiveView:", err.message);
        setError("Impossibile caricare i dati.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Sottoscrizione 1: Stato Votazione (per tema e stato)
    const statoChannel = supabase
      .channel('votazione_stato_channel_liveview')
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'votazione_stato',
          filter: 'id=eq.1' 
        }, 
        (payload) => {
          console.log('Realtime (Stato) su LIM:', payload.new);
          setVotazioneStato(payload.new);
        }
      )
      .subscribe();
      
    // Sottoscrizione 2: Partecipanti (per voti)
    const partChannel = supabase
      .channel('partecipanti_channel_liveview')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'partecipanti'
        }, 
        (payload) => {
          console.log('Realtime (Partecipanti) su LIM:', payload);
          // Ricarica tutti i partecipanti per aggiornare i grafici
          (async () => {
            const { data: partData, error: partError } = await supabase
              .from('partecipanti')
              .select('*');
            if (partData) setPartecipanti(partData);
          })();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(statoChannel);
      supabase.removeChannel(partChannel);
    };
  }, []);

  if (loading) return <div className="liveview-container"><h2 className="live-title">Caricamento...</h2></div>;
  if (error) return <div className="liveview-container"><h2 className="live-title" style={{ color: 'var(--colore-stop)'}}>{error}</h2></div>;
  if (!votazioneStato) return <div className="liveview-container"><h2 className="live-title">Nessun dato trovato.</h2></div>;

  return (
    <div className="liveview-container">
      
      <div className="live-header">
        <h2 className="live-title">{votazioneStato.tema_delibera || 'Nessun tema impostato'}</h2>
        <div className={`live-status ${votazioneStato.attiva ? 'attivo' : 'non-attivo'}`}>
          VOTAZIONE {votazioneStato.attiva ? 'APERTA' : 'CHIUSA'}
        </div>
      </div>

      <div className="live-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.voti} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="#ffffff" 
              fontSize={24} 
              tickMargin={10} 
              width={150} 
            />
            <Tooltip 
              cursor={{fill: 'rgba(255,255,255,0.1)'}}
              contentStyle={{ backgroundColor: 'var(--colore-testo)', borderRadius: '8px' }} 
            />
            <Bar dataKey="voti" barSize={60} radius={[0, 8, 8, 0]}>
              {chartData.voti.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="live-stats-grid">
        <div className="live-stat-item">
          <span>Totale Presenti</span>
          <strong>{chartData.totali.presenti}</strong>
        </div>
        <div className="live-stat-item">
          <span>Voti Espressi</span>
          <strong>{chartData.totali.votanti}</strong>
        </div>
        <div className="live-stat-item">
          <span>Voti Mancanti</span>
          <strong>{chartData.totali.mancanti}</strong>
        </div>
      </div>

    </div>
  );
}

export default LiveViewPage;