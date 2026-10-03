export default function LoadingRow({ label = 'Cargando...' }) {
  return (
    <div className="flex items-center gap-3 py-8 text-slate-500 text-sm">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      {label}
    </div>
  );
}
