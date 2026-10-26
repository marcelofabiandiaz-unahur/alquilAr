import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config/api';
import AuthLayout from './components/auth/AuthLayout';
import Alert from './components/ui/Alert';
import AuthField from './components/auth/AuthField';
import PasswordField from './components/auth/PasswordField';
import { btnPrimaryClass, linkClass } from './components/auth/authStyles';

type CampoRegistro = 'nombre' | 'apellido' | 'dni' | 'email' | 'telefono' | 'password';
type DatosRegistro = Record<CampoRegistro, string>;
type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

const PASOS: { titulo: string; campos: CampoRegistro[] }[] = [
  { titulo: 'Nombre y apellido', campos: ['nombre', 'apellido'] },
  { titulo: 'Documento', campos: ['dni'] },
  { titulo: 'Correo electrónico', campos: ['email'] },
  { titulo: 'Teléfono', campos: ['telefono'] },
  { titulo: 'Contraseña', campos: ['password'] },
];

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_VALIDO = /^\p{L}+(?:\s+\p{L}+)*$/u;
const TELEFONO_VALIDO = /^\d{1,15}$/;

const MENSAJES_ERROR: Record<CampoRegistro, string> = {
  nombre: 'Ingresá un nombre de hasta 20 letras y espacios.',
  apellido: 'Ingresá un apellido de hasta 20 letras y espacios.',
  dni: 'Ingresá un DNI de hasta 8 números.',
  email: 'Ingresá un correo electrónico válido.',
  telefono: 'Ingresá un teléfono de hasta 15 dígitos, solo números.',
  password: 'La contraseña debe tener más de 8 caracteres.',
};

function validarCampo(campo: CampoRegistro, valor: string): string {
  const limpio = valor.trim();
  if (campo === 'telefono') {
    return limpio && TELEFONO_VALIDO.test(valor)
      ? ''
      : limpio
        ? MENSAJES_ERROR.telefono
        : '';
  }
  if (!limpio) {
    const nombres: Record<Exclude<CampoRegistro, 'telefono'>, string> = {
      nombre: 'Ingresá tu nombre.',
      apellido: 'Ingresá tu apellido.',
      dni: 'Ingresá tu DNI.',
      email: 'Ingresá tu correo electrónico.',
      password: 'Ingresá una contraseña.',
    };
    return nombres[campo];
  }

  switch (campo) {
    case 'nombre':
    case 'apellido':
      return limpio.length <= 20 && NOMBRE_VALIDO.test(limpio) ? '' : MENSAJES_ERROR[campo];
    case 'dni':
      return /^\d{1,8}$/.test(valor) ? '' : MENSAJES_ERROR.dni;
    case 'email':
      return EMAIL_VALIDO.test(limpio) ? '' : MENSAJES_ERROR.email;
    case 'password':
      return valor.length > 8 ? '' : MENSAJES_ERROR.password;
  }
}

