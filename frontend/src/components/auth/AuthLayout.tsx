import AuthBrandPanel from './AuthBrandPanel';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen min-w-0 font-sans md:grid-cols-2">
      <div className="hidden min-w-0 w-full md:flex">
        <AuthBrandPanel />
      </div>

      <div className="flex min-w-0 flex-col bg-[#1b1345] text-white">
        <div className="min-w-0 md:hidden">
          <AuthBrandPanel compact />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            {(title || subtitle) && (
              <div className="mb-8">
                {title && (
                  <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
                )}
                {subtitle && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{subtitle}</p>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
