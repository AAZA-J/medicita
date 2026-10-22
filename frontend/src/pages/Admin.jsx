import { useEffect, useState } from 'react';
import { api, DIAS, hoyISO } from '../api';
import { Alerta, Cargando, Modal, Vacio } from '../components/ui';

// RF08: especialidades
export function Especialidades() {
  const [lista, setLista] = useState(null);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const cargar = () => api('/especialidades?todas=1').then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);
  const guardar = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (edit.id_especialidad) await api(`/especialidades/${edit.id_especialidad}`, { method: 'PUT', body: edit });
      else await api('/especialidades', { method: 'POST', body: edit });
      setEdit(null); cargar();
    } catch (x) { setError(x.message); }
  };
  const alternar = async (e) => {
    try { await api(`/especialidades/${e.id_especialidad}`, { method: 'PUT', body: { ...e, activa: !e.activa } }); cargar(); }
    catch (x) { setError(x.message); }
  };
  return (
    <>
      <header className="cab-pagina fila"><div><h1>Especialidades</h1><p>Las especialidades activas son las que ven los pacientes al reservar.</p></div>
        <button className="btn primario" onClick={() => setEdit({ nombre: '', descripcion: '' })}>+ Nueva especialidad</button></header>
      <Alerta onClose={() => setError('')}>{!edit && error}</Alerta>
      {!lista ? <Cargando /> : (
        <div className="tabla-envoltura"><table className="tabla">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Médicos</th><th>Estado</th><th><span className="solo-lector">Acciones</span></th></tr></thead>
          <tbody>{lista.map((e) => (
            <tr key={e.id_especialidad} className={e.activa ? '' : 'apagada'}>
              <td><b>{e.nombre}</b></td><td>{e.descripcion || '—'}</td><td>{e.medicos}</td>
              <td><span className={`estado ${e.activa ? 'atendida' : 'cancelada'}`}>{e.activa ? 'Activa' : 'Inactiva'}</span></td>
              <td className="botones"><button className="btn chico" onClick={() => setEdit(e)}>Editar</button>
                <button className="btn chico texto" onClick={() => alternar(e)}>{e.activa ? 'Desactivar' : 'Activar'}</button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {edit && (
        <Modal titulo={edit.id_especialidad ? 'Editar especialidad' : 'Nueva especialidad'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <Alerta>{error}</Alerta>
            <label className="campo"><span>Nombre</span><input required value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></label>
            <label className="campo"><span>Descripción</span><input value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></label>
            <div className="acciones"><button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primario">Guardar</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// RF08: médicos y su asignación a especialidades
export function Medicos() {
  const [lista, setLista] = useState(null);
  const [esps, setEsps] = useState([]);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const cargar = () => api('/medicos/admin').then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); api('/especialidades?todas=1').then(setEsps); }, []);
  const guardar = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (edit.id_medico) await api(`/medicos/${edit.id_medico}`, { method: 'PUT', body: edit });
      else await api('/medicos', { method: 'POST', body: edit });
      setEdit(null); cargar();
    } catch (x) { setError(x.message); }
  };
  const alternar = async (m) => {
    try { await api(`/medicos/${m.id_medico}`, { method: 'PUT', body: { ...m, especialidades: m.especialidades.map((x) => x.id), activo: !m.activo } }); cargar(); }
    catch (x) { setError(x.message); }
  };
  const marcar = (id) => setEdit({ ...edit, especialidades: edit.especialidades.includes(id) ? edit.especialidades.filter((x) => x !== id) : [...edit.especialidades, id] });
  return (
    <>
      <header className="cab-pagina fila"><div><h1>Médicos</h1><p>Cada médico puede atender una o más especialidades.</p></div>
        <button className="btn primario" onClick={() => setEdit({ nombres: '', apellidos: '', correo: '', contrasena: '', especialidades: [] })}>+ Nuevo médico</button></header>
      <Alerta onClose={() => setError('')}>{!edit && error}</Alerta>
      {!lista ? <Cargando /> : (
        <div className="tabla-envoltura"><table className="tabla">
          <thead><tr><th>Médico</th><th>Correo</th><th>Especialidades</th><th>Estado</th><th><span className="solo-lector">Acciones</span></th></tr></thead>
          <tbody>{lista.map((m) => (
            <tr key={m.id_medico} className={m.activo ? '' : 'apagada'}>
              <td><b>Dr(a). {m.nombres} {m.apellidos}</b></td><td>{m.correo}</td>
              <td>{m.especialidades.map((e) => <span className="chip" key={e.id}>{e.nombre}</span>)}</td>
              <td><span className={`estado ${m.activo ? 'atendida' : 'cancelada'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td className="botones"><button className="btn chico" onClick={() => setEdit({ ...m, especialidades: m.especialidades.map((x) => x.id) })}>Editar</button>
                <button className="btn chico texto" onClick={() => alternar(m)}>{m.activo ? 'Desactivar' : 'Activar'}</button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {edit && (
        <Modal titulo={edit.id_medico ? 'Editar médico' : 'Nuevo médico'} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <Alerta>{error}</Alerta>
            <div className="dos">
              <label className="campo"><span>Nombres</span><input required value={edit.nombres} onChange={(e) => setEdit({ ...edit, nombres: e.target.value })} /></label>
              <label className="campo"><span>Apellidos</span><input required value={edit.apellidos} onChange={(e) => setEdit({ ...edit, apellidos: e.target.value })} /></label>
            </div>
            {!edit.id_medico && (
              <div className="dos">
                <label className="campo"><span>Correo (para iniciar sesión)</span><input type="email" required value={edit.correo} onChange={(e) => setEdit({ ...edit, correo: e.target.value })} /></label>
                <label className="campo"><span>Contraseña inicial</span><input type="password" required minLength={8} value={edit.contrasena} onChange={(e) => setEdit({ ...edit, contrasena: e.target.value })} /></label>
              </div>
            )}
            <fieldset className="campo"><legend>Especialidades</legend>
              <div className="checks">{esps.filter((e) => e.activa).map((e) => (
                <label key={e.id_especialidad} className={`check-chip ${edit.especialidades.includes(e.id_especialidad) ? 'activo' : ''}`}>
                  <input type="checkbox" checked={edit.especialidades.includes(e.id_especialidad)} onChange={() => marcar(e.id_especialidad)} />{e.nombre}
                </label>))}</div>
            </fieldset>
            <div className="acciones"><button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primario">Guardar</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// RF09: horario semanal de cada médico
export function Horarios() {
  const [medicos, setMedicos] = useState([]);
  const [medico, setMedico] = useState('');
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ dias: [], hora_inicio: '08:00', hora_fin: '12:00', duracion_min: 20 });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { api('/medicos').then((m) => { setMedicos(m); if (m[0]) setMedico(String(m[0].id_medico)); }); }, []);
  const cargar = () => medico && api(`/horarios?medico=${medico}`).then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [medico]);
  const dia = (d) => setF({ ...f, dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d] });
  const agregar = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    if (!f.dias.length) return setError('Elige al menos un día.');
    try { const r = await api('/horarios', { method: 'POST', body: { ...f, id_medico: Number(medico) } });
      setOk(`Se agregó el horario a ${r.creados} día(s).`); setF({ ...f, dias: [] }); cargar(); }
    catch (x) { setError(x.message); }
  };
  const borrar = async (h) => { await api(`/horarios/${h.id_horario}`, { method: 'DELETE' }); cargar(); };
  const turnos = (h) => {
    const a = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
    return Math.floor((a(h.hora_fin) - a(h.hora_inicio)) / h.duracion_min);
  };
  return (
    <>
      <header className="cab-pagina"><h1>Horarios de atención</h1><p>El sistema crea los turnos según la duración de cada cita.</p></header>
      <div className="fila-filtros barra">
        <label className="campo"><span>Médico</span>
          <select value={medico} onChange={(e) => setMedico(e.target.value)}>
            {medicos.map((m) => <option key={m.id_medico} value={m.id_medico}>Dr(a). {m.nombres} {m.apellidos}</option>)}
          </select></label>
      </div>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>
      <div className="dos-col">
        <div className="tarjeta">
          <h2 className="h-tarjeta">Horario semanal</h2>
          {lista.length === 0 ? <Vacio>Este médico todavía no tiene horario.</Vacio> : (
            <ul className="horarios">{lista.map((h) => (
              <li key={h.id_horario}><b>{DIAS[h.dia_semana]}</b><span>{h.hora_inicio.slice(0, 5)} a {h.hora_fin.slice(0, 5)}</span>
                <small>{h.duracion_min} min · {turnos(h)} turnos</small><button className="btn chico texto peligro-txt" aria-label={`Quitar horario del ${DIAS[h.dia_semana]}`} onClick={() => borrar(h)}>Quitar</button></li>))}</ul>
          )}
        </div>
        <form className="tarjeta form" onSubmit={agregar}>
          <h2 className="h-tarjeta">Agregar horario</h2>
          <fieldset className="campo"><legend>Días</legend>
            <div className="checks">{[1, 2, 3, 4, 5, 6].map((d) => (
              <label key={d} className={`check-chip ${f.dias.includes(d) ? 'activo' : ''}`}><input type="checkbox" checked={f.dias.includes(d)} onChange={() => dia(d)} />{DIAS[d].slice(0, 3)}</label>))}</div>
          </fieldset>
          <div className="tres">
            <label className="campo"><span>Desde</span><input type="time" required value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></label>
            <label className="campo"><span>Hasta</span><input type="time" required value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></label>
            <label className="campo"><span>Minutos por cita</span><input type="number" min={10} max={120} step={5} required value={f.duracion_min} onChange={(e) => setF({ ...f, duracion_min: Number(e.target.value) })} /></label>
          </div>
          <button className="btn primario">Agregar</button>
        </form>
      </div>
    </>
  );
}

// RF15: resumen mensual por especialidad y control de recordatorios (RF11)
export function Reportes() {
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [datos, setDatos] = useState(null);
  const [recs, setRecs] = useState([]);
  const [msg, setMsg] = useState('');
  const cargarRecs = () => api('/recordatorios').then(setRecs).catch(() => {});
  useEffect(() => { setDatos(null); api(`/reportes/mensual?mes=${mes}`).then(setDatos); }, [mes]);
  useEffect(() => { cargarRecs(); }, []);
  const enviar = async () => { const r = await api('/recordatorios/enviar', { method: 'POST' }); setMsg(`Se enviaron ${r.enviados} recordatorio(s).`); cargarRecs(); };
  const tot = (k) => (datos || []).reduce((s, x) => s + x[k], 0);
  const max = Math.max(1, ...(datos || []).map((x) => x.total));
  return (
    <>
      <header className="cab-pagina fila"><div><h1>Resumen mensual</h1><p>Citas por especialidad: atendidas, canceladas y pacientes que no asistieron.</p></div>
        <input type="month" aria-label="Mes del resumen" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" /></header>
      {!datos ? <Cargando /> : (
        <>
          <div className="kpis">
            <div className="kpi"><span>Total de citas</span><b>{tot('total')}</b></div>
            <div className="kpi verde"><span>Atendidas</span><b>{tot('atendidas')}</b></div>
            <div className="kpi gris"><span>Canceladas</span><b>{tot('canceladas')}</b></div>
            <div className="kpi rojo"><span>No asistieron</span><b>{tot('no_asistidas')}</b></div>
          </div>
          <div className="tabla-envoltura"><table className="tabla">
            <thead><tr><th>Especialidad</th><th>Total</th><th>Atendidas</th><th>Canceladas</th><th>No asistieron</th><th>Por atender</th><th className="col-barra">Distribución</th></tr></thead>
            <tbody>{datos.map((d) => (
              <tr key={d.especialidad}><td><b>{d.especialidad}</b></td><td>{d.total}</td><td>{d.atendidas}</td><td>{d.canceladas}</td><td>{d.no_asistidas}</td><td>{d.por_atender}</td>
                <td className="col-barra" aria-hidden="true"><div className="barra-apilada" style={{ width: `${(d.total / max) * 100}%` }}>
                  {['atendidas', 'canceladas', 'no_asistidas', 'por_atender'].map((k) => d[k] > 0 && <span key={k} className={k} style={{ flex: d[k] }} title={`${k.replace('_', ' ')}: ${d[k]}`} />)}
                </div></td></tr>))}</tbody>
          </table></div>
          <p className="leyenda"><span className="atendidas" />Atendidas <span className="canceladas" />Canceladas <span className="no_asistidas" />No asistieron <span className="por_atender" />Por atender</p>
        </>
      )}
      <header className="cab-pagina fila sub"><div><h2>Recordatorios enviados</h2><p>Se envían solos 24 horas antes de cada cita. Con el botón se envían ahora los que estén pendientes.</p></div>
        <button className="btn" onClick={enviar}>Enviar pendientes ahora</button></header>
      <Alerta tipo="ok" onClose={() => setMsg('')}>{msg}</Alerta>
      {recs.length === 0 ? <Vacio>Todavía no se ha enviado ningún recordatorio.</Vacio> : (
        <div className="tabla-envoltura"><table className="tabla">
          <thead><tr><th>Cita</th><th>Paciente</th><th>Fecha de la cita</th><th>Canal</th><th>Estado</th><th>Enviado</th></tr></thead>
          <tbody>{recs.map((r) => (
            <tr key={r.id_recordatorio}><td>#{r.id_cita}</td><td>{r.paciente}</td><td>{r.fecha} {r.hora}</td><td>{r.canal}</td>
              <td><span className={`estado ${r.estado === 'enviado' ? 'atendida' : 'noasistio'}`}>{r.estado}</span></td>
              <td>{r.enviado_en ? new Date(r.enviado_en).toLocaleString('es-EC') : '—'}</td></tr>))}</tbody>
        </table></div>
      )}
    </>
  );
}
