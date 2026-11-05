export const MENSAJE_ERROR_CONEXION =
  'Error de conexión con el servidor. Verificá tu conexión e intentá nuevamente.';

export function mensajeErrorConexion(error: unknown, mensajeAlternativo: string): string {
  if (
    error instanceof TypeError
    || (error instanceof Error && /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(error.message))
  ) {
    return MENSAJE_ERROR_CONEXION;
  }
  return error instanceof Error ? error.message : mensajeAlternativo;
}
