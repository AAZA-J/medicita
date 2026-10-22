import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CitasService } from './citas.service';
import { Publico, Roles, Sesion, Usuario } from './auth/auth.guard';
import { check } from './util';

@Controller()
export class CitasController {
  constructor(private s: CitasService) {}

  // RF03: consulta de disponibilidad por especialidad, médico y fecha
  @Publico()
  @Get('disponibilidad')
  disponibilidad(@Query('especialidad') esp: string, @Query('fecha') fecha: string, @Query('medico') medico?: string) {
    check(/^\d+$/.test(esp || ''), 'Elige una especialidad.');
    check(!medico || /^\d+$/.test(medico), 'El médico no es válido.');
    return this.s.disponibilidadPorEspecialidad(Number(esp), fecha, medico ? Number(medico) : undefined);
  }

  @Roles('paciente', 'recepcionista')
  @Post('citas')
  crear(@Usuario() u: Sesion, @Body() b: any) {
    return this.s.crear(u, b);
  }

  @Roles('paciente')
  @Get('citas/mias')
  mias(@Usuario() u: Sesion) {
    return this.s.mias(u);
  }

  @Roles('recepcionista', 'administrador')
  @Get('citas')
  buscar(@Query() q: any) {
    return this.s.buscar(q);
  }

  @Get('citas/:id')
  ver(@Usuario() u: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.s.ver(u, id);
  }

  @Get('citas/:id/historial')
  historial(@Usuario() u: Sesion, @Param('id', ParseIntPipe) id: number) {
    return this.s.historialDe(u, id);
  }

  @Roles('paciente', 'recepcionista')
  @Patch('citas/:id/cancelar')
  cancelar(@Usuario() u: Sesion, @Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.s.cancelar(u, id, b?.motivo);
  }

  @Roles('recepcionista')
  @Patch('citas/:id/reprogramar')
  reprogramar(@Usuario() u: Sesion, @Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.s.reprogramar(u, id, b);
  }

  @Roles('recepcionista')
  @Get('pacientes')
  pacientes(@Query('buscar') q = '') {
    return this.s.pacientes(q);
  }

  @Roles('recepcionista')
  @Post('pacientes')
  crearPaciente(@Body() b: any) {
    return this.s.crearPaciente(b);
  }

  @Roles('medico')
  @Get('agenda')
  agenda(@Usuario() u: Sesion, @Query('fecha') fecha?: string) {
    return this.s.agenda(u, fecha);
  }

  @Roles('medico')
  @Post('citas/:id/atencion')
  atender(@Usuario() u: Sesion, @Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.s.atender(u, id, b);
  }
}
