import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importazioni corrette, con estensione .jsx
import VotoPage from './pages/VotoPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
// *** NUOVA PAGINA IMPORTATA ***
import LiveViewPage from './pages/LiveViewPage.jsx';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* La rotta per i votanti */}
        <Route path="/" element={<VotoPage />} />
        
        {/* La rotta per l'amministratore */}
        <Route path="/admin" element={<AdminPage />} />
        
        {/* *** NUOVA ROTTA PER LA LIM *** */}
        <Route path="/liveview" element={<LiveViewPage />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;