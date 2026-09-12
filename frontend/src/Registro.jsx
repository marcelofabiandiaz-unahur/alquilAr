import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Registro() {
  const navigate = useNavigate();
  
  // Estados para todos los campos de tu DER
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
      const respuesta = await fetch('http://localhost:3000/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          dni,
          email,
          password,
          telefono
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al registrar el usuario');
      }

      setMensaje('¡Registro exitoso! 🔐 Contraseña protegida con Argon2id. Redirigiendo...');
      
      // Redirige al Login automáticamente después de 2 segundos de éxito
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
        
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold text-white">Alquil<span className="text-blue-500">AR</span></h2>
          <p className="text-sm text-slate-400 mt-1">Crea tu cuenta única en el sistema</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 text-sm rounded-lg text-center">❌ {error}</div>}
        {mensaje && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-sm rounded-lg text-center">🎉 {mensaje}</div>}

        <form onSubmit={manejarRegistro} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nombre</label>
              <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Apellido</label>
              <input type="text" required value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">DNI</label>
              <input type="text" required value={dni} onChange={(e) => setDni(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono</label>
              <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Correo Electrónico</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={cargando} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 text-sm">
            {cargando ? 'Procesando Criptografía...' : 'Registrar Cuenta Única'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button onClick={() => navigate('/')} className="text-xs text-blue-400 hover:underline">
            ¿Ya tienes cuenta? Inicia Sesión
          </button>
        </div>

      </div>
    </div>
  );
}
