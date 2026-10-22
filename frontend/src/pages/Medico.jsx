import { useEffect, useState } from 'react';
import { api, fechaLarga, hoyISO, sumarDias } from '../api';
import { Alerta, Cargando, Estado, Modal, Vacio } from '../components/ui';

// RF13: agenda del día. RF10: seguimiento de la atención.
export function AgendaMedico() {
  const [fecha, setFecha] = useState(hoyISO());
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [atender, setAtender] = useState(null);
  const [f, setF] = useState({ asistio: true, observaciones: '', requiere_control: false });

  const cargar = () => { setCitas(null); api(`/agenda?fecha=${fecha}`).then(setCitas).catch((e) => setError(e.message)); };
  useEffect(cargar, [fecha]);

  const guardar = async () => {
    try {
      await api(`/citas/${atender.id_cita}/atencion`, { method: 'POST', body: f });
      setOk(`Se registró el seguimiento de ${atender.paciente}.`); setAtender(null); cargar();
    } catch (e) { setError(e.message); setAtender(null); }
  };

  const pend = (citas || []).filter((c) => ['Pendiente', 'Confirmada'].includes(c.estado)).length;
  return (
    <>
      <header className="cab-pagina"><h1>Mi agenda</h1><p>Pacientes del día y registro de cada atención.</p></header>
      <div className="fila-filtros barra">
        <div className="nav-fecha">
          <button className="btn chico" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
          <input type="date" aria-label="Fecha de la agenda" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          <button className="btn chico" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">›</button>
          <button className="btn texto" onClick={() => setFecha(hoyISO())}>Hoy</button>
        </div>
      </div>
      <p className="contador">{fechaLarga(fecha)} · <b>{citas?.length || 0}</b> pacientes · <b>{pend}</b> por atender</p>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>
      {!citas ? <Cargando /> : citas.length === 0 ? <Vacio>No tienes pacientes agendados este día.</Vacio> : (
        <div className="lista-citas">
          {citas.map((c) => {
            const abierta = ['Pendiente', 'Confirmada'].includes(c.estado);
            return (
              <article className="cita" key={c.id_cita}>
                <div className="cita-fecha"><b>{c.hora}</b><span>{c.especialidad}</span></div>
                <div className="cita-info"><b>{c.paciente}</b><span>Cédula {c.cedula} · {c.celular}</span>
                  {c.observaciones && <span className="obs">“{c.observaciones}”{c.requiere_control && <span className="chip aviso">Control</span>}</span>}
                </div>
                <Estado e={c.estado} />
                {abierta && fecha <= hoyISO()
                  ? <button className="btn primario chico" aria-label={`Registrar atención de ${c.paciente}`} onClick={() => { setAtender(c); setF({ asistio: true, observaciones: '', requiere_control: false }); }}>Registrar atención</button>
                  : <span />}
              </article>
            );
          })}
        </div>
      )}
      {atender && (
        <Modal titulo={`Atención de ${atender.paciente}`} onClose={() => setAtender(null)}>
          <div className="form">
            <div className="segmento" role="radiogroup" aria-label="¿El paciente asistió?">
              <button role="radio" aria-checked={f.asistio} className={f.asistio ? 'activo' : ''} onClick={() => setF({ ...f, asistio: true })}>Fue atendido</button>
              <button role="radio" aria-checked={!f.asistio} className={!f.asistio ? 'activo' : ''} onClick={() => setF({ ...f, asistio: false, requiere_control: false })}>No asistió</button>
            </div>
            {f.asistio && (
              <>
                <label className="campo"><span>Observaciones</span>
                  <textarea rows={4} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} placeholder="Indicaciones o notas de la consulta" /></label>
                <label className="check-linea"><input type="checkbox" checked={f.requiere_control} onChange={(e) => setF({ ...f, requiere_control: e.target.checked })} />
                  <span>Necesita una cita de control</span></label>
              </>
            )}
            <div className="acciones">
              <button className="btn" onClick={() => setAtender(null)}>Cancelar</button>
              <button className="btn primario" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
