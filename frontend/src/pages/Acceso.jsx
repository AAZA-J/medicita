import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fechaLarga } from '../api';
import { INICIO, useSesion } from '../sesion';
import { Alerta } from '../components/ui';

function Marco({ children, titulo, sub }) {
  return (
    <div className="acceso">
      <aside className="acceso-lado">
        <div className="logo grande"><span className="cruz" aria-hidden="true">+</span>MediCita</div>
        <p>Reserva, confirma y cancela tus citas médicas en línea, sin hacer fila ni llamar.</p>
        <ul>
          <li>Mira los horarios libres de cada médico</li>
          <li>Recibe un recordatorio un día antes</li>
          <li>Revisa todas tus citas en un solo lugar</li>
        </ul>
      </aside>
      <main className="acceso-form" id="contenido">
        <div className="logo movil"><span className="cruz" aria-hidden="true">+</span>MediCita</div>
        <h1>{titulo}</h1>
        {sub && <p className="sub">{sub}</p>}
        {children}
      </main>
    </div>
  );
}

// RF02
export function Login() {
  const { login, aviso, setAviso } = useSesion();
  const nav = useNavigate();
  const [f, setF] = useState({ correo: '', contrasena: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault(); setError(''); setEnviando(true);
    try { await login(f.correo, f.contrasena); } catch (x) { setError(x.message); } finally { setEnviando(false); }
  };
  const { usuario } = useSesion();
  useEffect(() => { if (usuario) nav(INICIO[usuario.rol], { replace: true }); }, [usuario]);
  return (
    <Marco titulo="Iniciar sesión" sub="Entra con tu correo y tu contraseña.">
      <Alerta tipo="info" onClose={() => setAviso('')}>{aviso}</Alerta>
      <Alerta>{error}</Alerta>
      <form onSubmit={enviar} className="form">
        <label className="campo"><span>Correo electrónico</span>
          <input type="email" autoComplete="email" required value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} /></label>
        <label className="campo"><span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={f.contrasena} onChange={(e) => setF({ ...f, contrasena: e.target.value })} /></label>
        <button className="btn primario ancho" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="pie-form">¿Eres paciente y no tienes cuenta? <Link to="/registro">Regístrate aquí</Link></p>
    </Marco>
  );
}

// RF01 y RNF08
export function Registro() {
  const { registro, usuario } = useSesion();
  const nav = useNavigate();
  const [f, setF] = useState({ cedula: '', nombres: '', apellidos: '', correo: '', celular: '', contrasena: '', acepta_datos: false });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (usuario) nav(INICIO[usuario.rol], { replace: true }); }, [usuario]);
  const c = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const enviar = async (e) => {
    e.preventDefault(); setError('');
    if (!f.acepta_datos) return setError('Debes aceptar el uso de tus datos personales para registrarte.');
    setEnviando(true);
    try { await registro(f); } catch (x) { setError(x.message); } finally { setEnviando(false); }
  };
  return (
    <Marco titulo="Crear cuenta de paciente" sub="Con tu cuenta podrás reservar y revisar tus citas.">
      <Alerta>{error}</Alerta>
      <p className="ayuda">Todos los campos son obligatorios.</p>
      <form onSubmit={enviar} className="form">
        <div className="dos">
          <label className="campo"><span>Nombres</span><input required {...c('nombres')} /></label>
          <label className="campo"><span>Apellidos</span><input required {...c('apellidos')} /></label>
        </div>
        <div className="dos">
          <label className="campo"><span>Cédula</span><input required inputMode="numeric" maxLength={10} pattern="\d{10}" title="10 números" {...c('cedula')} /></label>
          <label className="campo"><span>Celular</span><input required inputMode="numeric" maxLength={10} pattern="09\d{8}" title="Empieza con 09 y tiene 10 números" placeholder="09xxxxxxxx" {...c('celular')} /></label>
        </div>
        <label className="campo"><span>Correo electrónico</span><input type="email" required autoComplete="email" {...c('correo')} /></label>
        <label className="campo"><span>Contraseña</span><input type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...c('contrasena')} /></label>
        <label className="check-linea">
          <input type="checkbox" checked={f.acepta_datos} onChange={(e) => setF({ ...f, acepta_datos: e.target.checked })} />
          <span>Acepto que MediCita use mis datos personales solo para gestionar mis citas, según la Ley Orgánica de Protección de Datos Personales.</span>
        </label>
        <button className="btn primario ancho" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="pie-form">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </Marco>
  );
}

// RF12: página que abre el enlace del correo
export function Confirmar() {
  const { token } = useParams();
  const [r, setR] = useState(null);
  useEffect(() => { api(`/recordatorios/confirmar/${token}`).then(setR).catch((e) => setR({ ok: false, mensaje: e.message })); }, [token]);
  return (
    <main className="centro-pantalla" id="contenido">
      <div className="tarjeta confirmar" role="status">
        <div className="logo"><span className="cruz" aria-hidden="true">+</span>MediCita</div>
        {!r ? <h1>Confirmando tu asistencia…</h1> : (
          <>
            <div className={`check ${r.ok ? '' : 'mal'}`} aria-hidden>{r.ok ? '✓' : '!'}</div>
            <h1>{r.mensaje}</h1>
            {r.cita && <p>{r.cita.especialidad} con Dr(a). {r.cita.medico}<br />{fechaLarga(r.cita.fecha)} a las <b>{r.cita.hora}</b></p>}
            <Link className="btn primario" to="/login">Ir a MediCita</Link>
          </>
        )}
      </div>
    </main>
  );
}
