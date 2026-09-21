import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import InicioPanel, { PlaceholderSection } from './components/dashboard/InicioPanel';
import PropiedadesPanel from './components/propiedades/PropiedadesPanel';
import ContratosPanel from './components/contratos/ContratosPanel';
import UsuariosPanel from './components/admin/UsuariosPanel';

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario, token, logoutGlobal, cargando } = useContext(AuthContext);
  const [seccionActiva, setSeccionActiva] = useState('inicio');

  useEffect(() => {
    if (!cargando && !usuario) {
      navigate('/');
    }
  }, [usuario, cargando, navigate]);

  if (cargando || !usuario) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">
        Verificando sesión...
      </div>
    );
  }

  const roles = {
    esUsuarioBase: usuario.roles.includes('USUARIO'),
    esInquilino: usuario.roles.includes('INQUILINO'),
    esPropietario: usuario.roles.includes('PROPIETARIO'),
    esAdministrador: usuario.roles.includes('ADMINISTRADOR'),
  };

  const renderContenido = () => {
    switch (seccionActiva) {
      case 'inicio':
        return <InicioPanel usuario={usuario} roles={roles} setSeccionActiva={setSeccionActiva} />;
      case 'propiedades':
        return (
          <PropiedadesPanel
            token={token}
            esPropietario={roles.esPropietario}
            esAdmin={roles.esAdministrador}
          />
        );
      case 'contratos':
        return (
          <ContratosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
          />
        );
      case 'usuarios':
        return <UsuariosPanel token={token} />;
      case 'buscar':
        return (
          <PlaceholderSection
            title="🔍 Buscar Alquileres"
            description="Explorá propiedades disponibles para alquilar."
          />
        );
      case 'mis-alquileres':
        return (
          <PlaceholderSection
            title="🔑 Mis Alquileres"
            description="Consultá tus alquileres activos. Por ahora usá la sección Mis Contratos."
          />
        );
      case 'configuracion':
        return (
          <PlaceholderSection
            title="⚙️ Configuración"
            description="Parámetros globales del sistema."
          />
        );
      case 'asistente':
        return (
          <PlaceholderSection
            title="🤖 Asistente IA"
            description="Chat inteligente para consultas de gestión."
          />
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      usuario={usuario}
      logoutGlobal={logoutGlobal}
      seccionActiva={seccionActiva}
      setSeccionActiva={setSeccionActiva}
      roles={roles}
    >
      {renderContenido()}
    </DashboardLayout>
  );
}
