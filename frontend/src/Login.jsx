import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './AuthContext';

const API_URL = import.meta.env.DEV 
  ? 'http://localhost:3000'                  // 💻 Si corres "npm run dev" en tu PC, usa localhost
  : 'https://alquilar-pmdp.onrender.com';   // 🌐 Si está subido a Render, usa la nube


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
      body: JSON.stringify({ email, password })
    });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al iniciar sesión');
      }

      // 🎫 Guardamos el Token JWT en el navegador
      loginGlobal(datos.usuario, datos.token);
      
      setMensaje(`¡Bienvenido/a, ${datos.usuario.nombre}! Inicio de sesión correcto.`);

      setTimeout(() => {
         navigate('/dashboard'); // 👈 Te manda al panel central automáticamente tras 1 segundo
      }, 1000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white">Alquil<span className="text-blue-500">AR</span></h2>
          <p className="text-sm text-slate-400 mt-2">Gestión Digital de Alquileres de Forma Segura</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 text-sm rounded-lg text-center">
            ❌ {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-sm rounded-lg text-center">
            🔓 {mensaje}
          </div>
        )}

        <form onSubmit={manejarLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@alquilar.com"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            {cargando ? 'Verificando Criptografía...' : 'Ingresar al Sistema'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button 
            onClick={() => window.location.href = '/registro'} 
            className="text-xs text-blue-400 hover:underline"
          >
            ¿No tienes cuenta? Regístrate aquí
          </button>
        </div>

      </div>
    </div>
  );
}
