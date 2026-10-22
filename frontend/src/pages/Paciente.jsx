import { useEffect, useState } from 'react';
import { api, fechaLarga } from '../api';
import { Alerta, Cargando, Estado, Modal, Vacio } from '../components/ui';
import Reserva from '../components/Reserva';

export function Reservar() {
  return (
    <>
      <header className="cab-pagina"><h1>Reservar una cita</h1><p>Elige la especialidad, el día y la hora que te queden mejor.</p></header>
      <Reserva />
    </>
  );
}

// RF14 (historial) y RF06 (cancelar hasta 24 h antes)
export function MisCitas() {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cancelar, setCancelar] = useState(null);
  const cargar = () => api('/citas/mias').then(setCitas).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const faltanHoras = (c) => {
    const [y, m, d] = c.fecha.split('-').map(Number); const [h, mi] = c.hora.split(':').map(Number);
    return (new Date(y, m - 1, d, h, mi) - new Date()) / 36e5;
  };
  const proximas = (citas || []).filter((c) => faltanHoras(c) > 0 && ['Pendiente', 'Confirmada'].includes(c.estado)).reverse();
  const pasadas = (citas || []).filter((c) => !proximas.includes(c));

  const confirmarCancelacion = async () => {
    try {
      await api(`/citas/${cancelar.id_cita}/cancelar`, { method: 'PATCH' });
      setOk('Tu cita fue cancelada y el horario quedó libre para otro paciente.'); setCancelar(null); cargar();
    } catch (e) { setError(e.message); setCancelar(null); }
  };

  return (
    <>
      <header className="cab-pagina"><h1>Mis citas</h1><p>Tus próximas citas y el historial de las anteriores.</p></header>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>
      {!citas ? <Cargando /> : (
        <>
          <h2 className="sub-titulo">Próximas</h2>
          {proximas.length === 0 ? <Vacio>No tienes citas próximas.</Vacio> : (
            <div className="lista-citas">
              {proximas.map((c) => (
                <article className="cita" key={c.id_cita}>
                  <div className="cita-fecha"><b>{c.hora}</b><span>{fechaLarga(c.fecha)}</span></div>
                  <div className="cita-info"><b>{c.especialidad}</b><span>Dr(a). {c.medico}</span></div>
                  <Estado e={c.estado} />
                  {faltanHoras(c) >= 24
                    ? <button className="btn peligro chico" aria-label={`Cancelar cita de ${c.especialidad} del ${fechaLarga(c.fecha)} a las ${c.hora}`} onClick={() => setCancelar(c)}>Cancelar</button>
                    : <span className="ayuda" title="Solo se puede cancelar en línea hasta 24 horas antes">Para cancelar, llama a recepción</span>}
                </article>
              ))}
            </div>
          )}
          <h2 className="sub-titulo">Historial</h2>
          {pasadas.length === 0 ? <Vacio>Todavía no tienes citas anteriores.</Vacio> : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead><tr><th>Fecha</th><th>Hora</th><th>Especialidad</th><th>Médico</th><th>Estado</th><th>Indicaciones</th></tr></thead>
                <tbody>
                  {pasadas.map((c) => (
                    <tr key={c.id_cita}>
                      <td>{fechaLarga(c.fecha)}</td><td>{c.hora}</td><td>{c.especialidad}</td><td>{c.medico}</td>
                      <td><Estado e={c.estado} /></td>
                      <td>{c.observaciones || '—'}{c.requiere_control && <span className="chip aviso">Necesita control</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {cancelar && (
        <Modal titulo="¿Cancelar esta cita?" onClose={() => setCancelar(null)}>
          <p>{cancelar.especialidad} con Dr(a). {cancelar.medico}<br />{fechaLarga(cancelar.fecha)} a las <b>{cancelar.hora}</b></p>
          <p className="ayuda">El horario quedará libre para otro paciente.</p>
          <div className="acciones">
            <button className="btn" onClick={() => setCancelar(null)}>No, mantener</button>
            <button className="btn peligro" onClick={confirmarCancelacion}>Sí, cancelar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
