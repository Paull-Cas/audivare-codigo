import { eq } from 'drizzle-orm';
import { db } from './index';
import { permiso } from './schema/permiso';
import { rolPermiso } from './schema/rol-permiso';
import { usuario } from './schema/usuario';

// Superadmin de plataforma. Parametrizable por env para no hardcodear credenciales.
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
if (!SUPERADMIN_EMAIL) throw new Error('Define SUPERADMIN_EMAIL antes de ejecutar el seed.');
const SUPERADMIN_NOMBRE = process.env.SUPERADMIN_NOMBRE || 'Renzo Paull Castañeda Cabanillas';

const permisosSeed = [
  { codigoPermiso: 'DOCUMENTO_MENSUAL_READ', descripcion: 'Consultar documentos mensuales y actividad' },
  { codigoPermiso: 'DOCUMENTO_MENSUAL_CREATE', descripcion: 'Cargar facturas y sustentos mensuales' },
  { codigoPermiso: 'DOCUMENTO_MENSUAL_UPDATE', descripcion: 'Editar periodo y nota' },
  { codigoPermiso: 'DOCUMENTO_MENSUAL_DELETE', descripcion: 'Eliminar documentos mensuales' },
  { codigoPermiso: 'DOCUMENTO_MENSUAL_EXPORT', descripcion: 'Descargar PDF combinado' },
  { codigoPermiso: 'FACTURA_CREATE', descripcion: 'Registrar facturas individualmente' },
  { codigoPermiso: 'FACTURA_UPDATE', descripcion: 'Editar datos de facturas con historial' },
  { codigoPermiso: 'FACTURA_READ', descripcion: 'Ver facturas y su documentación' },
  { codigoPermiso: 'DOCUMENTO_UPLOAD', descripcion: 'Cargar documentación de respaldo' },
  { codigoPermiso: 'DOCUMENTO_DELETE', descripcion: 'Eliminar documentación de respaldo' },
  { codigoPermiso: 'PAGO_REGISTRAR', descripcion: 'Registrar pagos de facturas' },
  { codigoPermiso: 'PAGO_READ', descripcion: 'Ver pagos registrados' },
  { codigoPermiso: 'PAGO_UPDATE', descripcion: 'Editar pagos registrados' },
  { codigoPermiso: 'PAGO_DELETE', descripcion: 'Eliminar pagos registrados' },
  { codigoPermiso: 'OBSERVACION_WRITE', descripcion: 'Crear y atender observaciones' },
  { codigoPermiso: 'OBSERVACION_READ', descripcion: 'Ver observaciones' },
  { codigoPermiso: 'USUARIO_MANAGE', descripcion: 'Crear y gestionar usuarios internos' },
  { codigoPermiso: 'ROL_MANAGE', descripcion: 'Crear y gestionar roles y permisos' },
  { codigoPermiso: 'CONTADOR_INVITE', descripcion: 'Invitar y revocar acceso a contadores externos' },
  { codigoPermiso: 'FACTURA_EXPORT_EXCEL', descripcion: 'Exportar las facturas de la empresa a Excel' },
  { codigoPermiso: 'FACTURA_EXPORT_ZIP', descripcion: 'Exportar las facturas de la empresa a ZIP (Excel + documentos)' },
  { codigoPermiso: 'DOCUMENTO_EMPRESA_MANAGE', descripcion: 'Ver y gestionar los documentos de la empresa (préstamos, estados de cuenta, leasing, etc.)' },
];

async function seedPermisos() {
  for (const p of permisosSeed) {
    await db.insert(permiso).values(p).onConflictDoNothing();
  }

  // Eliminar permisos que ya no forman parte de la lista canónica
  const codigosCanonicos = permisosSeed.map((p) => p.codigoPermiso);
  const permisosDb = await db.select().from(permiso);
  for (const p of permisosDb) {
    if (!codigosCanonicos.includes(p.codigoPermiso)) {
      await db.delete(rolPermiso).where(eq(rolPermiso.permisoId, p.id));
      await db.delete(permiso).where(eq(permiso.id, p.id));
      console.log(`Permiso obsoleto eliminado: ${p.codigoPermiso}`);
    }
  }
}

// Garantiza que el superadmin de plataforma siempre exista. Idempotente: no duplica
// ni sobrescribe si ya está. Se autentica por Google (sin passwordHash).
async function seedSuperadmin() {
  const existe = await db
    .select()
    .from(usuario)
    .where(eq(usuario.email, SUPERADMIN_EMAIL));

  if (existe.length === 0) {
    await db.insert(usuario).values({
      email: SUPERADMIN_EMAIL,
      nombreCompleto: SUPERADMIN_NOMBRE,
      tipoUsuario: 'SUPERADMIN',
      esSuperadminPrincipal: true,
    });
    console.log(`Superadmin creado: ${SUPERADMIN_EMAIL}`);
  } else {
    // Garantiza el flag de principal aunque la fila venga de un seed anterior
    if (!existe[0].esSuperadminPrincipal) {
      await db.update(usuario)
        .set({ esSuperadminPrincipal: true })
        .where(eq(usuario.email, SUPERADMIN_EMAIL));
    }
    console.log(`Superadmin ya existe: ${SUPERADMIN_EMAIL}`);
  }
}

async function runSeed() {
  console.log('Running seed...');
  await seedPermisos();
  await seedSuperadmin();
  console.log('Seed finished successfully.');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seed failed!', err);
  process.exit(1);
});
