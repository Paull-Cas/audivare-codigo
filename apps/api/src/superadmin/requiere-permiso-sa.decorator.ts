import { SetMetadata } from '@nestjs/common';
import type { CodigoPermisoSA } from './sa-permisos';

export const PERMISO_SA_KEY = 'permiso_sa';

/** Exige un permiso de plataforma al superadmin (el principal tiene bypass). */
export const RequierePermisoSA = (codigo: CodigoPermisoSA) => SetMetadata(PERMISO_SA_KEY, codigo);
