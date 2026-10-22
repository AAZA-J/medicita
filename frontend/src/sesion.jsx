import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAcc } from './accesibilidad';
import { Modal } from './components/ui';
import { api, guardarSesion, leerSesion, onSesionExpirada } from './api';

const Ctx = createContext(null);
export const useSesion = () => useContext(Ctx);

const INACTIVIDAD = 30 * 60 * 1000; // RNF02: 30 minutos sin actividad
const AVISO_ANTES = 2 * 60 * 1000;   // se avisa 2 minutos antes para poder seguir

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [aviso, setAviso] = useState('');

  const entrar = (s) => { guardarSesion(s); setSesion(s); setAviso(''); };
  const salir = (msg = '') => { guardarSesion(null); setSesion(null); setAviso(msg); };

  useEffect(() => { onSesionExpirada(() => salir('Tu sesión se cerró por seguridad. Vuelve a iniciar sesión.')); }, []);

  // Cierra la sesión tras 30 minutos sin mover el mouse ni usar el teclado.
  // Dos minutos antes muestra un aviso (con voz y vibración si están activadas)
  // para que las personas que necesitan más tiempo puedan seguir conectadas.
  const { avisar } = useAcc();
  const [porCerrar, setPorCerrar] = useState(false);
  const reiniciarRef = useRef(() => {});
  useEffect(() => {
    if (!sesion) return;
    let t1, t2;
    const reiniciar = () => {
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => {
        setPorCerrar(true);
        avisar('Tu sesión se cerrará en 2 minutos por falta de actividad. Pulsa Seguir conectado para continuar.', 'aviso', false);
      }, INACTIVIDAD - AVISO_ANTES);
      t2 = setTimeout(() => { setPorCerrar(false); salir('Tu sesión se cerró después de 30 minutos sin actividad.'); }, INACTIVIDAD);
    };
    reiniciarRef.current = reiniciar;
    const mover = () => { if (!document.querySelector('.aviso-sesion')) reiniciar(); };
    const ev = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    ev.forEach((e) => window.addEventListener(e, mover, { passive: true }));
    reiniciar();
    return () => { clearTimeout(t1); clearTimeout(t2); ev.forEach((e) => window.removeEventListener(e, mover)); };
  }, [sesion?.usuario?.sub]);
  const seguir = async () => {
    setPorCerrar(false); reiniciarRef.current();
    try { await api('/auth/yo'); } catch { /* si falla, la API pedirá iniciar sesión */ }
    avisar('Listo, tu sesión sigue abierta.', 'ok');
  };

  const login = async (correo, contrasena) => entrar(await api('/auth/login', { method: 'POST', body: { correo, contrasena } }));
  const registro = async (datos) => entrar(await api('/auth/registro', { method: 'POST', body: datos }));

  return (
    <Ctx.Provider value={{ usuario: sesion?.usuario, login, registro, salir, aviso, setAviso }}>
      {children}
      {porCerrar && sesion && (
        <Modal titulo="¿Sigues ahí?" onClose={seguir}>
          <div className="aviso-sesion">
            <p role="alert">Por tu seguridad, tu sesión se cerrará en <b>2 minutos</b> porque no hubo actividad.</p>
            <div className="acciones invertidas">
              <button className="btn primario" onClick={seguir}>Seguir conectado</button>
              <button className="btn" onClick={() => { setPorCerrar(false); salir(); }}>Cerrar sesión</button>
            </div>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export const INICIO = {
  paciente: '/paciente/reservar',
  recepcionista: '/recepcion',
  medico: '/medico',
  administrador: '/admin/especialidades',
};
