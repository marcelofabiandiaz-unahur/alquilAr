import { useState } from 'react';
import { AuthContext } from './authContext';
import type { ReactNode } from 'react';
import type { AuthUsuario } from './types';

function leerSesion(): { token: string | null; usuario: AuthUsuario | null } {
  const tokenGuardado = localStorage.getItem('token_arquilar');
  const usuarioGuardado = localStorage.getItem('usuario_arquilar');

  if (!tokenGuardado || !usuarioGuardado) {
    return { token: null, usuario: null };
  }

  try {
    return { token: tokenGuardado, usuario: JSON.parse(usuarioGuardado) };
  } catch {
    localStorage.removeItem('token_arquilar');
    localStorage.removeItem('usuario_arquilar');
    return { token: null, usuario: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sesionInicial = leerSesion();
  const [usuario, setUsuario] = useState<AuthUsuario | null>(sesionInicial.usuario);
  const [token, setToken] = useState(sesionInicial.token);
  const cargando = false;

  const loginGlobal = (datosUsuario: AuthUsuario, tokenUsuario: string) => {
    setToken(tokenUsuario);
    setUsuario(datosUsuario);
    localStorage.setItem('token_arquilar', tokenUsuario);
    localStorage.setItem('usuario_arquilar', JSON.stringify(datosUsuario));
  };

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
