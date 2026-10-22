import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Preferencias de accesibilidad y retroalimentación para todas las pantallas:
// - Tamaño de letra, alto contraste y menos movimiento (baja visión, fotosensibilidad)
// - Avisos por voz (personas ciegas o con baja visión que no usan lector de pantalla,
//   personas mayores o con dificultad para leer)
// - Vibración en el celular al terminar una acción (personas sordas o con baja audición)
// - Región aria-live para que los lectores de pantalla (NVDA, JAWS, TalkBack, VoiceOver)
//   lean los avisos sin mover el foco

const Ctx = createContext(null);
export const useAcc = () => useContext(Ctx);

const CLAVE = 'medicita_accesibilidad';
const INICIAL = { letra: 0, contraste: false, movimiento: false, voz: false, vibracion: true };

function leer() {
  try { return { ...INICIAL, ...(JSON.parse(localStorage.getItem(CLAVE)) || {}) }; } catch { return INICIAL; }
}

export function AccesibilidadProvider({ children }) {
  const [pref, setPref] = useState(leer);
  const [vivo, setVivo] = useState({ cortes: '', urgente: '' });
  const prefRef = useRef(pref);
  prefRef.current = pref;

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
    const h = document.documentElement;
    h.classList.toggle('letra-grande', pref.letra === 1);
    h.classList.toggle('letra-muy-grande', pref.letra === 2);
    h.classList.toggle('alto-contraste', pref.contraste);
    h.classList.toggle('sin-movimiento', pref.movimiento);
  }, [pref]);

  const hablar = useCallback((texto) => {
    if (!prefRef.current.voz || !('speechSynthesis' in window) || !texto) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-ES';
      const v = window.speechSynthesis.getVoices().find((x) => x.lang?.startsWith('es'));
      if (v) u.voice = v;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch { /* el navegador no permite voz */ }
  }, []);

  const vibrar = useCallback((tipo) => {
    if (!prefRef.current.vibracion || !navigator.vibrate) return;
    try { navigator.vibrate(tipo === 'error' ? [200, 100, 200] : tipo === 'aviso' ? [120, 80, 120] : 80); } catch { /* sin vibración */ }
  }, []);

  // Retroalimentación de una acción: lector de pantalla + voz + vibración.
  // conRegion=false cuando el mensaje ya está en un elemento con role="alert" o "status".
  const avisar = useCallback((texto, tipo = 'ok', conRegion = true) => {
    if (!texto) return;
    if (conRegion) {
      const k = tipo === 'error' ? 'urgente' : 'cortes';
      setVivo((v) => ({ ...v, [k]: '' }));
      setTimeout(() => setVivo((v) => ({ ...v, [k]: texto })), 60);
    }
    hablar(texto);
    if (tipo !== 'info') vibrar(tipo);
  }, [hablar, vibrar]);

  return (
    <Ctx.Provider value={{ pref, setPref, avisar, hablar }}>
      {children}
      <div className="solo-lector" aria-live="polite" aria-atomic="true">{vivo.cortes}</div>
      <div className="solo-lector" aria-live="assertive" aria-atomic="true">{vivo.urgente}</div>
      <PanelAccesibilidad />
    </Ctx.Provider>
  );
}

function PanelAccesibilidad() {
  const { pref, setPref, hablar } = useAcc();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef(null);
  const panel = useRef(null);
  const cambiar = (k, v) => setPref((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector('button, input')?.focus();
    const f = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierto]);

  const TAM = ['Normal', 'Grande', 'Muy grande'];
  return (
    <div className="acc">
      {abierto && (
        <div className="acc-panel" ref={panel} role="dialog" aria-modal="false" aria-labelledby="acc-titulo">
          <h2 id="acc-titulo">Accesibilidad</h2>
          <fieldset className="acc-grupo">
            <legend>Tamaño de la letra</legend>
            <div className="acc-opciones" role="radiogroup" aria-label="Tamaño de la letra">
              {TAM.map((t, i) => (
                <button key={t} role="radio" aria-checked={pref.letra === i} className={pref.letra === i ? 'activo' : ''}
                  onClick={() => cambiar('letra', i)} style={{ fontSize: `${0.9 + i * 0.2}rem` }}>{t}</button>
              ))}
            </div>
          </fieldset>
          {[
            ['contraste', 'Alto contraste', 'Colores más fuertes y bordes negros'],
            ['movimiento', 'Reducir movimiento', 'Quita animaciones y efectos'],
            ['voz', 'Avisos por voz', 'Lee en voz alta los mensajes del sistema'],
            ['vibracion', 'Vibración en el celular', 'Vibra al confirmar o cuando hay un error'],
          ].map(([k, t, d]) => (
            <label className="acc-interruptor" key={k}>
              <input type="checkbox" role="switch" checked={pref[k]} onChange={(e) => {
                cambiar(k, e.target.checked);
                if (k === 'voz' && e.target.checked) setTimeout(() => hablar('Avisos por voz activados.'), 50);
              }} />
              <span className="acc-pista" aria-hidden="true" />
              <span><b>{t}</b><small>{d}</small></span>
            </label>
          ))}
          <button className="btn ancho" onClick={() => setPref(INICIAL)}>Volver a lo normal</button>
        </div>
      )}
      <button ref={boton} className="acc-boton" aria-expanded={abierto} aria-label="Opciones de accesibilidad"
        onClick={() => setAbierto(!abierto)}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="4" r="2" fill="currentColor" /><path d="M4 8.5c2.7.9 5.3 1.3 8 1.3s5.3-.4 8-1.3M12 9.8v4.7m0 0L8.5 21M12 14.5 15.5 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span className="acc-texto">Accesibilidad</span>
      </button>
    </div>
  );
}

// Al cambiar de pantalla: título de la pestaña, foco en el título principal y aviso
export function usePantalla() {
  const { avisar } = useAcc();
  return useCallback((pathname) => {
    setTimeout(() => {
      const h1 = document.querySelector('main h1');
      if (!h1) return;
      document.title = `${h1.textContent} · MediCita`;
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: false });
      avisar(`Pantalla: ${h1.textContent}`, 'info', false);
    }, 80);
  }, [avisar]);
}