export default function Registro() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosRegistro>({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    telefono: '',
    password: '',
  });
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const actualizarCampo = (campo: CampoRegistro, valor: string) => {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setErrores((actuales) => (
      Object.hasOwn(actuales, campo)
        ? { ...actuales, [campo]: validarCampo(campo, valor) }
        : actuales
    ));
  };

  const manejarCambio = (campo: CampoRegistro) => (event: ChangeEvent<HTMLInputElement>) => {
    actualizarCampo(campo, event.target.value);
  };

  const manejarBlur = (campo: CampoRegistro) => () => {
    setErrores((actuales) => ({ ...actuales, [campo]: validarCampo(campo, datos[campo]) }));
  };

  const validarPasoActual = (): boolean => {
    const camposActuales = PASOS[paso].campos;
    const nuevosErrores: ErroresRegistro = {};
    for (const campo of camposActuales) {
      const mensajeError = validarCampo(campo, datos[campo]);
      if (mensajeError) nuevosErrores[campo] = mensajeError;
    }
    setErrores((actuales) => ({ ...actuales, ...nuevosErrores }));
    return Object.keys(nuevosErrores).length === 0;
  };

  const avanzar = () => {
    setError('');
    if (!validarPasoActual()) return;
    setErrores({});
    setPaso((actual) => Math.min(actual + 1, PASOS.length - 1));
  };

  const retroceder = () => {
    setErrores({});
    setError('');
    setPaso((actual) => Math.max(actual - 1, 0));
  };

  const manejarRegistro = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (paso < PASOS.length - 1) {
      avanzar();
      return;
    }
    if (!validarPasoActual()) return;

    setError('');
    setMensaje('');
    setCargando(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.nombre.trim(),
          apellido: datos.apellido.trim(),
          dni: datos.dni,
          email: datos.email.trim(),
          password: datos.password,
          telefono: datos.telefono.trim(),
          roles: ['USUARIO'],
        }),
      });

      const cuerpo: unknown = await respuesta.json().catch(() => ({}));
      const mensajeServidor = (
        typeof cuerpo === 'object'
        && cuerpo !== null
        && 'mensaje' in cuerpo
        && typeof cuerpo.mensaje === 'string'
      ) ? cuerpo.mensaje : '';

      if (!respuesta.ok) {
        throw new Error(mensajeServidor || 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.');
      }

      setMensaje('¡Registro exitoso! Redirigiendo al inicio de sesión...');
      window.setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el usuario.');
    } finally {
      setCargando(false);
    }
  };

  const renderizarCampo = (campo: CampoRegistro) => {
    const propiedades = {
      value: datos[campo],
      onChange: manejarCambio(campo),
      onBlur: manejarBlur(campo),
      error: errores[campo],
    };

    switch (campo) {
      case 'nombre':
        return <AuthField {...propiedades} id="nombre" label="Nombre" maxLength={20} autoComplete="given-name" />;
      case 'apellido':
        return <AuthField {...propiedades} id="apellido" label="Apellido" maxLength={20} autoComplete="family-name" />;
      case 'dni':
        return <AuthField {...propiedades} id="dni" label="DNI" inputMode="numeric" maxLength={8} autoComplete="off" placeholder="Hasta 8 números" />;
      case 'email':
        return <AuthField {...propiedades} id="email-registro" label="Correo electrónico" type="email" autoComplete="email" placeholder="Ingrese su correo electrónico" />;
      case 'telefono':
        return <AuthField {...propiedades} id="telefono" label="Teléfono (opcional)" type="tel" inputMode="numeric" maxLength={15} autoComplete="tel" placeholder="Hasta 15 dígitos" />;
      case 'password':
        return (
          <div className="space-y-2">
            <PasswordField
              id="password-registro"
              label="Contraseña"
              value={datos.password}
              onChange={manejarCambio('password')}
              onBlur={manejarBlur('password')}
              error={errores.password}
              autoComplete="new-password"
              placeholder="Más de 8 caracteres"
            />
            <p className="text-xs text-slate-300">Usá al menos 9 caracteres.</p>
          </div>
        );
    }
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Completá tus datos para registrarte en AlquilAR"
    >
      <div className="space-y-5">
        {error && <Alert type="error" theme="light">{error}</Alert>}
        {mensaje && (
          <Alert type="success" theme="light" onClose={() => setMensaje('')}>
            {mensaje}
          </Alert>
        )}

        <div aria-label={`Paso ${paso + 1} de ${PASOS.length}`} className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-violet-300">Paso {paso + 1} de {PASOS.length}</span>
            <span className="text-slate-300">{PASOS[paso].titulo}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {PASOS.map((item, indice) => (
              <span
                key={item.titulo}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  indice <= paso ? 'bg-violet-500' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={manejarRegistro} noValidate className="space-y-5">
          <div key={paso} className="min-h-28 space-y-4">
            {PASOS[paso].campos.map((campo) => (
              <div key={campo}>{renderizarCampo(campo)}</div>
            ))}
          </div>

          <div className="flex gap-3">
            {paso > 0 && (
              <button
                type="button"
                onClick={retroceder}
                disabled={cargando}
                className="w-full rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 disabled:opacity-50"
              >
                Atrás
              </button>
            )}
            <button type="submit" disabled={cargando} className={btnPrimaryClass}>
              {cargando
                ? 'Creando cuenta...'
                : paso === PASOS.length - 1
                  ? 'Crear cuenta'
                  : 'Continuar'}
            </button>
          </div>
        </form>

        {paso === 3 && !datos.telefono.trim() && (
          <button
            type="button"
            onClick={() => {
              setErrores({});
              setPaso(4);
            }}
            className="w-full text-center text-sm font-medium text-teal-300 transition hover:text-teal-200"
          >
            Omitir teléfono
          </button>
        )}

        <p className="border-t border-slate-700 pt-4 text-center">
          <button type="button" onClick={() => navigate('/')} className={linkClass}>
            ¿Ya tenés cuenta? Iniciá sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
