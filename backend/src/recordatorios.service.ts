import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { DbService } from './db.service';
import { esc } from './secreto';

// RF11: recordatorio por correo 24 horas antes, con enlace para confirmar (RF12)
// RF16: también por WhatsApp si se configuran las claves de la API de Meta
@Injectable()
export class RecordatoriosService {
  private log = new Logger('Recordatorios');
  private smtp = !!process.env.SMTP_HOST;
  private mailer = this.smtp
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : nodemailer.createTransport({ jsonTransport: true });

  constructor(private db: DbService) {}

  // Se revisa cada 15 minutos qué citas empiezan dentro de las próximas 24 horas
  @Cron('0 */15 * * * *')
  async revisar() {
    const n = await this.enviarPendientes();
    if (n) this.log.log(`Se enviaron ${n} recordatorios`);
  }

  async enviarPendientes(): Promise<number> {
    const citas = await this.db.query(
      `SELECT c.id_cita, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, u.correo, p.celular,
              p.nombres AS paciente, m.nombres || ' ' || m.apellidos AS medico, e.nombre AS especialidad
         FROM citas c
         JOIN pacientes p ON p.id_paciente = c.id_paciente
         JOIN usuarios u ON u.id_usuario = p.id_usuario
         JOIN medicos m ON m.id_medico = c.id_medico
         JOIN especialidades e ON e.id_especialidad = c.id_especialidad
        WHERE c.estado = 'Pendiente'
          AND (c.fecha + c.hora) > NOW()
          AND (c.fecha + c.hora) <= NOW() + INTERVAL '24 hours'
          AND NOT EXISTS (SELECT 1 FROM recordatorios r WHERE r.id_cita = c.id_cita AND r.canal = 'correo' AND r.estado = 'enviado')`);
    let enviados = 0;
    for (const c of citas) {
      if (await this.enviarCorreo(c)) enviados++;
      await this.enviarWhatsApp(c);
    }
    return enviados;
  }

