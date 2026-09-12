import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Registro from './Registro';
import Dashboard from './Dashboard'; // 👈 Importamos la nueva pantalla

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/dashboard" element={<Dashboard />} /> {/* 👈 Registramos la ruta /dashboard */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
