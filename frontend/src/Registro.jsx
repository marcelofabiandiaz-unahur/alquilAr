import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config/api';
import AuthLayout from './components/auth/AuthLayout';
import Alert from './components/ui/Alert';
import {
  labelClassSm,
  inputClassSm,
  btnPrimaryClassSm,
  linkClass,
} from './components/auth/authStyles';

export default function Registro() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarRegistro = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/api/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          dni,
          email,
          password,
          telefono,
          roles: ['USUARIO'],
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al registrar el usuario');
      }

      setMensaje('¡Registro exitoso! Redirigiendo al inicio de sesión...');

      setTimeout(() => {
        navigate('/');
      }, 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Completá tus datos para registrarte en AlquilAR"
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

        <form onSubmit={manejarRegistro} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className={labelClassSm}>Nombre</label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClassSm}
              />
            </div>
            <div>
              <label htmlFor="apellido" className={labelClassSm}>Apellido</label>
              <input
                id="apellido"
                type="text"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={inputClassSm}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dni" className={labelClassSm}>DNI</label>
              <input
                id="dni"
                type="text"
                required
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className={inputClassSm}
              />
            </div>
            <div>
              <label htmlFor="telefono" className={labelClassSm}>Teléfono</label>
              <input
                id="telefono"
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClassSm}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={labelClassSm}>Correo electrónico</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className={inputClassSm}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClassSm}>Contraseña</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClassSm}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={cargando} className={btnPrimaryClassSm}>
            {cargando ? 'Registrando...' : 'Registrar cuenta'}
          </button>
        </form>

        <p className="text-center pt-2">
          <button type="button" onClick={() => navigate('/')} className={linkClass}>
            ¿Ya tenés cuenta? Iniciá sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
