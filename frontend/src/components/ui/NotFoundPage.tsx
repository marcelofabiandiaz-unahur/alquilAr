import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-200/50">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-violet-950">No encontramos esa página</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          El enlace puede estar vencido o la dirección no existe. Volvé al inicio para continuar.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
