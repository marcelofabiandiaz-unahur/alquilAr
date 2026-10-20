import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-sm shadow-slate-200/40 ${className}`}>
      {children}
    </div>
  );
}
