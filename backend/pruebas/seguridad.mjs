// Pruebas de seguridad de MediCita (RNF01, RNF02 e inyección SQL)
// Uso: con el backend encendido, en la carpeta backend ejecutar:
//   node pruebas/seguridad.mjs
// Opcional: API=http://localhost:3000/api node pruebas/seguridad.mjs
//
// Intenta entrar por URL a opciones de otros roles, alterar el token,
// ver datos de otros pacientes e inyectar SQL. Todo debe ser rechazado.

const API = process.env.API || 'http://localhost:3000/api';
const CLAVE = 'Prueba123';
let ok = 0, mal = 0;
const fallos = [];

async function pedir(metodo, ruta, token, body) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(API + ruta, { method: metodo, headers: h, body: body ? JSON.stringify(body) : undefined });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, datos };
}

function revisar(nombre, cumple, detalle = '') {
  if (cumple) { ok++; console.log(`  ✔ ${nombre}`); }
  else { mal++; fallos.push(nombre); console.log(`  ✘ ${nombre} ${detalle}`); }
}

async function token(correo) {
  const r = await pedir('POST', '/auth/login', null, { correo, contrasena: CLAVE });
  if (r.status !== 201) throw new Error(`No se pudo iniciar sesión con ${correo} (${r.status}). Si es 429, espera un minuto: hay un límite de intentos de inicio de sesión.`);
  return r.datos.token;
}

const T = {
  ninguno: null,
  paciente: await token('paciente1@correo.com'),
  recepcionista: await token('recepcion@medicita.ec'),
  medico: await token('dra.mendoza@medicita.ec'),
  administrador: await token('admin@medicita.ec'),
};
const ROLES = Object.keys(T);

// ---------------------------------------------------------------
console.log('\n1. Acceso por URL según el rol (RF02, RNF01)');
// [método, ruta, roles que SÍ pueden, cuerpo]
const RUTAS = [
  ['GET', '/citas', ['recepcionista', 'administrador']],
  ['GET', '/citas/mias', ['paciente']],
  ['GET', '/pacientes?buscar=13', ['recepcionista']],
  ['POST', '/pacientes', ['recepcionista'], {}],
  ['GET', '/agenda', ['medico']],
  ['GET', '/reportes/mensual', ['administrador']],
  ['GET', '/recordatorios', ['administrador']],
  ['POST', '/recordatorios/enviar', ['administrador']],
  ['GET', '/medicos/admin', ['administrador']],
  ['POST', '/especialidades', ['administrador'], {}],
  ['PUT', '/especialidades/1', ['administrador'], {}],
  ['POST', '/medicos', ['administrador'], {}],
  ['PUT', '/medicos/1', ['administrador'], {}],
  ['POST', '/horarios', ['administrador'], {}],
  ['DELETE', '/horarios/999999', ['administrador']],
  ['PATCH', '/citas/1/reprogramar', ['recepcionista'], {}],
  ['POST', '/citas/1/atencion', ['medico'], {}],
  ['POST', '/citas', ['paciente', 'recepcionista'], {}],
];
for (const [m, ruta, permitidos, body] of RUTAS) {
  for (const rol of ROLES) {
    const r = await pedir(m, ruta, T[rol], body);
    const esperado = permitidos.includes(rol) ? 'permitido' : rol === 'ninguno' ? 401 : 403;
    const cumple = esperado === 'permitido' ? ![401, 403].includes(r.status) : r.status === esperado;
    if (!cumple || esperado !== 'permitido') {
      revisar(`${rol.padEnd(13)} ${m.padEnd(6)} ${ruta} → ${esperado === 'permitido' ? 'permitido' : 'bloqueado (' + esperado + ')'}`, cumple, `(respondió ${r.status})`);
    }
  }
}

