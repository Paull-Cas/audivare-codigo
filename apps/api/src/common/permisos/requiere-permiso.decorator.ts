import { SetMetadata } from '@nestjs/common';

export const PERMISO_KEY = 'requiere_permiso';

export const RequierePermiso = (codigoPermiso: string) =>
  SetMetadata(PERMISO_KEY, codigoPermiso);
