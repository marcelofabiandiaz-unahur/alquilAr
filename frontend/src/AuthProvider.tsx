import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import type { ReactNode } from 'react';
import type { AuthUsuario } from './types';
import { mapearPerfilAAuthUsuario } from './lib/authSession';
import { ApiError, apiGet, SESION_NO_AUTORIZADA_EVENTO } from './lib/apiClient';

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
  const [errorSesion, setErrorSesion] = useState('');

  const logoutGlobal = useCallback(() => {
    setToken(null);
    setUsuario(null);
    setErrorSesion('');
    limpiarSesionStorage();
  }, []);

  const loginGlobal = useCallback((datosUsuario: AuthUsuario, tokenUsuario: string) => {
    setToken(tokenUsuario);
    setUsuario(datosUsuario);
    setErrorSesion('');
    persistirSesion(datosUsuario, tokenUsuario);
  }, []);

  const limpiarErrorSesion = useCallback(() => setErrorSesion(''), []);

  useEffect(() => {
    const manejarSesionNoAutorizada = () => {
      logoutGlobal();
      setErrorSesion('Tu sesión venció o ya no tenés permisos. Iniciá sesión nuevamente.');
    };

    window.addEventListener(SESION_NO_AUTORIZADA_EVENTO, manejarSesionNoAutorizada);
    return () => window.removeEventListener(SESION_NO_AUTORIZADA_EVENTO, manejarSesionNoAutorizada);
  }, [logoutGlobal]);

  useEffect(() => {
    const tokenGuardado = leerTokenGuardado();
    if (!tokenGuardado) {
      return;
    }

    let cancelled = false;

    const validarSesion = async () => {
      try {
        const perfil = await apiGet<unknown>('/api/usuarios/me', tokenGuardado);

        if (cancelled) return;

        const authUsuario = mapearPerfilAAuthUsuario(perfil);

        if (!authUsuario) {
          logoutGlobal();
          setErrorSesion('No se pudo validar tu perfil. Iniciá sesión nuevamente.');
          return;
        }

        setToken(tokenGuardado);
        setUsuario(authUsuario);
        persistirSesion(authUsuario, tokenGuardado);
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          logoutGlobal();
          setErrorSesion('Tu sesión venció o ya no tenés permisos. Iniciá sesión nuevamente.');
          return;
        }

        setErrorSesion(
          error instanceof Error
            ? error.message
            : 'No se pudo validar la sesión. Verificá la conexión con el servidor.',
        );
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
    <AuthContext.Provider
      value={{ usuario, token, cargando, errorSesion, loginGlobal, logoutGlobal, limpiarErrorSesion }}
    >
      {children}
    </AuthContext.Provider>
  );
}
