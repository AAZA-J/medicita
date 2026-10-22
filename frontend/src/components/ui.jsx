import { useEffect, useId, useRef } from 'react';
import { useAcc } from '../accesibilidad';

export const ESTADOS = {
  Pendiente: 'pendiente', Confirmada: 'confirmada', Cancelada: 'cancelada', Atendida: 'atendida', 'No asistió': 'noasistio',
};
export const Estado = ({ e }) => <span className={`estado ${ESTADOS[e] || ''}`}>{e}</span>;

export function Alerta({ tipo = 'error', children, onClose }) {
  const { avisar } = useAcc();
  // El texto ya lo lee el lector de pantalla (role alert/status); aquí se agrega voz y vibración
  useEffect(() => { if (children && typeof children === 'string') avisar(children, tipo === 'error' ? 'error' : 'ok', false); }, [children]);
  if (!children) return null;
  return (
    <div className={`alerta ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button className="x" onClick={onClose} aria-label="Cerrar mensaje">×</button>}
    </div>
  );
}

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Ventana con el foco atrapado: Tab no se sale de ella, Escape la cierra
// y al cerrarse el foco vuelve al botón que la abrió.
export function Modal({ titulo, children, onClose }) {
  const ref = useRef(null);
  const id = useId();
  const cerrar = useRef(onClose);
  cerrar.current = onClose;
  useEffect(() => {
    const previo = document.activeElement;
    const primero = ref.current?.querySelector('.modal-cuerpo ' + ENFOCABLES) || ref.current?.querySelector(ENFOCABLES);
    primero?.focus();
    const f = (e) => {
      if (e.key === 'Escape') { cerrar.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const els = [...ref.current.querySelectorAll(ENFOCABLES)];
      if (!els.length) return;
      const a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', f);
    return () => { window.removeEventListener('keydown', f); previo?.focus?.(); };
  }, []);
  return (
    <div className="fondo" onClick={onClose}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
        <div className="modal-cab"><h2 id={id}>{titulo}</h2><button className="x" onClick={onClose} aria-label="Cerrar ventana">×</button></div>
        <div className="modal-cuerpo">
        {children}
        </div>
      </div>
    </div>
  );
}

export const Vacio = ({ children }) => <div className="vacio">{children}</div>;
export const Cargando = () => <div className="vacio" role="status">Cargando…</div>;
