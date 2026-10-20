import { brandClasses } from '../../theme/alquilar';

export const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';
export const labelClassSm = 'block text-xs font-medium text-slate-700 mb-1';

const inputFocus =
  'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all';

export const inputClass =
  `w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder-slate-400 ${inputFocus}`;

export const inputClassSm =
  `w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder-slate-400 ${inputFocus}`;

export const btnPrimaryClass =
  `w-full py-3 ${brandClasses.primaryBtn} font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed`;

export const btnPrimaryClassSm =
  `w-full py-2.5 ${brandClasses.primaryBtn} font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm`;

export const linkClass = `text-sm ${brandClasses.link} hover:underline font-medium`;
