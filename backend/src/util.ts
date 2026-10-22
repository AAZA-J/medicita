import { BadRequestException, ConflictException } from '@nestjs/common';

export function check(cond: any, msg: string): asserts cond {
  if (!cond) throw new BadRequestException(msg);
}

export const esFecha = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const esHora = (s: any) => typeof s === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(s);
// Nombres y apellidos: solo letras, espacios, punto, apóstrofo y guion
export const esNombre = (s: any) => typeof s === 'string' && /^[\p{L} .'-]{2,80}$/u.test(s.trim());

export const hhmm = (s: string) => s.slice(0, 5);

// Fecha de hoy y hora actual en la zona del centro médico
export function ahora() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
    date: d,
  };
}

// Convierte fecha + hora de la cita en un Date local
export function fechaHora(fecha: string, hora: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}

// Día de la semana como lo guarda la tabla horarios: 1 lunes ... 6 sábado (0 domingo)
export function diaSemana(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// Turnos de un horario, por ejemplo 08:00, 08:20, 08:40...
export function turnos(inicio: string, fin: string, duracion: number) {
  const aMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const out: string[] = [];
  for (let t = aMin(inicio); t + duracion <= aMin(fin); t += duracion) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

// RF05: el índice único cita_unica rechaza el turno repetido
export function errorTurnoOcupado(e: any): never {
  if (e?.code === '23505') {
    throw new ConflictException('Ese horario ya fue tomado por otro paciente. Elige otro.');
  }
  throw e;
}
