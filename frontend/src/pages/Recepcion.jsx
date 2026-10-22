import { useEffect, useState } from 'react';
import { api, fechaLarga, hoyISO, sumarDias } from '../api';
import { Alerta, Cargando, Estado, Modal, Vacio } from '../components/ui';
import Reserva from '../components/Reserva';
import SelectorTurno from '../components/SelectorTurno';

export function HistorialCita({ cita, onClose }) {
  const [h, setH] = useState(null);
  useEffect(() => { api(`/citas/${cita.id_cita}/historial`).then(setH).catch(() => setH([])); }, [cita.id_cita]);
  return (
    <Modal titulo={`Historial de la cita #${cita.id_cita}`} onClose={onClose}>
      {!h ? <Cargando /> : (
        <ol className="linea-tiempo">
          {h.map((x, i) => (
            <li key={i}>
              <b>{x.estado_anterior ? `${x.estado_anterior} → ${x.estado_nuevo}` : `Creada (${x.estado_nuevo})`}</b>
              <span>{x.motivo}{x.fecha_anterior && ` · antes: ${x.fecha_anterior} ${x.hora_anterior}`}</span>
              <small>{new Date(x.cambiado_en).toLocaleString('es-EC')} · {x.cambiado_por}</small>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

// RF07: agenda de recepción, reprogramar y cancelar
export function AgendaRecepcion() {
  const [fecha, setFecha] = useState(hoyISO());
  const [medicos, setMedicos] = useState([]);
  const [medico, setMedico] = useState('');
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [repro, setRepro] = useState(null);
  const [nuevoTurno, setNuevoTurno] = useState(null);
  const [cancelar, setCancelar] = useState(null);
  const [hist, setHist] = useState(null);

  useEffect(() => { api('/medicos').then(setMedicos).catch(() => {}); }, []);
  const cargar = () => { setCitas(null); api(`/citas?fecha=${fecha}${medico ? `&medico=${medico}` : ''}`).then(setCitas).catch((e) => setError(e.message)); };
  useEffect(cargar, [fecha, medico]);

  const hacerCancelacion = async () => {
    try { await api(`/citas/${cancelar.id_cita}/cancelar`, { method: 'PATCH', body: { motivo: 'Cancelada por recepción a pedido del paciente' } });
      setOk(`Se canceló la cita de ${cancelar.paciente}.`); setCancelar(null); cargar();
    } catch (e) { setError(e.message); setCancelar(null); }
  };
  const hacerRepro = async () => {
    try { await api(`/citas/${repro.id_cita}/reprogramar`, { method: 'PATCH', body: nuevoTurno });
      setOk(`La cita de ${repro.paciente} pasó al ${fechaLarga(nuevoTurno.fecha)} a las ${nuevoTurno.hora}.`);
      setRepro(null); setNuevoTurno(null); cargar();
    } catch (e) { setError(e.message); }
  };

  const activas = (citas || []).filter((c) => c.estado !== 'Cancelada').length;
  return (
    <>
      <header className="cab-pagina"><h1>Citas del día</h1><p>Agenda de todos los médicos. Desde aquí puedes reprogramar o cancelar.</p></header>
      <div className="fila-filtros barra">
        <div className="nav-fecha">
          <button className="btn chico" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
          <input type="date" aria-label="Fecha de las citas" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          <button className="btn chico" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">›</button>
          <button className="btn texto" onClick={() => setFecha(hoyISO())}>Hoy</button>
        </div>
        <select value={medico} onChange={(e) => setMedico(e.target.value)} aria-label="Médico">
          <option value="">Todos los médicos</option>
          {medicos.map((m) => <option key={m.id_medico} value={m.id_medico}>Dr(a). {m.nombres} {m.apellidos}</option>)}
        </select>
      </div>
      <p className="contador">{fechaLarga(fecha)} · <b>{activas}</b> citas activas</p>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>
      {!citas ? <Cargando /> : citas.length === 0 ? <Vacio>No hay citas para este día.</Vacio> : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Hora</th><th>Paciente</th><th>Cédula</th><th>Celular</th><th>Médico</th><th>Especialidad</th><th>Estado</th><th><span className="solo-lector">Acciones</span></th></tr></thead>
            <tbody>
              {citas.map((c) => {
                const activa = ['Pendiente', 'Confirmada'].includes(c.estado);
                return (
                  <tr key={c.id_cita} className={activa ? '' : 'apagada'}>
                    <td><b>{c.hora}</b></td><td>{c.paciente}</td><td>{c.cedula}</td><td>{c.celular}</td>
                    <td>{c.medico}</td><td>{c.especialidad}</td><td><Estado e={c.estado} /></td>
                    <td className="botones">
                      {activa && <button className="btn chico" aria-label={`Reprogramar cita de ${c.paciente} a las ${c.hora}`} onClick={() => { setRepro(c); setNuevoTurno(null); }}>Reprogramar</button>}
                      {activa && <button className="btn chico peligro-txt" aria-label={`Cancelar cita de ${c.paciente} a las ${c.hora}`} onClick={() => setCancelar(c)}>Cancelar</button>}
                      <button className="btn chico texto" aria-label={`Historial de la cita de ${c.paciente}`} onClick={() => setHist(c)}>Historial</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {repro && (
        <Modal titulo={`Reprogramar la cita de ${repro.paciente}`} onClose={() => setRepro(null)}>
          <p className="ayuda">Ahora: {fechaLarga(repro.fecha)} a las {repro.hora} con Dr(a). {repro.medico}. Elige el nuevo turno:</p>
          <SelectorTurno especialidad={repro.id_especialidad} medicoFijo={String(repro.id_medico)} elegido={nuevoTurno} onElegir={setNuevoTurno} />
          <div className="acciones">
            <button className="btn" onClick={() => setRepro(null)}>Cerrar</button>
            <button className="btn primario" disabled={!nuevoTurno} onClick={hacerRepro}>
              {nuevoTurno ? `Mover al ${nuevoTurno.fecha.slice(8)}/${nuevoTurno.fecha.slice(5, 7)} a las ${nuevoTurno.hora}` : 'Elige un turno'}
            </button>
          </div>
        </Modal>
      )}
      {cancelar && (
        <Modal titulo="¿Cancelar la cita?" onClose={() => setCancelar(null)}>
          <p><b>{cancelar.paciente}</b><br />{fechaLarga(cancelar.fecha)} a las {cancelar.hora} con Dr(a). {cancelar.medico}</p>
          <div className="acciones">
            <button className="btn" onClick={() => setCancelar(null)}>No</button>
            <button className="btn peligro" onClick={hacerCancelacion}>Sí, cancelar</button>
          </div>
        </Modal>
      )}
      {hist && <HistorialCita cita={hist} onClose={() => setHist(null)} />}
    </>
  );
}

// RF07: agendar a nombre de un paciente que llama o llega al centro
export function NuevaCita() {
  const [buscar, setBuscar] = useState('');
  const [res, setRes] = useState([]);
  const [paciente, setPaciente] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ cedula: '', nombres: '', apellidos: '', celular: '', acepta_datos: false });
  const [error, setError] = useState('');

  useEffect(() => {
    if (buscar.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => api(`/pacientes?buscar=${encodeURIComponent(buscar)}`).then(setRes).catch((e) => setError(e.message)), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const crear = async (e) => {
    e.preventDefault(); setError('');
    try { const p = await api('/pacientes', { method: 'POST', body: f }); setPaciente(p); setNuevo(false); }
    catch (x) { setError(x.message); }
  };
  const c = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  return (
    <>
      <header className="cab-pagina"><h1>Agendar cita</h1><p>Para pacientes que llaman por teléfono o llegan al centro médico.</p></header>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      {!paciente ? (
        <div className="tarjeta">
          <h2 className="h-tarjeta">1. Busca al paciente</h2>
          <input className="buscador" aria-label="Buscar paciente por cédula o nombre" placeholder="Cédula o nombre del paciente" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <p className="solo-lector" aria-live="polite">{buscar.trim().length >= 2 ? `${res.length} pacientes encontrados` : ''}</p>
          {res.length > 0 && (
            <ul className="resultados">
              {res.map((p) => (
                <li key={p.id_paciente}><button onClick={() => setPaciente(p)}>
                  <b>{p.nombres} {p.apellidos}</b><span>{p.cedula} · {p.celular}{p.correo ? ` · ${p.correo}` : ' · sin cuenta en línea'}</span>
                </button></li>
              ))}
            </ul>
          )}
          {buscar.trim().length >= 2 && res.length === 0 && <p className="ayuda">No se encontró ningún paciente.</p>}
          {!nuevo ? <button className="btn texto" onClick={() => setNuevo(true)}>+ Registrar paciente nuevo</button> : (
            <form className="form borde" onSubmit={crear}>
              <h3>Paciente nuevo</h3>
              <div className="dos">
                <label className="campo"><span>Nombres</span><input required {...c('nombres')} /></label>
                <label className="campo"><span>Apellidos</span><input required {...c('apellidos')} /></label>
              </div>
              <div className="dos">
                <label className="campo"><span>Cédula</span><input required maxLength={10} pattern="\d{10}" {...c('cedula')} /></label>
                <label className="campo"><span>Celular</span><input required maxLength={10} pattern="09\d{8}" placeholder="09xxxxxxxx" {...c('celular')} /></label>
              </div>
              <label className="check-linea"><input type="checkbox" required checked={f.acepta_datos} onChange={(e) => setF({ ...f, acepta_datos: e.target.checked })} />
                <span>El paciente aceptó el uso de sus datos personales (LOPDP).</span></label>
              <div className="acciones"><button type="button" className="btn" onClick={() => setNuevo(false)}>Cancelar</button><button className="btn primario">Guardar paciente</button></div>
            </form>
          )}
        </div>
      ) : (
        <>
          <div className="paciente-elegido">
            <span>Paciente: <b>{paciente.nombres} {paciente.apellidos}</b> · {paciente.cedula}</span>
            <button className="btn texto" onClick={() => setPaciente(null)}>Cambiar paciente</button>
          </div>
          <Reserva paciente={paciente} />
        </>
      )}
    </>
  );
}
