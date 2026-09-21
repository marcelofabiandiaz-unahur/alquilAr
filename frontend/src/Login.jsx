import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { API_URL } from './config/api';
import AuthLayout from './components/auth/AuthLayout';
import Alert from './components/ui/Alert';
import { labelClass, inputClass, btnPrimaryClass, linkClass } from './components/auth/authStyles';

export default function Login() {
  const navigate = useNavigate();
  const { loginGlobal } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/api/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al iniciar sesión');
      }

      loginGlobal(datos.usuario, datos.token);
      setMensaje(`¡Bienvenido/a, ${datos.usuario.nombre}! Inicio de sesión correcto.`);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setError(err.message);
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

        <form onSubmit={manejarLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@alquilar.com"
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
              autoComplete="current-password"
            />
          </div>

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
