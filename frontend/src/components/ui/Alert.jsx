export default function Alert({ type = 'error', theme = 'dark', children, onClose }) {
  const darkStyles = {
    error: 'bg-red-500/10 border-red-500/40 text-red-300',
    success: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
    info: 'bg-blue-500/10 border-blue-500/40 text-blue-300',
  };

  const lightStyles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };

  const styles = theme === 'light' ? lightStyles : darkStyles;

  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-lg border text-sm ${styles[type] || styles.error}`}>
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100 shrink-0">
          ✕
        </button>
      )}
    </div>
  );
}
