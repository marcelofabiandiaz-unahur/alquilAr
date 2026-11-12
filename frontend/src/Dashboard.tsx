import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './authContext';
import DashboardLayout from './components/layout/DashboardLayout';
import InicioPanel, { PlaceholderSection } from './components/dashboard/InicioPanel';
import PropiedadesPanel from './components/propiedades/PropiedadesPanel';
import ContratosPanel from './components/contratos/ContratosPanel';
import HistorialPanel from './components/contratos/HistorialPanel';
import FinanzasPanel from './components/finanzas/FinanzasPanel';
import PagosPanel from './components/pagos/PagosPanel';
import ReclamosPanel from './components/reclamos/ReclamosPanel';
import UsuariosPanel from './components/admin/UsuariosPanel';
import ReportesPanel from './components/reportes/ReportesPanel';
import ReportesAdministradorPanel from './components/reportes/ReportesAdministradorPanel';
import AsistentePanel from './components/asistente/AsistentePanel';
import PerfilPanel from './components/profile/PerfilPanel';
import AgrupamientosPanel from './components/agrupamientos/AgrupamientosPanel';
import DisponibilidadPanel from './components/propiedades/DisponibilidadPanel';
import type {
  FiltroCobros,
  FiltroContratos,
  FiltroPagos,
  FiltroPropiedades,
  FiltroReclamos,
  FiltroUsuarios,
} from './types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario, token, logoutGlobal, cargando } = useAuthContext();
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [idAgrupamiento, setIdAgrupamiento] = useState('');
  const [filtroPagos, setFiltroPagos] = useState<FiltroPagos>('TODOS');
  const [filtroCobros, setFiltroCobros] = useState<FiltroCobros>('TODOS');
  const [filtroPropiedades, setFiltroPropiedades] = useState<FiltroPropiedades>('TODAS');
  const [filtroReclamos, setFiltroReclamos] = useState<FiltroReclamos>('TODOS');
  const [filtroContratos, setFiltroContratos] = useState<FiltroContratos>('TODOS');
  const [filtroUsuarios, setFiltroUsuarios] = useState<FiltroUsuarios>('TODOS');
  const [filtrarGastosMesActual, setFiltrarGastosMesActual] = useState(false);

  const cambiarSeccion: Dispatch<SetStateAction<string>> = (seccion) => {
    setFiltrarGastosMesActual(false);
    setSeccionActiva(seccion);
  };
  const irAGastosEsteMes = () => {
    setFiltrarGastosMesActual(true);
    setSeccionActiva('gastos');
  };

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
        return (
          <InicioPanel
            usuario={usuario}
            token={token}
            roles={roles}
            setSeccionActiva={cambiarSeccion}
            setFiltroPagos={setFiltroPagos}
            setFiltroCobros={setFiltroCobros}
            setFiltroPropiedades={setFiltroPropiedades}
            setFiltroReclamos={setFiltroReclamos}
            setFiltroContratos={setFiltroContratos}
            filtroUsuarios={filtroUsuarios}
            setFiltroUsuarios={setFiltroUsuarios}
            irAGastosEsteMes={irAGastosEsteMes}
            idAgrupamiento={idAgrupamiento}
          />
        );
      case 'propiedades':
        return (
          <PropiedadesPanel
            token={token}
            esPropietario={roles.esPropietario}
            esAdmin={roles.esAdministrador}
            idAgrupamiento={idAgrupamiento}
            filtroEstado={filtroPropiedades}
            setFiltroEstado={setFiltroPropiedades}
          />
        );
      case 'agrupamientos':
        if (!roles.esPropietario) return null;
        return (
          <AgrupamientosPanel
            token={token}
            esAdmin={roles.esAdministrador}
            esPropietario={roles.esPropietario}
          />
        );
      case 'contratos':
        if (roles.esAdministrador) {
          return (
            <ContratosPanel
              token={token}
              esPropietario={false}
              esInquilino={false}
              esAdministrador
              idAgrupamiento={idAgrupamiento}
              filtro={filtroContratos}
              setFiltro={setFiltroContratos}
            />
          );
        }
        return (
          <ContratosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdministrador={false}
            idAgrupamiento={idAgrupamiento}
            filtro={filtroContratos}
            setFiltro={setFiltroContratos}
          />
        );
      case 'finanzas':
        if (!roles.esPropietario) return null;
        return (
          <FinanzasPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
            idAgrupamiento={idAgrupamiento}
            filtroCobros={filtroCobros}
            setFiltroCobros={setFiltroCobros}
          />
        );
      case 'reportes':
        if (roles.esAdministrador) return <ReportesAdministradorPanel />;
        if (!roles.esPropietario) return null;
        return (
          <ReportesPanel
            token={token}
            idAgrupamiento={idAgrupamiento}
            onIrAFinanzas={() => cambiarSeccion('finanzas')}
          />
        );
      case 'pagos':
        return (
          <PagosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
            idAgrupamiento={idAgrupamiento}
            filtro={filtroPagos}
            setFiltro={setFiltroPagos}
          />
        );
      case 'reclamos':
        if (!roles.esPropietario && !roles.esInquilino) return null;
        return (
          <ReclamosPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
            idAgrupamiento={idAgrupamiento}
            filtro={filtroReclamos}
            setFiltro={setFiltroReclamos}
          />
        );
      case 'historial':
        if (roles.esAdministrador) return null;
        return <HistorialPanel token={token} roles={roles} idAgrupamiento={idAgrupamiento} />;
      case 'disponibilidad':
        return <DisponibilidadPanel token={token} />;
      case 'usuarios':
        return (
          <UsuariosPanel
            token={token}
            filtro={filtroUsuarios}
            setFiltro={setFiltroUsuarios}
          />
        );
      case 'configuracion':
        return (
          <PlaceholderSection
            title="Configuración"
            description="Parámetros globales del sistema."
          />
        );
      case 'asistente':
        return <AsistentePanel token={token} idAgrupamiento={idAgrupamiento} />;
      case 'perfil':
        return <PerfilPanel token={token} />;
      case 'cobros':
      case 'gastos':
        return (
          <FinanzasPanel
            token={token}
            esPropietario={roles.esPropietario}
            esInquilino={roles.esInquilino}
            esAdmin={roles.esAdministrador}
            idAgrupamiento={idAgrupamiento}
            tabInicial={seccionActiva === 'gastos' ? 'gastos' : 'cobros'}
            filtrarGastosMesActual={filtrarGastosMesActual}
            filtroCobros={filtroCobros}
            setFiltroCobros={setFiltroCobros}
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
      setSeccionActiva={cambiarSeccion}
      roles={roles}
      token={token}
      idAgrupamiento={idAgrupamiento}
      onAgrupamientoChange={setIdAgrupamiento}
    >
      {renderContenido()}
    </DashboardLayout>
  );
}