// ---------------------------------------------------------------
console.log('\n2. Datos de otros usuarios (RNF01)');
const otras = (await pedir('GET', '/citas', T.recepcionista)).datos;
const ajena = otras.find((c) => c.paciente !== 'María José Vera Loor' && ['Pendiente', 'Confirmada'].includes(c.estado));
if (ajena) {
  revisar('Paciente no puede ver la cita de otro paciente', (await pedir('GET', `/citas/${ajena.id_cita}`, T.paciente)).status === 403);
  revisar('Paciente no puede ver el historial de la cita de otro', (await pedir('GET', `/citas/${ajena.id_cita}/historial`, T.paciente)).status === 403);
  revisar('Paciente no puede cancelar la cita de otro', (await pedir('PATCH', `/citas/${ajena.id_cita}/cancelar`, T.paciente)).status === 403);
}
const deOtroMedico = otras.find((c) => c.medico !== 'Andrea Mendoza');
if (deOtroMedico) {
  revisar('Médico no puede ver citas de otro médico', (await pedir('GET', `/citas/${deOtroMedico.id_cita}`, T.medico)).status === 403);
  revisar('Médico no puede registrar la atención de otro médico', (await pedir('POST', `/citas/${deOtroMedico.id_cita}/atencion`, T.medico, { asistio: true })).status === 403);
}
const mias = (await pedir('GET', '/citas/mias', T.paciente)).datos;
revisar('"Mis citas" solo trae las citas del paciente que inició sesión',
  Array.isArray(mias) && mias.every((c) => !c.paciente || c.paciente === 'María José Vera Loor'));
const pub = (await pedir('GET', '/medicos')).datos;
revisar('La lista pública de médicos no muestra correos', Array.isArray(pub) && pub.every((m) => !('correo' in m)));

// ---------------------------------------------------------------
console.log('\n3. Token alterado o falso (RNF02)');
const [cab, cuerpo, firma] = T.paciente.split('.');
const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
const falso = Buffer.from(JSON.stringify({ ...datos, rol: 'administrador' })).toString('base64url');
revisar('Cambiar el rol dentro del token a "administrador" no da acceso',
  (await pedir('GET', '/reportes/mensual', `${cab}.${falso}.${firma}`)).status === 401);
const sinFirma = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
revisar('Token sin firma (alg "none") es rechazado',
  (await pedir('GET', '/citas/mias', `${sinFirma}.${cuerpo}.`)).status === 401);
revisar('Token inventado es rechazado', (await pedir('GET', '/citas/mias', 'abc.def.ghi')).status === 401);

// ---------------------------------------------------------------
console.log('\n4. Inyección SQL');
const INY = ["' OR '1'='1", "' OR 1=1 --", "'; DROP TABLE citas; --", "1 OR 1=1", "admin@medicita.ec' --"];
for (const x of INY) {
  const r = await pedir('POST', '/auth/login', null, { correo: x, contrasena: x });
  revisar(`Login con ${JSON.stringify(x)} no entra`, r.status === 401 || r.status === 400, `(respondió ${r.status})`);
}
const r1 = await pedir('GET', `/pacientes?buscar=${encodeURIComponent("' OR '1'='1")}`, T.recepcionista);
revisar('Búsqueda de pacientes con inyección no trae a todos', r1.status === 200 && r1.datos.length === 0);
for (const [ruta, nombre] of [
  [`/citas?fecha=${encodeURIComponent("2026-10-21' OR '1'='1")}`, 'filtro de fecha'],
  [`/citas?medico=${encodeURIComponent('1 OR 1=1')}`, 'filtro de médico'],
  [`/disponibilidad?especialidad=${encodeURIComponent('1 OR 1=1')}&fecha=2026-10-26`, 'disponibilidad'],
]) {
  const r = await pedir('GET', ruta, T.recepcionista);
  revisar(`Inyección en ${nombre} es rechazada`, r.status === 400, `(respondió ${r.status})`);
}
const sigue = await pedir('GET', '/citas', T.recepcionista);
revisar('La tabla citas sigue existiendo después de los intentos', sigue.status === 200);

// ---------------------------------------------------------------
console.log(`\nResultado: ${ok} pruebas pasaron, ${mal} fallaron.`);
if (mal) { console.log('Fallaron:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
