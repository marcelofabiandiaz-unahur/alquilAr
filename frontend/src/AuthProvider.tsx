import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import type { ReactNode } from 'react';
import type { AuthUsuario } from './types';
import { API_URL } from './config/api';
import { mapearPerfilAAuthUsuario } from './lib/authSession';

function leerTokenGuardado(): string | null {
  return localStorage.getItem('token_arquilar');
}

function persistirSesion(datosUsuario: AuthUsuario, tokenUsuario: string) {
  localStorage.setItem('token_arquilar', tokenUsuario);
  localStorage.setItem('usuario_arquilar', JSON.stringify(datosUsuario));
}

function limpiarSesionStorage() {
  localStorage.removeItem('token_arquilar');
  localStorage.removeItem('usuario_arquilar');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenInicial = leerTokenGuardado();
  const [usuario, setUsuario] = useState<AuthUsuario | null>(null);
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [cargando, setCargando] = useState(Boolean(tokenInicial));

  const logoutGlobal = useCallback(() => {
    setToken(null);
    setUsuario(null);
    limpiarSesionStorage();
  }, []);

  const loginGlobal = useCallback((datosUsuario: AuthUsuario, tokenUsuario: string) => {
    setToken(tokenUsuario);
    setUsuario(datosUsuario);
    persistirSesion(datosUsuario, tokenUsuario);
  }, []);

  useEffect(() => {
    const tokenGuardado = leerTokenGuardado();
    if (!tokenGuardado) {
      setCargando(false);
      return;
    }

    let cancelled = false;

    const validarSesion = async () => {
      try {
        const res = await fetch(`${API_URL}/api/usuarios/me`, {
          headers: { Authorization: `Bearer ${tokenGuardado}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          logoutGlobal();
          setCargando(false);
          return;
        }

        const perfil: unknown = await res.json();
        const authUsuario = mapearPerfilAAuthUsuario(perfil);

        if (!authUsuario) {
          logoutGlobal();
          setCargando(false);
          return;
        }

        setToken(tokenGuardado);
        setUsuario(authUsuario);
        persistirSesion(authUsuario, tokenGuardado);
      } catch {
        if (!cancelled) {
          logoutGlobal();
        }
      } finally {
        if (!cancelled) {
          setCargando(false);
        }
      }
    };

    void validarSesion();

    return () => {
      cancelled = true;
    };
  }, [logoutGlobal]);

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, loginGlobal, logoutGlobal }}>
      {children}
    </AuthContext.Provider>
  );
}
