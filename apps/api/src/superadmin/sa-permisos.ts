// Catálogo de permisos de plataforma para superadmins secundarios.
// El superadmin principal (seed, usuario.es_superadmin_principal) tiene bypass total.
// La lectura (dashboard global y lista de empresas) es libre para todo superadmin.

export const SA_PERMISOS = [
  { codigo: 'SA_EMPRESA_MANAGE', descripcion: 'Gestionar empresas: activar/suspender, límite de usuarios y pagos del servicio' },
  { codigo: 'SA_SUPERADMIN_MANAGE', descripcion: 'Gestionar administradores de la plataforma' },
] as const;

export type CodigoPermisoSA = (typeof SA_PERMISOS)[number]['codigo'];

export const CODIGOS_SA: string[] = SA_PERMISOS.map((p) => p.codigo);
