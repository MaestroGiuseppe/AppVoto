import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Admin() {
  const [codice, setCodice] = useState("");
  const [attivo, setAttivo] = useState(false);
  const [stat, setStat] = useState({ tot: 0, favorevoli: 0, contrari: 0, astenuti: 0 });

  const aggiungiCodice = async () => {
    await supabase.from("codici").insert([{ codice }]);
    setCodice("");
    alert("Codice aggiunto!");
  };

  const cambiaStato = async () => {
    setAttivo(!attivo);
    alert(`Votazione ${!attivo ? "attivata" : "disattivata"}`);
  };

  const aggiornaStatistiche = async () => {
    const { data } = await supabase.from("voti").select("*");
    const favorevoli = data.filter(v => v.voto === "Favorevole").length;
    const contrari = data.filter(v => v.voto === "Contrario").length;
    const astenuti = data.filter(v => v.voto === "Astenuto").length;
    setStat({ tot: data.length, favorevoli, contrari, astenuti });
  };

  useEffect(() => {
    aggiornaStatistiche();
    const interval = setInterval(aggiornaStatistiche, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-500 to-pink-600 text-white">
      <h1 className="text-4xl font-bold mb-6">Pannello Amministratore</h1>

      <div className="flex gap-4 mb-6">
        <input
          className="border p-2 rounded text-black"
          placeholder="Nuovo codice univoco"
          value={codice}
          onChange={(e) => setCodice(e.target.value)}
        />
        <button onClick={aggiungiCodice} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
          Aggiungi codice
        </button>
      </div>

      <button
        onClick={cambiaStato}
        className={`px-6 py-3 rounded font-bold ${attivo ? "bg-red-600" : "bg-green-600"} hover:opacity-90`}
      >
        {attivo ? "Disattiva votazione" : "Attiva votazione"}
      </button>

      <div className="mt-8 text-lg bg-white text-gray-800 rounded-2xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Statistiche</h2>
        <p>Totale voti: {stat.tot}</p>
        <p>Favorevoli: {stat.favorevoli}</p>
        <p>Contrari: {stat.contrari}</p>
        <p>Astenuti: {stat.astenuti}</p>
      </div>
    </div>
  );
}
