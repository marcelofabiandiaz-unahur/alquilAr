import { getEstadoClass } from '../../lib/estadoStyles';

export default function StatBadge({ estado }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getEstadoClass(estado)}`}
    >
      {estado}
    </span>
  );
}
