import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DbService } from './db.service';
import { RecordatoriosService } from './recordatorios.service';
import { Publico, Roles } from './auth/auth.guard';
import { ahora } from './util';

@Controller()
export class OtrosController {
  constructor(private db: DbService, private rec: RecordatoriosService) {}

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('recordatorios/confirmar/:token')
  confirmar(@Param('token') token: string) {
    return this.rec.confirmar(token);
  }

  @Roles('administrador')
  @Get('recordatorios')
  recordatorios() {
    return this.rec.historial();
  }

  // Permite probar los recordatorios sin esperar al proceso automático
  @Roles('administrador')
  @Post('recordatorios/enviar')
  async enviar() {
    return { enviados: await this.rec.enviarPendientes() };
  }

  // RF15: resumen mensual por especialidad
  @Roles('administrador')
  @Get('reportes/mensual')
  mensual(@Query('mes') mes?: string) {
    const m = /^\d{4}-\d{2}$/.test(mes || '') ? mes! : ahora().fecha.slice(0, 7);
    return this.db.query(
      `SELECT e.nombre AS especialidad,
              COUNT(c.id_cita)::int AS total,
              COUNT(*) FILTER (WHERE c.estado = 'Atendida')::int AS atendidas,
              COUNT(*) FILTER (WHERE c.estado = 'Cancelada')::int AS canceladas,
              COUNT(*) FILTER (WHERE c.estado = 'No asistió')::int AS no_asistidas,
              COUNT(*) FILTER (WHERE c.estado IN ('Pendiente', 'Confirmada'))::int AS por_atender
         FROM especialidades e
         LEFT JOIN citas c ON c.id_especialidad = e.id_especialidad AND to_char(c.fecha, 'YYYY-MM') = $1
        GROUP BY e.id_especialidad ORDER BY e.nombre`, [m]);
  }

  @Publico()
  @Get('salud')
  salud() {
    return { ok: true, hora: new Date().toISOString() };
  }
}
