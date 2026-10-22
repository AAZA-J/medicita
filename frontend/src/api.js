// Cliente de la API. Guarda el token de sesión y lo renueva con cada respuesta.
const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE = 'medicita_sesion';

export function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || null; } catch { return null; }
}
export function guardarSesion(s) {
  try { s ? localStorage.setItem(CLAVE, JSON.stringify(s)) : localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

let alExpirar = () => {};
export const onSesionExpirada = (fn) => { alExpirar = fn; };

export async function api(ruta, { method = 'GET', body } = {}) {
  const s = leerSesion();
  const headers = { 'Content-Type': 'application/json' };
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  let r;
  try {
    r = await fetch(BASE + ruta, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa que la API esté encendida.');
  }
  const nuevo = r.headers.get('X-Token-Renovado');
  if (nuevo && s) guardarSesion({ ...s, token: nuevo });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && s?.token) { alExpirar(); }
  if (!r.ok) {
    const m = Array.isArray(datos.message) ? datos.message.join('. ') : datos.message;
    throw new Error(m || 'Ocurrió un error. Intenta otra vez.');
  }
  return datos;
}

// Utilidades de fechas
export const hoyISO = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const sumarDias = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n);
  const p = (k) => String(k).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};
export const fechaLarga = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(y, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const fechaCorta = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
};
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
