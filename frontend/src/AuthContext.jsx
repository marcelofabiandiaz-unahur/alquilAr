import React, { createContext, useState, useEffect } from 'react';

// Crear el contexto propiamente dicho
export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al cargar la app por primera vez, recuperamos la sesión si existe
  useEffect(() => {
    const tokenGuardado = localStorage.getItem('token_arquilar');
    const usuarioGuardado = localStorage.getItem('usuario_arquilar');

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      setUsuario(JSON.parse(usuarioGuardado));
    }
    setCargando(false);
  }, []);

  // Función global para iniciar sesión
  const loginGlobal = (datosUsuario, tokenUsuario) => {
    setToken(tokenUsuario);
    setUsuario(datosUsuario);
    localStorage.setItem('token_arquilar', tokenUsuario);
    localStorage.setItem('usuario_arquilar', JSON.stringify(datosUsuario));
  };

  // Función global para cerrar sesión
  const logoutGlobal = () => {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token_arquilar');
    localStorage.removeItem('usuario_arquilar');
  };

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, loginGlobal, logoutGlobal }}>
      {children}
    </AuthContext.Provider>
  );
}
