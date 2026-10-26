import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './authContext';
import type { AuthUsuario } from './types';
import { API_URL } from './config/api';
import AuthLayout from './components/auth/AuthLayout';
import Alert from './components/ui/Alert';
import { btnPrimaryClass, linkClass } from './components/auth/authStyles';
import AuthField from './components/auth/AuthField';
import PasswordField from './components/auth/PasswordField';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const {
    loginGlobal,
    token,
    usuario,
    cargando: cargandoSesion,
    errorSesion,
    limpiarErrorSesion,
  } = useAuthContext();

  useEffect(() => {
    if (!cargandoSesion && token && usuario) {
      navigate('/dashboard', { replace: true });
    }
  }, [cargandoSesion, token, usuario, navigate]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [erroresCampos, setErroresCampos] = useState({ email: '', password: '' });
  const [cargando, setCargando] = useState(false);

  const manejarLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    limpiarErrorSesion();

    const errores = {
      email: !email.trim()
        ? 'Ingresá tu correo electrónico.'
        : !EMAIL_VALIDO.test(email.trim())
          ? 'Ingresá un correo electrónico válido.'
          : '',
      password: !password ? 'Ingresá tu contraseña.' : '',
    };
    setErroresCampos(errores);
    if (errores.email || errores.password) return;

    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/api/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const datos = await respuesta.json() as {
        mensaje?: string;
        token: string;
        usuario: AuthUsuario;
      };

      if (!respuesta.ok) {
        if (respuesta.status === 401) {
          setErroresCampos((actuales) => ({
            ...actuales,
            password: 'El correo o la contraseña no son correctos.',
          }));
        } else {
          throw new Error(datos.mensaje || 'No se pudo iniciar sesión.');
        }
        return;
      }

      loginGlobal(datos.usuario, datos.token);
    
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresá con tu email y contraseña"
    >
      <div className="space-y-4">
        {errorSesion && (
          <Alert type="error" theme="light">
            {errorSesion}
          </Alert>
        )}
        {error && (
          <Alert type="error" theme="light" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {mensaje && (
          <Alert type="success" theme="light" onClose={() => setMensaje('')}>
            {mensaje}
          </Alert>
        )}

        <form onSubmit={manejarLogin} noValidate className="space-y-5">
          <AuthField
            id="email"
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => {
              const nuevoEmail = e.target.value;
              setEmail(nuevoEmail);
              setErroresCampos((actuales) => ({
                ...actuales,
                email: actuales.email
                  ? !nuevoEmail.trim()
                    ? 'Ingresá tu correo electrónico.'
                    : !EMAIL_VALIDO.test(nuevoEmail.trim())
                      ? 'Ingresá un correo electrónico válido.'
                      : ''
                  : '',
              }));
            }}
            onBlur={() => setErroresCampos((actuales) => ({
              ...actuales,
              email: !email.trim()
                ? 'Ingresá tu correo electrónico.'
                : !EMAIL_VALIDO.test(email.trim())
                  ? 'Ingresá un correo electrónico válido.'
                  : '',
            }))}
            placeholder="Ingrese su correo electrónico"
            autoComplete="email"
            error={erroresCampos.email}
          />

          <PasswordField
            id="password"
            label="Contraseña"
            value={password}
            onChange={(e) => {
              const nuevaPassword = e.target.value;
              setPassword(nuevaPassword);
              setErroresCampos((actuales) => ({
                ...actuales,
                password: actuales.password && !nuevaPassword ? 'Ingresá tu contraseña.' : '',
              }));
            }}
            onBlur={() => setErroresCampos((actuales) => ({
              ...actuales,
              password: password ? '' : 'Ingresá tu contraseña.',
            }))}
            error={erroresCampos.password}
            autoComplete="current-password"
          />

          <button type="submit" disabled={cargando} className={btnPrimaryClass}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center pt-2">
          <button type="button" onClick={() => navigate('/registro')} className={linkClass}>
            ¿No tenés cuenta? Registrate aquí
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
