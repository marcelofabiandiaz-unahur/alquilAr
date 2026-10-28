import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from './authContext';
import type { ReactNode } from 'react';
import type { AuthUsuario } from './types';
import { API_URL } from './config/api';
import { mapearPerfilAAuthUsuario } from './lib/authSession';
import { SESION_NO_AUTORIZADA_EVENTO } from './lib/apiClient';

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
  const versionSesion = useRef(0);
  const tokenActual = useRef(tokenInicial);

  const logoutGlobal = useCallback(() => {
    versionSesion.current += 1;
    tokenActual.current = null;
    setToken(null);
    setUsuario(null);
    setCargando(false);
    setErrorSesion('');
    limpiarSesionStorage();
  }, []);

  const loginGlobal = useCallback((datosUsuario: AuthUsuario, tokenUsuario: string) => {
    versionSesion.current += 1;
    tokenActual.current = tokenUsuario;
    setToken(tokenUsuario);
    setUsuario(datosUsuario);
    setCargando(false);
    setErrorSesion('');
    persistirSesion(datosUsuario, tokenUsuario);
  }, []);

  const limpiarErrorSesion = useCallback(() => setErrorSesion(''), []);

  useEffect(() => {
    const manejarSesionNoAutorizada = (evento: Event) => {
      const tokenSolicitud = evento instanceof CustomEvent
        ? (evento.detail as { token?: string | null } | undefined)?.token
        : undefined;
      if (tokenSolicitud && tokenSolicitud !== tokenActual.current) return;
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
    const versionValidacion = ++versionSesion.current;
    const validacionActual = () => !cancelled && versionSesion.current === versionValidacion;

    const validarSesion = async () => {
      try {
        const res = await fetch(`${API_URL}/api/usuarios/me`, {
          headers: { Authorization: `Bearer ${tokenGuardado}` },
        });

        if (!validacionActual()) return;

        if (res.status === 401 || res.status === 403) {
          logoutGlobal();
          setErrorSesion('Tu sesión venció o ya no tenés permisos. Iniciá sesión nuevamente.');
          return;
        }
        if (!res.ok) {
          throw new Error(`No se pudo validar la sesión (error ${res.status}).`);
        }

        const perfil: unknown = await res.json();
        if (!validacionActual()) return;
        const authUsuario = mapearPerfilAAuthUsuario(perfil);

        if (!authUsuario) {
          logoutGlobal();
          setErrorSesion('No se pudo validar tu perfil. Iniciá sesión nuevamente.');
          return;
        }

        setToken(tokenGuardado);
        setUsuario(authUsuario);
        tokenActual.current = tokenGuardado;
        persistirSesion(authUsuario, tokenGuardado);
      } catch (error) {
        if (validacionActual()) {
          setErrorSesion(
            error instanceof Error
              ? error.message
              : 'No se pudo validar la sesión. Verificá la conexión con el servidor.',
          );
        }
      } finally {
        if (validacionActual()) {
          setCargando(false);
        }
      }
    };

    void validarSesion();

    return () => {
      cancelled = true;
      if (versionSesion.current === versionValidacion) {
        versionSesion.current += 1;
      }
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
