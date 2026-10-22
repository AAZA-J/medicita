import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
  SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export type Rol = 'paciente' | 'recepcionista' | 'medico' | 'administrador';
export interface Sesion {
  sub: number; rol: Rol; nombre: string; correo: string;
  id_paciente?: number; id_medico?: number;
}

export const PUBLICO = 'publico';
export const Publico = () => SetMetadata(PUBLICO, true);
export const ROLES = 'roles';
export const Roles = (...r: Rol[]) => SetMetadata(ROLES, r);
export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): Sesion =>
  ctx.switchToHttp().getRequest().usuario);

// Revisa el token en cada petición (RF02, RNF01) y lo renueva para que la
// sesión solo se cierre tras 30 minutos sin actividad (RNF02).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destino)) return true;
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const h: string = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar.');
    let s: Sesion;
    try {
      const { iat, exp, ...datos } = await this.jwt.verifyAsync(token);
      s = datos as Sesion;
    } catch {
      throw new UnauthorizedException('La sesión expiró. Vuelve a iniciar sesión.');
    }
    req.usuario = s;
    res.setHeader('X-Token-Renovado', await this.jwt.signAsync(s));
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES, destino);
    if (roles && !roles.includes(s.rol)) {
      throw new ForbiddenException('No tienes permiso para esta opción.');
    }
    return true;
  }
}
