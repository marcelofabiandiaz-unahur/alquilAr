import AuthBrandPanel from './AuthBrandPanel';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex w-full">
        <AuthBrandPanel />
      </div>

      <div className="flex flex-col min-h-screen bg-white">
        <div className="md:hidden">
          <AuthBrandPanel compact />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-16">
          <div className="w-full max-w-md">
            {(title || subtitle) && (
              <div className="mb-8">
                {title && (
                  <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                )}
                {subtitle && (
                  <p className="text-slate-500 text-sm mt-2">{subtitle}</p>
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
