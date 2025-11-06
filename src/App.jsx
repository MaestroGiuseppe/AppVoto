import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importazioni corrette, con estensione .jsx
import VotoPage from './pages/VotoPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* La rotta per i votanti */}
        <Route path="/" element={<VotoPage />} />
        
        {/* La rotta per l'amministratore */}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;