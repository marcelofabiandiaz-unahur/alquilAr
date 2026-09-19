import Card from '../ui/Card';

const ACCESO_STYLES = {
  propiedades: 'bg-emerald-50 text-emerald-600',
  contratos: 'bg-sky-50 text-sky-600',
  usuarios: 'bg-violet-50 text-violet-600',
  buscar: 'bg-amber-50 text-amber-600',
};

export default function InicioPanel({ usuario, roles, setSeccionActiva }) {
  const accesos = [];

  if (roles.esPropietario) {
    accesos.push({ id: 'propiedades', label: 'Mis Propiedades', desc: 'ABM de inmuebles', icon: '🏢' });
    accesos.push({ id: 'contratos', label: 'Contratos', desc: 'Borradores y vigentes', icon: '📜' });
  }
  if (roles.esInquilino && !roles.esPropietario) {
    accesos.push({ id: 'contratos', label: 'Mis Contratos', desc: 'Contratos activos', icon: '📜' });
  }
  if (roles.esAdministrador) {
    accesos.push({ id: 'usuarios', label: 'Usuarios', desc: 'Roles y permisos', icon: '👥' });
  }
  if (roles.esUsuarioBase) {
    accesos.push({ id: 'buscar', label: 'Buscar alquileres', desc: 'Próximamente', icon: '🔍' });
  }

  return (
    <div className="space-y-8">
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Bienvenido</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#14213D] mt-2">
          Hola, {usuario.nombre} 👋
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Gestioná propiedades, contratos y usuarios desde un panel centralizado. Tus roles activos:{' '}
          <span className="font-semibold text-slate-700">{usuario.roles.join(', ')}</span>.
        </p>
      </Card>

      {accesos.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Accesos rápidos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accesos.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSeccionActiva(item.id)}
                className="text-left group"
              >
                <Card className="p-5 h-full hover:border-emerald-200 hover:shadow-md transition-all">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${ACCESO_STYLES[item.id] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-[#14213D] mt-4 group-hover:text-emerald-700 transition-colors">
                    {item.label}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlaceholderSection({ title, description }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl lg:text-3xl font-bold text-[#14213D]">{title}</h1>
      <Card className="p-8 text-center">
        <p className="text-slate-600">{description}</p>
        <p className="text-slate-400 text-sm mt-2">Disponible en una próxima iteración (S5+)</p>
      </Card>
    </div>
  );
}
