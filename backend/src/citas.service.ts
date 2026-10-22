import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from './db.service';
import { Sesion } from './auth/auth.guard';
import { ahora, check, esNombre, diaSemana, errorTurnoOcupado, esFecha, esHora, fechaHora, hhmm, turnos } from './util';

const ACTIVAS = `('Pendiente', 'Confirmada')`;

@Injectable()
export class CitasService {
  constructor(private db: DbService) {}

  // RF03: turnos de un médico en una fecha, marcando cuáles están libres
  async disponibilidad(id_medico: number, fecha: string) {
    const dia = diaSemana(fecha);
    const hs = await this.db.query(
      'SELECT hora_inicio, hora_fin, duracion_min FROM horarios WHERE id_medico = $1 AND dia_semana = $2 ORDER BY hora_inicio',
      [id_medico, dia]);
    const ocupadas = new Set((await this.db.query(
      `SELECT hora FROM citas WHERE id_medico = $1 AND fecha = $2 AND estado <> 'Cancelada'`,
      [id_medico, fecha])).map((r) => hhmm(r.hora)));
    const hoy = ahora();
    const out: { hora: string; libre: boolean }[] = [];
    for (const h of hs) {
      for (const t of turnos(h.hora_inicio, h.hora_fin, h.duracion_min)) {
        const pasado = fecha < hoy.fecha || (fecha === hoy.fecha && t <= hoy.hora);
        out.push({ hora: t, libre: !pasado && !ocupadas.has(t) });
      }
    }
    return out;
  }

  async disponibilidadPorEspecialidad(id_especialidad: number, fecha: string, id_medico?: number) {
    check(esFecha(fecha), 'Elige una fecha válida.');
    const meds = await this.db.query(
      `SELECT m.id_medico, m.nombres || ' ' || m.apellidos AS medico
         FROM medicos m JOIN medico_especialidad me ON me.id_medico = m.id_medico
        WHERE m.activo AND me.id_especialidad = $1 ${id_medico ? 'AND m.id_medico = $2' : ''}
        ORDER BY m.apellidos`, id_medico ? [id_especialidad, id_medico] : [id_especialidad]);
    const out = [];
    for (const m of meds) out.push({ ...m, turnos: await this.disponibilidad(m.id_medico, fecha) });
    return out;
  }

  private async validarTurno(id_medico: number, id_especialidad: number, fecha: string, hora: string) {
    check(esFecha(fecha) && esHora(hora), 'Elige una fecha y una hora válidas.');
    const m = await this.db.one(
      `SELECT 1 FROM medicos m JOIN medico_especialidad me ON me.id_medico = m.id_medico
        WHERE m.activo AND m.id_medico = $1 AND me.id_especialidad = $2`, [id_medico, id_especialidad]);
    check(m, 'Ese médico no atiende esa especialidad.');
    const t = (await this.disponibilidad(id_medico, fecha)).find((x) => x.hora === hhmm(hora));
    check(t, 'Esa hora no está dentro del horario del médico.');
    return t;
  }

