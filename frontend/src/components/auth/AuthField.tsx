import type { InputHTMLAttributes } from 'react';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  inputClassName?: string;
}

export default function AuthField({
  id,
  label,
  error,
  inputClassName = '',
  className = '',
  ...inputProps
}: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-100">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`auth-input w-full rounded-md border px-3.5 py-2.5 text-sm placeholder:text-slate-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'
        } ${inputClassName}`}
      />
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-300">{error}</p>}
    </div>
  );
}
