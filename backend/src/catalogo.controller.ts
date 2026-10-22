import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DbService } from './db.service';
import { check, esHora, esNombre } from './util';
import { Publico, Roles } from './auth/auth.guard';

// RF08: especialidades y médicos. RF09: horarios.
@Controller()
export class CatalogoController {
  constructor(private db: DbService) {}

  // ---------- Especialidades
  @Publico()
  @Get('especialidades')
  especialidades(@Query('todas') todas?: string) {
    return this.db.query(
      `SELECT e.*, (SELECT COUNT(*)::int FROM medico_especialidad me
                      JOIN medicos m ON m.id_medico = me.id_medico AND m.activo
                     WHERE me.id_especialidad = e.id_especialidad) AS medicos
         FROM especialidades e ${todas ? '' : 'WHERE e.activa'} ORDER BY e.nombre`);
  }

  @Roles('administrador')
  @Post('especialidades')
  async crearEspecialidad(@Body() b: any) {
    check(String(b?.nombre || '').trim(), 'Escribe el nombre de la especialidad.');
    try {
      return await this.db.one(
        'INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING *',
        [b.nombre.trim(), b.descripcion || null]);
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Ya existe una especialidad con ese nombre.');
      throw e;
    }
  }

  @Roles('administrador')
  @Put('especialidades/:id')
  async editarEspecialidad(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    check(String(b?.nombre || '').trim(), 'Escribe el nombre de la especialidad.');
    const r = await this.db.one(
      `UPDATE especialidades SET nombre = $1, descripcion = $2, activa = COALESCE($3, activa)
        WHERE id_especialidad = $4 RETURNING *`,
      [b.nombre.trim(), b.descripcion || null, typeof b.activa === 'boolean' ? b.activa : null, id]);
    if (!r) throw new NotFoundException('La especialidad no existe.');
    return r;
  }

  // ---------- Médicos
  // Lista pública (para reservar): solo médicos activos y sin datos de contacto
  @Publico()
  @Get('medicos')
  medicos(@Query('especialidad') esp?: string) {
    return this.listaMedicos(false, esp);
  }

  // Lista completa con correos, solo para el administrador
  @Roles('administrador')
  @Get('medicos/admin')
  medicosAdmin() {
    return this.listaMedicos(true);
  }

  private listaMedicos(admin: boolean, esp?: string) {
    const p: any[] = [];
    let where = admin ? 'TRUE' : 'm.activo';
    if (esp) { p.push(Number(esp)); where += ` AND EXISTS (SELECT 1 FROM medico_especialidad x WHERE x.id_medico = m.id_medico AND x.id_especialidad = $1)`; }
    return this.db.query(
      `SELECT m.id_medico, m.nombres, m.apellidos, m.activo, ${admin ? 'u.correo,' : ''}
              COALESCE(json_agg(json_build_object('id', e.id_especialidad, 'nombre', e.nombre))
                       FILTER (WHERE e.id_especialidad IS NOT NULL), '[]') AS especialidades
         FROM medicos m
         JOIN usuarios u ON u.id_usuario = m.id_usuario
         LEFT JOIN medico_especialidad me ON me.id_medico = m.id_medico
         LEFT JOIN especialidades e ON e.id_especialidad = me.id_especialidad
        WHERE ${where}
        GROUP BY m.id_medico, u.correo ORDER BY m.apellidos, m.nombres`, p);
  }

  @Roles('administrador')
  @Post('medicos')
  async crearMedico(@Body() b: any) {
    const correo = String(b?.correo || '').trim().toLowerCase();
    check(esNombre(b?.nombres) && esNombre(b?.apellidos), 'Escribe nombres y apellidos solo con letras.');
    check(/^\S+@\S+\.\S+$/.test(correo), 'El correo no es válido.');
    check(String(b?.contrasena || '').length >= 8, 'La contraseña debe tener al menos 8 caracteres.');
    check(Array.isArray(b?.especialidades) && b.especialidades.length > 0, 'Asigna al menos una especialidad.');
    if (await this.db.one('SELECT 1 FROM usuarios WHERE correo = $1', [correo])) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
    const hash = await bcrypt.hash(String(b.contrasena), 10);
    return this.db.tx(async (c) => {
      const u = await c.query(`INSERT INTO usuarios (correo, contrasena_hash, rol) VALUES ($1, $2, 'medico') RETURNING id_usuario`, [correo, hash]);
      const m = await c.query('INSERT INTO medicos (id_usuario, nombres, apellidos) VALUES ($1, $2, $3) RETURNING id_medico',
        [u.rows[0].id_usuario, b.nombres.trim(), b.apellidos.trim()]);
      for (const e of b.especialidades) {
        await c.query('INSERT INTO medico_especialidad VALUES ($1, $2)', [m.rows[0].id_medico, Number(e)]);
      }
      return { id_medico: m.rows[0].id_medico };
    });
  }

