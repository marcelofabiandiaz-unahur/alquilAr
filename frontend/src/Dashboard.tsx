import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './authContext';
import DashboardLayout from './components/layout/DashboardLayout';
import InicioPanel, { PlaceholderSection } from './components/dashboard/InicioPanel';
import PropiedadesPanel from './components/propiedades/PropiedadesPanel';
import DisponibilidadPanel from './components/propiedades/DisponibilidadPanel';
import ContratosPanel from './components/contratos/ContratosPanel';
import HistorialPanel from './components/contratos/HistorialPanel';
import GastosPanel from './components/gastos/GastosPanel';
import PagosPanel from './components/pagos/PagosPanel';
import CobrosPanel from './components/pagos/CobrosPanel';
import ReclamosPanel from './components/reclamos/ReclamosPanel';
import UsuariosPanel from './components/admin/UsuariosPanel';
import AsistentePanel from './components/asistente/AsistentePanel';

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario, token, logoutGlobal, cargando } = useAuthContext();
  const [seccionActiva, setSeccionActiva] = useState('inicio');

  useEffect(() => {
    if (!cargando && (!usuario || !token)) {
      navigate('/');
    }
  }, [usuario, token, cargando, navigate]);

  if (cargando || !usuario || !token) {
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
        return <InicioPanel usuario={usuario} token={token} roles={roles} setSeccionActiva={setSeccionActiva} />;
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
      case 'gastos':
        return (
          <GastosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
          />
        );
      case 'pagos':
        return (
          <PagosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
          />
        );
      case 'cobros':
        return <CobrosPanel token={token} />;
      case 'reclamos':
        return (
          <ReclamosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
          />
        );
      case 'historial':
        return <HistorialPanel token={token} roles={roles} />;
      case 'usuarios':
        return <UsuariosPanel token={token} />;
      case 'buscar':
        return <DisponibilidadPanel token={token} />;
      case 'configuracion':
        return (
          <PlaceholderSection
            title="⚙️ Configuración"
            description="Parámetros globales del sistema."
          />
        );
      case 'asistente':
        return <AsistentePanel token={token} />;
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
      token={token}
    >
      {renderContenido()}
    </DashboardLayout>
  );
}
