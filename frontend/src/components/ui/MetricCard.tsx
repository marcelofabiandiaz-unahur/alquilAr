import { brandClasses } from '../../theme/alquilar';

export type MetricVariant = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'sky';

const VARIANT_STYLES: Record<
  MetricVariant,
  { shell: string; iconBox: string }
> = {
  violet: {
    shell: 'border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-white',
    iconBox: 'bg-violet-600 text-white',
  },
  blue: {
    shell: 'border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-white',
    iconBox: 'bg-sky-500 text-white',
  },
  emerald: {
    shell: 'border-emerald-100 bg-gradient-to-br from-emerald-50/90 via-white to-white',
    iconBox: 'bg-emerald-500 text-white',
  },
  amber: {
    shell: 'border-amber-100 bg-gradient-to-br from-amber-50/90 via-white to-white',
    iconBox: 'bg-amber-500 text-white',
  },
  rose: {
    shell: 'border-rose-100 bg-gradient-to-br from-rose-50/90 via-white to-white',
    iconBox: 'bg-rose-500 text-white',
  },
  sky: {
    shell: 'border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white',
    iconBox: 'bg-indigo-500 text-white',
  },
};

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: string;
  variant?: MetricVariant;
  hint?: string;
  trend?: { value: string; caption?: string };
  onClick?: () => void;
}

export default function MetricCard({
  label,
  value,
  icon,
  variant = 'violet',
  hint,
  trend,
  onClick,
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];
  const interactive = Boolean(onClick);

  const inner = (
    <div
      className={`rounded-2xl border p-5 h-full shadow-sm shadow-slate-200/50 transition-all ${styles.shell} ${
        interactive ? `${brandClasses.cardHover} hover:shadow-md cursor-pointer` : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        {icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm ${styles.iconBox}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        {trend ? (
          <div className="text-right ml-auto">
            <p className="text-xs font-semibold text-emerald-600">{trend.value}</p>
            {trend.caption && (
              <p className="text-[10px] text-slate-400 mt-0.5">{trend.caption}</p>
            )}
          </div>
        ) : hint ? (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md ml-auto">
            {hint}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl lg:text-3xl font-bold text-[#14213D] mt-1 tracking-tight">{value}</p>
    </div>
  );

  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left w-full">
        {inner}
      </button>
    );
  }

  return inner;
}