  @Roles('administrador')
  @Put('medicos/:id')
  async editarMedico(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    check(esNombre(b?.nombres) && esNombre(b?.apellidos), 'Escribe nombres y apellidos solo con letras.');
    check(Array.isArray(b?.especialidades) && b.especialidades.length > 0, 'Asigna al menos una especialidad.');
    return this.db.tx(async (c) => {
      const r = await c.query(
        `UPDATE medicos SET nombres = $1, apellidos = $2, activo = COALESCE($3, activo) WHERE id_medico = $4 RETURNING id_usuario`,
        [b.nombres.trim(), b.apellidos.trim(), typeof b.activo === 'boolean' ? b.activo : null, id]);
      if (!r.rowCount) throw new NotFoundException('El médico no existe.');
      if (typeof b.activo === 'boolean') await c.query('UPDATE usuarios SET activo = $1 WHERE id_usuario = $2', [b.activo, r.rows[0].id_usuario]);
      await c.query('DELETE FROM medico_especialidad WHERE id_medico = $1', [id]);
      for (const e of b.especialidades) await c.query('INSERT INTO medico_especialidad VALUES ($1, $2)', [id, Number(e)]);
      return { ok: true };
    });
  }

  // ---------- Horarios semanales (RF09)
  @Publico()
  @Get('horarios')
  horarios(@Query('medico') medico?: string) {
    return this.db.query(
      `SELECT h.*, m.nombres || ' ' || m.apellidos AS medico
         FROM horarios h JOIN medicos m ON m.id_medico = h.id_medico
        ${medico ? 'WHERE h.id_medico = $1' : ''}
        ORDER BY m.apellidos, h.dia_semana, h.hora_inicio`, medico ? [Number(medico)] : []);
  }

  @Roles('administrador')
  @Post('horarios')
  async crearHorario(@Body() b: any) {
    const dias: number[] = Array.isArray(b?.dias) ? b.dias.map(Number) : [Number(b?.dia_semana)];
    check(b?.id_medico, 'Elige el médico.');
    check(dias.length && dias.every((d) => d >= 1 && d <= 6), 'Elige días de lunes a sábado.');
    check(esHora(b?.hora_inicio) && esHora(b?.hora_fin) && b.hora_fin > b.hora_inicio, 'La hora de fin debe ser mayor que la de inicio.');
    const dur = Number(b?.duracion_min);
    check(dur >= 10 && dur <= 120, 'La duración de cada cita debe estar entre 10 y 120 minutos.');
    for (const d of dias) {
      const cruce = await this.db.one(
        `SELECT 1 FROM horarios WHERE id_medico = $1 AND dia_semana = $2 AND hora_inicio < $4 AND hora_fin > $3`,
        [b.id_medico, d, b.hora_inicio, b.hora_fin]);
      if (cruce) throw new ConflictException('Ese horario se cruza con otro que el médico ya tiene ese día.');
    }
    for (const d of dias) {
      await this.db.query(
        'INSERT INTO horarios (id_medico, dia_semana, hora_inicio, hora_fin, duracion_min) VALUES ($1, $2, $3, $4, $5)',
        [b.id_medico, d, b.hora_inicio, b.hora_fin, dur]);
    }
    return { creados: dias.length };
  }

  @Roles('administrador')
  @Delete('horarios/:id')
  async borrarHorario(@Param('id', ParseIntPipe) id: number) {
    await this.db.query('DELETE FROM horarios WHERE id_horario = $1', [id]);
    return { ok: true };
  }
}
