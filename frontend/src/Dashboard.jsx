import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext'; // 👈 Importamos el contexto

const API_URL = import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://alquilar-pmdp-bkyh.onrender.com';

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario, logoutGlobal, cargando } = useContext(AuthContext); // 👈 Extraemos el estado global
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  // Redirección de seguridad si intentan entrar al dashboard sin estar logueados
  useEffect(() => {
    if (!cargando && !usuario) {
      navigate('/');
    }
  }, [usuario, cargando, navigate]);

  // API para listar usuarios
  useEffect(() => {
    if (seccionActiva === 'usuarios') {
      setCargandoUsuarios(true);
      fetch(`${API_URL}/api/usuarios`)
        .then(res => res.json())
        .then(data => { setUsuarios(data); setCargandoUsuarios(false); })
        .catch(err => { console.error(err); setCargandoUsuarios(false); });
    }
  }, [seccionActiva]);

  if (cargando || !usuario) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Verificando sesión...</div>;
  }

  // 🛡️ MATRIZ DE ROLES (Extraemos los accesos del arreglo de roles del usuario de Atlas)
  const esUsuarioBase = usuario.roles.includes('USUARIO');
  const esInquilino = usuario.roles.includes('INQUILINO');
  const esPropietario = usuario.roles.includes('PROPIETARIO');
  const esAdministrador = usuario.roles.includes('ADMINISTRADOR');

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans overflow-hidden">
      
      {/* SIDEBAR ADAPTATIVO */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col justify-between p-4 shrink-0">
        <div>
          <div className="text-center py-4 border-b border-slate-700 mb-6">
            <h2 className="text-2xl font-extrabold tracking-wider">Alquil<span className="text-blue-500">AR</span></h2>
            <p className="text-xs text-slate-400 mt-1">Menú Dinámico por Rol</p>
          </div>

          <nav className="space-y-2">
            <button onClick={() => setSeccionActiva('inicio')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'inicio' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
              🏠 Inicio
            </button>

            {/* 1. MENÚ PARA ROL: USUARIO BASE (Filtro Buscar Alquileres) */}
            {esUsuarioBase && (
              <button onClick={() => setSeccionActiva('buscar')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'buscar' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                🔍 Buscar Alquileres
              </button>
            )}

            {/* 2. MENÚ PARA ROL: INQUILINO */}
            {esInquilino && (
              <>
                <button onClick={() => setSeccionActiva('mis-alquileres')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'mis-alquileres' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  🔑 Mis Alquileres
                </button>
                <button onClick={() => setSeccionActiva('contratos')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'contratos' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  📜 Mis Contratos
                </button>
              </>
            )}

            {/* 3. MENÚ PARA ROL: PROPIETARIO */}
            {esPropietario && (
              <>
                <button onClick={() => setSeccionActiva('propiedades')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'propiedades' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  🏢 Mis Propiedades
                </button>
                <button onClick={() => setSeccionActiva('contratos')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'contratos' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  📜 Contratos Propietario
                </button>
              </>
            )}

            {/* 4. MENÚ PARA ROL: ADMINISTRADOR */}
            {esAdministrador && (
              <>
                <button onClick={() => setSeccionActiva('usuarios')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'usuarios' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  👥 Usuarios del Sistema
                </button>
                <button onClick={() => setSeccionActiva('configuracion')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'configuracion' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                  ⚙️ Configuración SAT
                </button>
              </>
            )}

            {/* ASISTENTE IA: Compartido por Inquilino, Propietario y Admin (Usuario Base NO lo ve) */}
            {(esInquilino || esPropietario || esAdministrador) && (
              <button onClick={() => setSeccionActiva('asistente')} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium ${seccionActiva === 'asistente' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-700'}`}>
                🤖 Asistente IA
              </button>
            )}
          </nav>
        </div>

        {/* PERFIL Y SALIDA */}
        <div className="border-t border-slate-700 pt-4 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center font-bold text-blue-400">
              {usuario.nombre[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold truncate max-w-[140px]">{usuario.nombre}</p>
              <span className="text-[9px] bg-slate-900 border border-slate-700 text-blue-400 px-2 py-0.5 rounded font-mono font-bold block uppercase tracking-wider mt-0.5 max-w-[140px] truncate">
                {usuario.roles.join(' | ')}
              </span>
            </div>
          </div>
          <button onClick={logoutGlobal} className="w-full text-left px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            🚪 Cerrar Sesión Global
          </button>
        </div>
      </aside>

      {/* CONTENEDOR CENTRAL DINÁMICO */}
      <main className="flex-1 p-8 overflow-y-auto bg-slate-900">
        {seccionActiva === 'inicio' && (
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold">Panel Central 👋</h1>
            <p className="text-slate-400">Tu cuenta posee los siguientes permisos activos: <span className="text-emerald-400 font-mono font-bold">{usuario.roles.join(', ')}</span>. Tu menú lateral izquierdo se adaptó automáticamente.</p>
          </div>
        )}

        {/* Vistas específicas */}
        {seccionActiva === 'buscar' && <h1 className="text-3xl font-extrabold">🔍 Buscador de Alquileres Disponible para Usuarios</h1>}
        {seccionActiva === 'mis-alquileres' && <h1 className="text-3xl font-extrabold">🔑 Tus Alquileres como Inquilino Activo</h1>}
        {seccionActiva === 'propiedades' && <h1 className="text-3xl font-extrabold">🏢 Tus Inmuebles como Propietario</h1>}
        {seccionActiva === 'contratos' && <h1 className="text-3xl font-extrabold">📜 Historial y Firma Digital de Contratos</h1>}
        {seccionActiva === 'configuracion' && <h1 className="text-3xl font-extrabold">⚙️ Configuración Global del Sistema (Admin)</h1>}
        {seccionActiva === 'asistente' && <h1 className="text-3xl font-extrabold">🤖 Chat Inteligente con el Asistente IA</h1>}

        {/* Grilla de Usuarios (Admin) */}
        {seccionActiva === 'usuarios' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold">👥 Control de Usuarios (Vista de Administrador)</h1>
            {cargandoUsuarios ? (
              <p className="text-slate-400 text-sm">Cargando desde Atlas...</p>
            ) : (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-700/50 text-slate-300 text-xs border-b border-slate-700">
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Roles Activos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-sm">
                    {usuarios.map((usr) => (
                      <tr key={usr._id} className="hover:bg-slate-700/20">
                        <td className="p-4">{usr.nombre} {usr.apellido}</td>
                        <td className="p-4 text-slate-400">{usr.email}</td>
                        <td className="p-4"><span className="text-xs text-emerald-400 font-mono">{usr.roles.join(', ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
