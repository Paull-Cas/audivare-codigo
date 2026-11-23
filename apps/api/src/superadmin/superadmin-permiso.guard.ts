import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { db, usuario, superadminPermiso } from '@audivare/database';
import { eq, and } from 'drizzle-orm';
import { PERMISO_SA_KEY } from './requiere-permiso-sa.decorator';

/**
 * Verifica el permiso de plataforma marcado con @RequierePermisoSA. Corre después
 * de SuperadminGuard (el tipo SUPERADMIN ya está garantizado). Sin decorator, la
 * ruta queda abierta a cualquier superadmin. El principal tiene bypass total.
 */
@Injectable()
export class SuperadminPermisoGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const codigo = this.reflector.getAllAndOverride<string | undefined>(PERMISO_SA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!codigo) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) throw new ForbiddenException('No autenticado');

    const u = await db
      .select({ esPrincipal: usuario.esSuperadminPrincipal })
      .from(usuario)
      .where(eq(usuario.id, userId));

    if (u.length && u[0].esPrincipal) return true;

    const tiene = await db
      .select()
      .from(superadminPermiso)
      .where(and(
        eq(superadminPermiso.usuarioId, userId),
        eq(superadminPermiso.codigoPermiso, codigo),
      ));

    if (!tiene.length) {
      throw new ForbiddenException(`Requiere el permiso ${codigo}`);
    }

    return true;
  }
}