  private historial(c: PoolClient | DbService, id_cita: number, antes: string | null, despues: string,
                    por: number, motivo: string, fecha_ant: string | null = null, hora_ant: string | null = null) {
    const sql = `INSERT INTO historial_citas (id_cita, estado_anterior, estado_nuevo, fecha_anterior, hora_anterior, cambiado_por, motivo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    const p = [id_cita, antes, despues, fecha_ant, hora_ant, por, motivo];
    return c instanceof DbService ? c.query(sql, p) : c.query(sql, p);
  }

  // RF04, RF05 y RF07 (agendar)
  async crear(u: Sesion, b: any) {
    let id_paciente = u.id_paciente;
    if (u.rol === 'recepcionista') {
      id_paciente = Number(b?.id_paciente);
      check(id_paciente, 'Elige el paciente.');
    }
    check(id_paciente, 'Solo un paciente o la recepcionista pueden reservar.');
    const id_medico = Number(b?.id_medico), id_esp = Number(b?.id_especialidad);
    const t = await this.validarTurno(id_medico, id_esp, b?.fecha, b?.hora);
    if (!t.libre) errorTurnoOcupado({ code: '23505' });
    try {
      return await this.db.tx(async (c) => {
        const r = await c.query(
          `INSERT INTO citas (id_paciente, id_medico, id_especialidad, fecha, hora, creada_por)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_cita`,
          [id_paciente, id_medico, id_esp, b.fecha, b.hora, u.sub]);
        const id = r.rows[0].id_cita;
        await this.historial(c, id, null, 'Pendiente', u.sub,
          u.rol === 'recepcionista' ? (b.motivo || 'Agendada por recepción') : 'Reserva en línea');
        return this.detalle(id, c);
      });
    } catch (e) {
      errorTurnoOcupado(e);
    }
  }

  async detalle(id: number, c?: PoolClient) {
    const sql = `SELECT c.id_cita, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, c.estado, c.id_paciente, c.id_medico,
                        c.id_especialidad, p.nombres || ' ' || p.apellidos AS paciente, p.cedula, p.celular,
                        m.nombres || ' ' || m.apellidos AS medico, e.nombre AS especialidad,
                        a.asistio, a.observaciones, a.requiere_control
                   FROM citas c
                   JOIN pacientes p ON p.id_paciente = c.id_paciente
                   JOIN medicos m ON m.id_medico = c.id_medico
                   JOIN especialidades e ON e.id_especialidad = c.id_especialidad
                   LEFT JOIN atenciones a ON a.id_cita = c.id_cita
                  WHERE c.id_cita = $1`;
    const r = c ? (await c.query(sql, [id])).rows[0] : await this.db.one(sql, [id]);
    if (!r) throw new NotFoundException('La cita no existe.');
    return r;
  }

  // RNF01: cada usuario solo ve lo que le corresponde
  private async propia(u: Sesion, id: number) {
    const c = await this.detalle(id);
    if (u.rol === 'paciente' && c.id_paciente !== u.id_paciente) throw new ForbiddenException('Esta cita no es tuya.');
    if (u.rol === 'medico' && c.id_medico !== u.id_medico) throw new ForbiddenException('Esta cita no es de tu agenda.');
    return c;
  }

  ver(u: Sesion, id: number) {
    return this.propia(u, id);
  }

  async historialDe(u: Sesion, id: number) {
    await this.propia(u, id);
    return this.db.query(
      `SELECT h.estado_anterior, h.estado_nuevo, h.fecha_anterior, to_char(h.hora_anterior, 'HH24:MI') AS hora_anterior,
              h.motivo, h.cambiado_en, u.rol AS cambiado_por
         FROM historial_citas h JOIN usuarios u ON u.id_usuario = h.cambiado_por
        WHERE h.id_cita = $1 ORDER BY h.cambiado_en, h.id_historial`, [id]);
  }

  // RF14: citas del paciente, próximas y pasadas
  mias(u: Sesion) {
    return this.db.query(
      `SELECT c.id_cita, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, c.estado,
              m.nombres || ' ' || m.apellidos AS medico, e.nombre AS especialidad,
              a.observaciones, a.requiere_control
         FROM citas c JOIN medicos m ON m.id_medico = c.id_medico
         JOIN especialidades e ON e.id_especialidad = c.id_especialidad
         LEFT JOIN atenciones a ON a.id_cita = c.id_cita
        WHERE c.id_paciente = $1 ORDER BY c.fecha DESC, c.hora DESC`, [u.id_paciente]);
  }

  // Recepción y administración: citas por fecha, médico o paciente
  buscar(q: any) {
    // Se validan los filtros antes de usarlos (además, todo va como parámetro, nunca pegado al SQL)
    check(!q.fecha || esFecha(q.fecha), 'La fecha no es válida.');
    check(!q.medico || /^\d+$/.test(q.medico), 'El médico no es válido.');
    check(!q.paciente || /^\d+$/.test(q.paciente), 'El paciente no es válido.');
    check(!q.estado || ['Pendiente', 'Confirmada', 'Cancelada', 'Atendida', 'No asistió'].includes(q.estado), 'El estado no es válido.');
    const p: any[] = []; const w: string[] = [];
    if (q.fecha) { p.push(q.fecha); w.push(`c.fecha = $${p.length}`); }
    if (q.medico) { p.push(Number(q.medico)); w.push(`c.id_medico = $${p.length}`); }
    if (q.paciente) { p.push(Number(q.paciente)); w.push(`c.id_paciente = $${p.length}`); }
    if (q.estado) { p.push(q.estado); w.push(`c.estado = $${p.length}`); }
    return this.db.query(
      `SELECT c.id_cita, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, c.estado, c.id_medico, c.id_especialidad,
              p.nombres || ' ' || p.apellidos AS paciente, p.cedula, p.celular,
              m.nombres || ' ' || m.apellidos AS medico, e.nombre AS especialidad
         FROM citas c JOIN pacientes p ON p.id_paciente = c.id_paciente
         JOIN medicos m ON m.id_medico = c.id_medico
         JOIN especialidades e ON e.id_especialidad = c.id_especialidad
        ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
        ORDER BY c.fecha, c.hora LIMIT 300`, p);
  }

  // RF06 (paciente, hasta 24 h antes) y RF07 (recepción, sin ese límite)
  async cancelar(u: Sesion, id: number, motivo?: string) {
    const c = await this.propia(u, id);
    check(['Pendiente', 'Confirmada'].includes(c.estado), `La cita ya está ${c.estado.toLowerCase()} y no se puede cancelar.`);
    if (u.rol === 'paciente') {
      const faltan = fechaHora(c.fecha, c.hora).getTime() - Date.now();
      check(faltan >= 24 * 3600 * 1000,
        'Solo puedes cancelar hasta 24 horas antes de la cita. Para cancelar ahora, llama a recepción.');
    }
    await this.db.tx(async (t) => {
      await t.query(`UPDATE citas SET estado = 'Cancelada', cancelada_en = NOW() WHERE id_cita = $1`, [id]);
      await this.historial(t, id, c.estado, 'Cancelada', u.sub,
        motivo || (u.rol === 'paciente' ? 'Cancelada por el paciente' : 'Cancelada por recepción'));
    });
    return this.detalle(id);
  }

  // RF07: reprogramar a otra fecha u hora (puede cambiar de médico de la misma especialidad)
  async reprogramar(u: Sesion, id: number, b: any) {
    const c = await this.detalle(id);
    check(['Pendiente', 'Confirmada'].includes(c.estado), 'Solo se pueden reprogramar citas pendientes o confirmadas.');
    const id_medico = Number(b?.id_medico || c.id_medico);
    const t = await this.validarTurno(id_medico, c.id_especialidad, b?.fecha, b?.hora);
    if (!t.libre) errorTurnoOcupado({ code: '23505' });
    try {
      await this.db.tx(async (x) => {
        await x.query(`UPDATE citas SET fecha = $1, hora = $2, id_medico = $3, estado = 'Pendiente' WHERE id_cita = $4`,
          [b.fecha, b.hora, id_medico, id]);
        await this.historial(x, id, c.estado, 'Pendiente', u.sub, b.motivo || 'Reprogramada por recepción', c.fecha, c.hora);
      });
    } catch (e) {
      errorTurnoOcupado(e);
    }
    return this.detalle(id);
  }

  // ---------- Pacientes (recepción)
  pacientes(buscar = '') {
    check(String(buscar).length <= 60, 'La búsqueda es demasiado larga.');
    const s = `%${buscar.trim()}%`;
    return this.db.query(
      `SELECT p.id_paciente, p.cedula, p.nombres, p.apellidos, p.celular, u.correo
         FROM pacientes p LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
        WHERE p.cedula LIKE $1 OR (p.nombres || ' ' || p.apellidos) ILIKE $1
        ORDER BY p.apellidos LIMIT 20`, [s]);
  }

  async crearPaciente(b: any) {
    check(/^\d{10}$/.test(b?.cedula || ''), 'La cédula debe tener 10 números.');
    check(esNombre(b?.nombres) && esNombre(b?.apellidos), 'Escribe nombres y apellidos solo con letras.');
    check(/^09\d{8}$/.test(b?.celular || ''), 'El celular debe empezar con 09 y tener 10 números.');
    check(b?.acepta_datos === true, 'El paciente debe aceptar el uso de sus datos personales.');
    const ya = await this.db.one('SELECT id_paciente FROM pacientes WHERE cedula = $1', [b.cedula]);
    check(!ya, 'Ya hay un paciente registrado con esa cédula.');
    return this.db.one(
      `INSERT INTO pacientes (cedula, nombres, apellidos, celular, acepta_datos) VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [b.cedula, b.nombres.trim(), b.apellidos.trim(), b.celular]);
  }

  // ---------- Médico: agenda (RF13) y seguimiento (RF10)
  agenda(u: Sesion, fecha?: string) {
    const f = esFecha(fecha) ? fecha : ahora().fecha;
    return this.db.query(
      `SELECT c.id_cita, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, c.estado, e.nombre AS especialidad,
              p.nombres || ' ' || p.apellidos AS paciente, p.cedula, p.celular,
              a.asistio, a.observaciones, a.requiere_control
         FROM citas c JOIN pacientes p ON p.id_paciente = c.id_paciente
         JOIN especialidades e ON e.id_especialidad = c.id_especialidad
         LEFT JOIN atenciones a ON a.id_cita = c.id_cita
        WHERE c.id_medico = $1 AND c.fecha = $2 AND c.estado <> 'Cancelada'
        ORDER BY c.hora`, [u.id_medico, f]);
  }

  async atender(u: Sesion, id: number, b: any) {
    const c = await this.propia(u, id);
    check(['Pendiente', 'Confirmada'].includes(c.estado), 'Esta cita ya tiene registrado el seguimiento.');
    check(typeof b?.asistio === 'boolean', 'Indica si el paciente asistió.');
    check(c.fecha <= ahora().fecha, 'Solo puedes registrar la atención el día de la cita o después.');
    const nuevo = b.asistio ? 'Atendida' : 'No asistió';
    await this.db.tx(async (t) => {
      await t.query(
        'INSERT INTO atenciones (id_cita, asistio, observaciones, requiere_control) VALUES ($1, $2, $3, $4)',
        [id, b.asistio, b.observaciones || null, !!b.requiere_control]);
      await t.query('UPDATE citas SET estado = $1 WHERE id_cita = $2', [nuevo, id]);
      await this.historial(t, id, c.estado, nuevo, u.sub, 'Seguimiento registrado por el médico');
    });
    return this.detalle(id);
  }
}
