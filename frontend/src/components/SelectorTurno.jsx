import { useEffect, useState } from 'react';
import { api, hoyISO, sumarDias, fechaCorta, fechaLarga } from '../api';
import { Alerta, Cargando, Vacio } from './ui';

// Próximos 14 días sin domingos (el centro atiende de lunes a sábado)
function proximosDias() {
  const out = []; let d = hoyISO();
  while (out.length < 14) {
    const [y, m, dd] = d.split('-').map(Number);
    if (new Date(y, m - 1, dd).getDay() !== 0) out.push(d);
    d = sumarDias(d, 1);
  }
  return out;
}

// RF03: consulta de turnos libres por especialidad, médico y fecha
export default function SelectorTurno({ especialidad, medicoFijo, elegido, onElegir }) {
  const dias = proximosDias();
  const [fecha, setFecha] = useState(elegido?.fecha || dias[0]);
  const [medicos, setMedicos] = useState([]);
  const [medico, setMedico] = useState(medicoFijo || '');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api(`/medicos?especialidad=${especialidad}`).then(setMedicos).catch((e) => setError(e.message)); }, [especialidad]);
  useEffect(() => {
    setDatos(null); setError('');
    api(`/disponibilidad?especialidad=${especialidad}&fecha=${fecha}${medico ? `&medico=${medico}` : ''}`)
      .then(setDatos).catch((e) => setError(e.message));
  }, [especialidad, fecha, medico]);

  return (
    <div className="selector">
      <div className="fila-filtros">
        <label className="campo">
          <span>Médico</span>
          <select value={medico} onChange={(e) => setMedico(e.target.value)}>
            <option value="">Cualquier médico</option>
            {medicos.map((m) => <option key={m.id_medico} value={m.id_medico}>Dr(a). {m.nombres} {m.apellidos}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Otra fecha</span>
          <input type="date" value={fecha} min={hoyISO()} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
      </div>
      <div className="dias" role="group" aria-label="Elige el día">
        {dias.map((d) => (
          <button key={d} aria-pressed={d === fecha} aria-label={fechaLarga(d)} className={`dia ${d === fecha ? 'activo' : ''}`} onClick={() => setFecha(d)}>
            {fechaCorta(d)}
          </button>
        ))}
      </div>
      <Alerta>{error}</Alerta>
      <p className="solo-lector" aria-live="polite">{datos ? `${fechaLarga(fecha)}: ${datos.reduce((n, m) => n + m.turnos.filter((t) => t.libre).length, 0)} horarios libres.` : ''}</p>
      {!datos && !error && <Cargando />}
      {datos && datos.length === 0 && <Vacio>No hay médicos activos en esta especialidad.</Vacio>}
      {datos && datos.map((m) => {
        const libres = m.turnos.filter((t) => t.libre);
        return (
          <div className="medico-turnos" key={m.id_medico}>
            <div className="medico-nombre">
              <span className="avatar" aria-hidden="true">{m.medico.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <div><h3 className="nombre-medico">Dr(a). {m.medico}</h3><small>{libres.length ? `${libres.length} horarios libres` : 'Sin horarios libres este día'}</small></div>
            </div>
            {m.turnos.length > 0 && (
              <div className="turnos" role="group" aria-label={`Horarios de Dr(a). ${m.medico}`}>
                {m.turnos.map((t) => {
                  const sel = elegido && elegido.id_medico === m.id_medico && elegido.fecha === fecha && elegido.hora === t.hora;
                  return (
                    <button key={t.hora} disabled={!t.libre} className={`turno ${sel ? 'activo' : ''}`}
                      aria-pressed={!!sel} aria-label={`${t.hora}, ${t.libre ? 'libre' : 'ocupado'}`}
                      onClick={() => onElegir({ id_medico: m.id_medico, medico: m.medico, fecha, hora: t.hora })}>
                      {t.hora}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
