import { db } from './index';
import { rol } from './schema/rol';
import { permiso } from './schema/permiso';
import { rolPermiso } from './schema/rol-permiso';
import { eq } from 'drizzle-orm';

async function fixDb() {
  // Update role 'Admin' to 'Administrador'
  const rolResult = await db.update(rol)
    .set({ nombreRol: 'Administrador' })
    .where(eq(rol.nombreRol, 'Admin'))
    .returning({ id: rol.id });

  let targetRolId: string | undefined;

  if (rolResult.length > 0) {
    targetRolId = rolResult[0].id;
    console.log('Fixed Admin to Administrador');
  } else {
    console.log('Admin role not found, looking for Administrador...');
    const adminRole = await db.select().from(rol).where(eq(rol.nombreRol, 'Administrador'));
    if (adminRole.length > 0) {
      targetRolId = adminRole[0].id;
      console.log('Administrador role found');
    }
  }

  if (targetRolId) {
    // Get all permissions and insert them for the Administrador role
    const permResult = await db.select().from(permiso);
    for (const p of permResult) {
      await db.insert(rolPermiso).values({
        rolId: targetRolId,
        permisoId: p.id
      }).onConflictDoNothing();
    }
    console.log('All permissions added to Administrador role');
  } else {
    console.log('Could not find or fix Administrador role.');
  }

  process.exit(0);
}

fixDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
