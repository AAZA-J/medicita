import { randomBytes } from 'crypto';

// Clave para firmar las sesiones. Si falta en .env o se dejó la del ejemplo,
// se genera una al azar para no arrancar con una clave conocida por todos.
const CONOCIDAS = ['cambiar-esta-clave-por-una-larga', 'cambiar-esta-clave-en-produccion', 'cambiar-esta-clave'];

function obtener() {
  const s = process.env.JWT_SECRET || '';
  if (s.length >= 16 && !CONOCIDAS.includes(s)) return s;
  console.warn('[Seguridad] JWT_SECRET no está configurada o es la del ejemplo. Se usará una clave temporal: '
    + 'las sesiones se cerrarán cada vez que se reinicie el backend. Pon una frase larga propia en .env.');
  return randomBytes(32).toString('hex');
}

export const JWT_SECRET = obtener();

// Escapa texto antes de ponerlo dentro de HTML (por ejemplo en los correos)
export const esc = (t: unknown) => String(t ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
