export default function DataTable({ columns, rows, renderRow, emptyMessage }) {
  if (!rows.length) {
    return (
      <p className="text-slate-500 text-sm py-6 text-center">{emptyMessage || 'Sin registros'}</p>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
            {columns.map((col) => (
              <th key={col} className="p-4 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
