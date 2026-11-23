import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { db, usuario } from '@audivare/database';
import { eq } from 'drizzle-orm';

@Injectable()
export class SuperadminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('No autenticado');
    }

    const u = await db
      .select({ tipoUsuario: usuario.tipoUsuario })
      .from(usuario)
      .where(eq(usuario.id, userId));

    if (u.length === 0 || u[0].tipoUsuario !== 'SUPERADMIN') {
      throw new ForbiddenException('No tiene permisos de Superadmin');
    }

    return true;
  }
}
