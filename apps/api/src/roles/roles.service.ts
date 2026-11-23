import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { db, rol, rolPermiso, permiso, usuarioInternoEmpresa } from '@audivare/database';
import { eq, and } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';

@Injectable()
export class RolesService {
  constructor(private readonly permisosService: PermisosService) {}

  async getRoles(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    
    const rolesDb = await db.select().from(rol).where(eq(rol.empresaId, empresaId));
    
    const result = [];
    for (const r of rolesDb) {
      const permisosDb = await db
        .select({ codigo: permiso.codigoPermiso })
        .from(rolPermiso)
        .innerJoin(permiso, eq(rolPermiso.permisoId, permiso.id))
        .where(eq(rolPermiso.rolId, r.id));
      
      result.push({
        id: r.id,
        nombre_rol: r.nombreRol,
        descripcion: r.descripcion,
        es_inmutable: r.esInmutable,
        permisos: permisosDb.map(p => p.codigo),
      });
    }

    return { data: result };
  }

  async createRol(userId: string, payload: { nombre_rol: string, descripcion?: string, permisos: string[] }) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    if (payload.nombre_rol === 'Administrador') {
      throw new BadRequestException('No se puede crear un rol con el nombre Administrador');
    }

    return await db.transaction(async (tx) => {
      // 1. Validar que los permisos existan
      const permisosDb = await tx.select().from(permiso);
      const codigosValidos = permisosDb.map(p => p.codigoPermiso);
      
      for (const p of payload.permisos) {
        if (!codigosValidos.includes(p)) {
          throw new BadRequestException(`El permiso ${p} no existe`);
        }
      }

      // 2. Crear rol
      const newRol = await tx.insert(rol).values({
        empresaId,
        nombreRol: payload.nombre_rol,
        descripcion: payload.descripcion,
      }).returning({ id: rol.id });
      
      const rolId = newRol[0].id;

      // 3. Asignar permisos
      for (const codigo of payload.permisos) {
        const permisoObj = permisosDb.find(p => p.codigoPermiso === codigo);
        if (permisoObj) {
          await tx.insert(rolPermiso).values({
            rolId,
            permisoId: permisoObj.id,
          });
        }
      }

      return { message: 'Rol creado exitosamente' };
    });
  }

  async updateRol(userId: string, rolId: string, payload: { nombre_rol: string, descripcion?: string, permisos: string[] }) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const rolTarget = await db.select().from(rol).where(and(eq(rol.id, rolId), eq(rol.empresaId, empresaId)));
    if (rolTarget.length === 0) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (rolTarget[0].esInmutable) {
      throw new BadRequestException('El rol Administrador es inmutable y no se puede editar');
    }

    if (payload.nombre_rol === 'Administrador') {
        throw new BadRequestException('No se puede renombrar un rol a Administrador');
    }

    return await db.transaction(async (tx) => {
      // 1. Validar que los permisos existan
      const permisosDb = await tx.select().from(permiso);
      const codigosValidos = permisosDb.map(p => p.codigoPermiso);
      
      for (const p of payload.permisos) {
        if (!codigosValidos.includes(p)) {
          throw new BadRequestException(`El permiso ${p} no existe`);
        }
      }

      // 2. Actualizar rol
      await tx.update(rol)
        .set({
          nombreRol: payload.nombre_rol,
          descripcion: payload.descripcion,
        })
        .where(eq(rol.id, rolId));

      // 3. Eliminar permisos anteriores y recrearlos
      await tx.delete(rolPermiso).where(eq(rolPermiso.rolId, rolId));

      for (const codigo of payload.permisos) {
        const permisoObj = permisosDb.find(p => p.codigoPermiso === codigo);
        if (permisoObj) {
          await tx.insert(rolPermiso).values({
            rolId,
            permisoId: permisoObj.id,
          });
        }
      }

      return { message: 'Rol actualizado exitosamente' };
    });
  }

  async deleteRol(userId: string, rolId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const rolTarget = await db.select().from(rol).where(and(eq(rol.id, rolId), eq(rol.empresaId, empresaId)));
    if (rolTarget.length === 0) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (rolTarget[0].esInmutable) {
      throw new BadRequestException('El rol Administrador es inmutable y no se puede eliminar');
    }

    const usuariosConRol = await db.select().from(usuarioInternoEmpresa).where(eq(usuarioInternoEmpresa.rolId, rolId));
    if (usuariosConRol.length > 0) {
      throw new BadRequestException('El rol tiene usuarios asignados, reasígnalos antes de eliminar');
    }

    await db.delete(rol).where(eq(rol.id, rolId));

    return { message: 'Rol eliminado exitosamente' };
  }
}
