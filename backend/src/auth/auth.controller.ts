import { Body, Controller, Get, Post, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db.service';
import { check, esNombre } from '../util';
import { Publico, Sesion, Usuario } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private db: DbService, private jwt: JwtService) {}

  private async sesion(id_usuario: number): Promise<Sesion> {
    const u = await this.db.one(
      `SELECT u.id_usuario, u.correo, u.rol, p.id_paciente, m.id_medico,
              COALESCE(p.nombres || ' ' || p.apellidos, m.nombres || ' ' || m.apellidos,
                       INITCAP(u.rol)) AS nombre
         FROM usuarios u
         LEFT JOIN pacientes p ON p.id_usuario = u.id_usuario
         LEFT JOIN medicos m   ON m.id_usuario = u.id_usuario
        WHERE u.id_usuario = $1`, [id_usuario]);
    const s: Sesion = { sub: u.id_usuario, rol: u.rol, nombre: u.nombre, correo: u.correo };
    if (u.id_paciente) s.id_paciente = u.id_paciente;
    if (u.id_medico) s.id_medico = u.id_medico;
    return s;
  }

  // RF02: inicio de sesión
  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // máximo 10 intentos por minuto por IP
  @Post('login')
  async login(@Body() b: any) {
    check(b?.correo && b?.contrasena, 'Escribe tu correo y tu contraseña.');
    const u = await this.db.one(
      'SELECT id_usuario, contrasena_hash, activo FROM usuarios WHERE correo = $1',
      [String(b.correo).trim().toLowerCase()]);
    if (!u || !u.activo || !(await bcrypt.compare(String(b.contrasena), u.contrasena_hash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    const s = await this.sesion(u.id_usuario);
    return { token: await this.jwt.signAsync(s), usuario: s };
  }

  // RF01: registro del paciente. RNF08: debe aceptar el uso de sus datos.
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('registro')
  async registro(@Body() b: any) {
    const correo = String(b?.correo || '').trim().toLowerCase();
    check(/^\d{10}$/.test(b?.cedula || ''), 'La cédula debe tener 10 números.');
    check(esNombre(b?.nombres) && esNombre(b?.apellidos), 'Escribe tus nombres y apellidos solo con letras.');
    check(/^\S+@\S+\.\S+$/.test(correo), 'El correo no es válido.');
    check(/^09\d{8}$/.test(b?.celular || ''), 'El celular debe empezar con 09 y tener 10 números.');
    check(String(b?.contrasena || '').length >= 8, 'La contraseña debe tener al menos 8 caracteres.');
    check(b?.acepta_datos === true, 'Debes aceptar el uso de tus datos personales para registrarte.');

    if (await this.db.one('SELECT 1 FROM usuarios WHERE correo = $1', [correo])) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }
    const previo = await this.db.one('SELECT id_paciente, id_usuario FROM pacientes WHERE cedula = $1', [b.cedula]);
    if (previo?.id_usuario) throw new ConflictException('Ya existe una cuenta con esa cédula.');

    const hash = await bcrypt.hash(String(b.contrasena), 10);
    const id = await this.db.tx(async (c) => {
      const u = await c.query(
        `INSERT INTO usuarios (correo, contrasena_hash, rol) VALUES ($1, $2, 'paciente') RETURNING id_usuario`,
        [correo, hash]);
      const idu = u.rows[0].id_usuario;
      if (previo) {
        // El paciente ya había sido registrado por recepción: se le une la cuenta
        await c.query(
          `UPDATE pacientes SET id_usuario = $1, nombres = $2, apellidos = $3, celular = $4,
                  acepta_datos = TRUE, fecha_aceptacion = NOW() WHERE id_paciente = $5`,
          [idu, b.nombres.trim(), b.apellidos.trim(), b.celular, previo.id_paciente]);
      } else {
        await c.query(
          `INSERT INTO pacientes (id_usuario, cedula, nombres, apellidos, celular, acepta_datos)
           VALUES ($1, $2, $3, $4, $5, TRUE)`,
          [idu, b.cedula, b.nombres.trim(), b.apellidos.trim(), b.celular]);
      }
      return idu;
    });
    const s = await this.sesion(id);
    return { token: await this.jwt.signAsync(s), usuario: s };
  }

  @Get('yo')
  yo(@Usuario() u: Sesion) {
    return u;
  }
}
