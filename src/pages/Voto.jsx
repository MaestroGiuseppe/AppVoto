import { useState } from "react";
import { supabase } from "../supabase";

export default function Voto() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [codice, setCodice] = useState("");
  const [abilitato, setAbilitato] = useState(false);
  const [votato, setVotato] = useState(false);

  const verificaCodice = async () => {
    const { data } = await supabase
      .from("codici")
      .select("*")
      .eq("codice", codice)
      .maybeSingle();

    if (data) setAbilitato(true);
    else alert("Codice non valido");
  };

  const inviaVoto = async (scelta) => {
    await supabase.from("voti").insert([
      { nome, cognome, codice, voto: scelta },
    ]);
    setVotato(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
      {!abilitato ? (
        <div className="bg-white text-gray-800 p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Accesso alla votazione</h2>
          <input
            className="border p-2 w-full mb-2 rounded"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className="border p-2 w-full mb-2 rounded"
            placeholder="Cognome"
            value={cognome}
            onChange={(e) => setCognome(e.target.value)}
          />
          <input
            className="border p-2 w-full mb-4 rounded"
            placeholder="Codice"
            value={codice}
            onChange={(e) => setCodice(e.target.value)}
          />
          <button
            onClick={verificaCodice}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Entra
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">
            Benvenuto, {nome} {cognome}
          </h2>
          {votato ? (
            <p className="text-xl">✅ Hai già espresso il tuo voto.</p>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={() => inviaVoto("Favorevole")}
                className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
              >
                Favorevole
              </button>
              <button
                onClick={() => inviaVoto("Contrario")}
                className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
              >
                Contrario
              </button>
              <button
                onClick={() => inviaVoto("Astenuto")}
                className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600"
              >
                Astenuto
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
