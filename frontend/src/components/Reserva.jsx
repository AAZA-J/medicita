import { useEffect, useRef, useState } from 'react';
import { useAcc } from '../accesibilidad';
import { api, fechaLarga } from '../api';
import { Alerta, Cargando } from './ui';
import SelectorTurno from './SelectorTurno';

// RF04: reservar en 3 pasos (RNF04: no más de 5 pantallas)
export default function Reserva({ paciente, onListo }) {
  const [paso, setPaso] = useState(1);
  const [esps, setEsps] = useState(null);
  const [esp, setEsp] = useState(null);
  const [turno, setTurno] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cita, setCita] = useState(null);
  const { avisar } = useAcc();
  const zona = useRef(null);
  // Al cambiar de paso, el foco va al inicio del paso para que el lector lo lea
  useEffect(() => { zona.current?.querySelector('[data-foco]')?.focus(); }, [paso]);

  useEffect(() => { api('/especialidades').then(setEsps).catch((e) => setError(e.message)); }, []);

  const reservar = async () => {
    setEnviando(true); setError('');
    try {
      const c = await api('/citas', { method: 'POST', body: {
        id_especialidad: esp.id_especialidad, id_medico: turno.id_medico, fecha: turno.fecha, hora: turno.hora,
        ...(paciente ? { id_paciente: paciente.id_paciente } : {}),
      } });
      setCita(c); setPaso(4); onListo?.(c);
      avisar(`Cita reservada para el ${fechaLarga(c.fecha)} a las ${c.hora} con ${c.medico}.`, 'ok');
    } catch (e) {
      setError(e.message);
      if (/tomado/.test(e.message)) { setTurno(null); setPaso(2); } // RF05: el turno se ocupó mientras tanto
    } finally { setEnviando(false); }
  };

  const reiniciar = () => { setPaso(1); setEsp(null); setTurno(null); setCita(null); setError(''); };

  return (
    <div className="reserva" ref={zona}>
      {paso < 4 && (
        <ol className="pasos" aria-label="Pasos para reservar">
          {['Especialidad', 'Fecha y hora', 'Confirmar'].map((t, i) => (
            <li key={t} className={paso === i + 1 ? 'actual' : paso > i + 1 ? 'hecho' : ''} aria-current={paso === i + 1 ? 'step' : undefined}>
              <span aria-hidden="true">{paso > i + 1 ? '✓' : i + 1}</span>{t}{paso > i + 1 && <span className="solo-lector"> (hecho)</span>}
            </li>
          ))}
        </ol>
      )}
      {paso < 4 && <h2 className="solo-lector" tabIndex={-1} data-foco>Paso {paso} de 3: {['Elige la especialidad', 'Elige la fecha y la hora', 'Revisa y confirma'][paso - 1]}</h2>}
      <Alerta onClose={() => setError('')}>{error}</Alerta>

      {paso === 1 && (
        !esps ? <Cargando /> : (
          <div className="grid-esp">
            {esps.map((e) => (
              <button key={e.id_especialidad} className="tarjeta-esp" disabled={!e.medicos}
                aria-label={`${e.nombre}. ${e.descripcion || ''}. ${e.medicos ? `${e.medicos} médicos` : 'Sin médicos disponibles'}`}
                onClick={() => { setEsp(e); setTurno(null); setPaso(2); }}>
                <b>{e.nombre}</b>
                <small>{e.descripcion || ' '}</small>
                <span className="chip">{e.medicos ? `${e.medicos} médico${e.medicos > 1 ? 's' : ''}` : 'Sin médicos'}</span>
              </button>
            ))}
          </div>
        )
      )}

      {paso === 2 && (
        <>
          <div className="barra-paso">
            <button className="btn texto" onClick={() => setPaso(1)}>← Cambiar especialidad</button>
            <span className="chip grande">{esp.nombre}</span>
          </div>
          <SelectorTurno especialidad={esp.id_especialidad} elegido={turno} onElegir={(t) => { setTurno(t); setPaso(3); }} />
        </>
      )}

      {paso === 3 && (
        <div className="resumen">
          <h3>Revisa los datos de la cita</h3>
          <dl>
            {paciente && <><dt>Paciente</dt><dd>{paciente.nombres} {paciente.apellidos} · {paciente.cedula}</dd></>}
            <dt>Especialidad</dt><dd>{esp.nombre}</dd>
            <dt>Médico</dt><dd>Dr(a). {turno.medico}</dd>
            <dt>Fecha</dt><dd>{fechaLarga(turno.fecha)}</dd>
            <dt>Hora</dt><dd>{turno.hora}</dd>
          </dl>
          <div className="acciones">
            <button className="btn" onClick={() => setPaso(2)}>Volver</button>
            <button className="btn primario" disabled={enviando} onClick={reservar}>{enviando ? 'Reservando…' : 'Confirmar reserva'}</button>
          </div>
        </div>
      )}

      {paso === 4 && cita && (
        <div className="resumen exito">
          <div className="check" aria-hidden>✓</div>
          <h2 tabIndex={-1} data-foco>¡Cita reservada!</h2>
          <p>{fechaLarga(cita.fecha)} a las <b>{cita.hora}</b><br />{cita.especialidad} con Dr(a). {cita.medico}</p>
          <p className="ayuda">{paciente ? 'La cita quedó registrada como Pendiente.' : 'Te enviaremos un recordatorio a tu correo un día antes para que confirmes tu asistencia.'}</p>
          <div className="acciones centro">
            <button className="btn" onClick={reiniciar}>Reservar otra cita</button>
          </div>
        </div>
      )}
    </div>
  );
}