  private fechaBonita(f: string) {
    const [y, m, d] = f.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private async enviarCorreo(c: any) {
    const token = randomBytes(24).toString('hex');
    const front = process.env.FRONTEND_URL || 'http://localhost:5173';
    const confirmar = `${front}/confirmar/${token}`;
    const cancelar = `${front}/paciente/citas`;
    try {
      await this.mailer.sendMail({
        from: process.env.SMTP_FROM || 'MediCita <no-responder@medicita.ec>',
        to: c.correo,
        subject: `Recordatorio: tu cita de ${c.especialidad} es mañana a las ${c.hora}`,
        // Versión en texto simple: la leen mejor los lectores de pantalla y los celulares básicos
        text: `Hola ${c.paciente}. Te recordamos tu cita de ${c.especialidad} con ${c.medico} el ${this.fechaBonita(c.fecha)} a las ${c.hora}.\n\nPara confirmar tu asistencia abre este enlace: ${confirmar}\n\nSi no puedes asistir, cancela tu cita aquí: ${cancelar}\n\nMediCita`,
        html: `<p>Hola ${esc(c.paciente)},</p>
<p>Te recordamos tu cita en el centro médico:</p>
<ul><li><b>Especialidad:</b> ${esc(c.especialidad)}</li><li><b>Médico:</b> ${esc(c.medico)}</li>
<li><b>Fecha:</b> ${this.fechaBonita(c.fecha)}</li><li><b>Hora:</b> ${c.hora}</li></ul>
<p><a href="${confirmar}" style="display:inline-block;padding:12px 20px;background:#1f6f6b;color:#ffffff;border-radius:8px;font-weight:bold;text-decoration:none">Confirmar mi asistencia</a></p>
<p>Si no puedes asistir, cancela tu cita aquí para que otra persona pueda usar el horario: <a href="${cancelar}">${cancelar}</a></p>
<p>MediCita</p>`,
      });
      await this.db.query(
        `INSERT INTO recordatorios (id_cita, canal, estado, enviado_en, token_confirmacion) VALUES ($1, 'correo', 'enviado', NOW(), $2)`,
        [c.id_cita, token]);
      if (!this.smtp) this.log.warn(`(sin SMTP) Recordatorio de la cita ${c.id_cita} para ${c.correo}. Enlace: ${confirmar}`);
      return true;
    } catch (e: any) {
      this.log.error(`No se pudo enviar el correo de la cita ${c.id_cita}: ${e.message}`);
      await this.db.query(
        `INSERT INTO recordatorios (id_cita, canal, estado, token_confirmacion) VALUES ($1, 'correo', 'fallido', $2)`,
        [c.id_cita, token]);
      return false;
    }
  }

  private async enviarWhatsApp(c: any) {
    const tk = process.env.WHATSAPP_TOKEN, phone = process.env.WHATSAPP_PHONE_ID;
    if (!tk || !phone) return;
    const ya = await this.db.one(`SELECT 1 FROM recordatorios WHERE id_cita = $1 AND canal = 'whatsapp' AND estado = 'enviado'`, [c.id_cita]);
    if (ya) return;
    const token = randomBytes(24).toString('hex');
    let estado = 'enviado';
    try {
      const r = await fetch(`https://graph.facebook.com/v20.0/${phone}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: '593' + String(c.celular).slice(1), type: 'text',
          text: { body: `MediCita: ${c.paciente}, te recordamos tu cita de ${c.especialidad} con ${c.medico} el ${this.fechaBonita(c.fecha)} a las ${c.hora}.` },
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e: any) {
      estado = 'fallido';
      this.log.error(`No se pudo enviar el WhatsApp de la cita ${c.id_cita}: ${e.message}`);
    }
    await this.db.query(
      `INSERT INTO recordatorios (id_cita, canal, estado, enviado_en, token_confirmacion) VALUES ($1, 'whatsapp', $2, $3, $4)`,
      [c.id_cita, estado, estado === 'enviado' ? new Date() : null, token]);
  }

  // RF12: el paciente confirma desde el enlace del correo
  async confirmar(token: string) {
    const r = await this.db.one(
      `SELECT c.id_cita, c.estado, c.fecha, to_char(c.hora, 'HH24:MI') AS hora, p.id_usuario,
              m.nombres || ' ' || m.apellidos AS medico, e.nombre AS especialidad
         FROM recordatorios r JOIN citas c ON c.id_cita = r.id_cita
         JOIN pacientes p ON p.id_paciente = c.id_paciente
         JOIN medicos m ON m.id_medico = c.id_medico
         JOIN especialidades e ON e.id_especialidad = c.id_especialidad
        WHERE r.token_confirmacion = $1`, [token]);
    if (!r) return { ok: false, mensaje: 'El enlace no es válido.' };
    if (r.estado === 'Confirmada') return { ok: true, mensaje: 'Tu asistencia ya estaba confirmada.', cita: r };
    if (r.estado !== 'Pendiente') return { ok: false, mensaje: `La cita está ${r.estado.toLowerCase()} y ya no se puede confirmar.`, cita: r };
    await this.db.tx(async (t) => {
      await t.query(`UPDATE citas SET estado = 'Confirmada' WHERE id_cita = $1`, [r.id_cita]);
      await t.query(
        `INSERT INTO historial_citas (id_cita, estado_anterior, estado_nuevo, cambiado_por, motivo)
         VALUES ($1, 'Pendiente', 'Confirmada', $2, 'Confirmó desde el correo')`, [r.id_cita, r.id_usuario]);
    });
    return { ok: true, mensaje: '¡Listo! Tu asistencia quedó confirmada.', cita: { ...r, estado: 'Confirmada' } };
  }

  historial() {
    return this.db.query(
      `SELECT r.id_recordatorio, r.id_cita, r.canal, r.estado, r.enviado_en, c.fecha, to_char(c.hora, 'HH24:MI') AS hora,
              p.nombres || ' ' || p.apellidos AS paciente
         FROM recordatorios r JOIN citas c ON c.id_cita = r.id_cita JOIN pacientes p ON p.id_paciente = c.id_paciente
        ORDER BY r.id_recordatorio DESC LIMIT 50`);
  }
}
