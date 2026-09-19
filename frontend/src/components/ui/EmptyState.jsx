export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-xl border border-dashed border-slate-200 shadow-sm text-center">
      <p className="text-lg font-semibold text-slate-700">{title}</p>
      {description && <p className="text-slate-500 text-sm mt-2 max-w-md">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
