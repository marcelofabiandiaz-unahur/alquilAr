import { brandClasses } from '../../theme/alquilar';
import { NavIcon } from '../layout/dashboardNavIcons';

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
  compact?: boolean;
}

export default function MetricCard({
  label,
  value,
  icon,
  variant = 'violet',
  hint,
  trend,
  onClick,
  compact = false,
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];
  const interactive = Boolean(onClick);

  const inner = (
    <div
      className={`metric-card h-full border shadow-sm shadow-slate-200/50 transition-all ${compact ? 'rounded-xl p-3 sm:rounded-2xl sm:p-5' : 'rounded-2xl p-5'} ${styles.shell} ${
        interactive ? `${brandClasses.cardHover} hover:shadow-md cursor-pointer` : ''
      }`}
    >
      <div className={`flex items-start justify-between gap-2 ${compact ? 'mb-2 sm:mb-4' : 'mb-4'}`}>
        {icon && (
          <span
            className={`flex shrink-0 items-center justify-center shadow-sm ${compact ? 'h-8 w-8 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl' : 'h-11 w-11 rounded-xl'} ${styles.iconBox}`}
            aria-hidden
          >
            <NavIcon id={icon} />
          </span>
        )}
        {trend ? (
          <div className="text-right ml-auto">
            <p className={`${compact ? 'text-[10px] sm:text-xs' : 'text-xs'} font-semibold text-emerald-600`}>{trend.value}</p>
            {trend.caption && (
              <p className={`mt-0.5 text-slate-400 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'}`}>{trend.caption}</p>
            )}
          </div>
        ) : hint ? (
          <span className={`ml-auto rounded-md bg-emerald-50 font-medium text-emerald-600 ${compact ? 'px-1.5 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-xs' : 'px-2 py-1 text-xs'}`}>
            {hint}
          </span>
        ) : null}
      </div>
      <p className={`${compact ? 'text-xs leading-tight sm:text-sm' : 'text-sm'} font-medium text-slate-500`}>{label}</p>
      <p className={`${compact ? 'text-base sm:text-2xl lg:text-3xl' : 'text-2xl lg:text-3xl'} mt-1 break-words font-bold tracking-tight text-[var(--brand-navy)]`}>{value}</p>
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
