import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISO_KEY } from './requiere-permiso.decorator';
import { PermisosService } from './permisos.service';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const codigoPermiso = this.reflector.getAllAndOverride<string | undefined>(PERMISO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!codigoPermiso) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    if (!request.user?.id) {
      throw new UnauthorizedException();
    }

    await this.permisosService.checkPermiso(request.user.id, codigoPermiso);
    return true;
  }
}
