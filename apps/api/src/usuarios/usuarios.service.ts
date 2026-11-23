import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db, usuario, usuarioInternoEmpresa, rol, empresa } from '@audivare/database';
import { eq, and, count } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';
import { formatearNombrePropio } from '../common/nombre.util';
import { validarEmailConDominio } from '../common/email.util';

@Injectable()
export class UsuariosService {
  constructor(private readonly permisosService: PermisosService) {}

  async getUsuarios(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const usuarios = await db
      .select({
        id: usuario.id,
        nombre_completo: usuario.nombreCompleto,
        email: usuario.email,
        rol: rol.nombreRol,
        rolId: rol.id,
        estado: usuarioInternoEmpresa.estado,
      })
      .from(usuarioInternoEmpresa)
      .innerJoin(usuario, eq(usuarioInternoEmpresa.usuarioId, usuario.id))
      .innerJoin(rol, eq(usuarioInternoEmpresa.rolId, rol.id))
      .where(eq(usuarioInternoEmpresa.empresaId, empresaId));

    return { data: usuarios };
  }

  async getRoles(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const roles = await db.select({
      id: rol.id,
      nombre: rol.nombreRol,
    }).from(rol).where(eq(rol.empresaId, empresaId));
    return { data: roles };
  }

  async invitarUsuario(userId: string, emailCrudo: string, rolId: string) {
    const email = await validarEmailConDominio(emailCrudo);

    const empresaId = await this.permisosService.getEmpresaId(userId);
    // 1. Verificar que el rol pertenece a la empresa
    const rolInfo = await db.select().from(rol).where(and(eq(rol.id, rolId), eq(rol.empresaId, empresaId)));
    if (rolInfo.length === 0) {
      throw new BadRequestException('El rol especificado no pertenece a la empresa');
    }

    return await db.transaction(async (tx) => {
      // Límite de usuarios por empresa (lo fija el superadmin): cuenta todos los
      // vínculos, activos o no, incluido el administrador
      const empresaInfo = await tx
        .select({ limiteUsuarios: empresa.limiteUsuarios })
        .from(empresa)
        .where(eq(empresa.id, empresaId));
      const vinculos = await tx
        .select({ c: count() })
        .from(usuarioInternoEmpresa)
        .where(eq(usuarioInternoEmpresa.empresaId, empresaId));

      if (empresaInfo.length && vinculos[0].c >= empresaInfo[0].limiteUsuarios) {
        throw new BadRequestException(
          `La empresa alcanzó su límite de ${empresaInfo[0].limiteUsuarios} usuarios. Contacta al administrador de la plataforma para ampliarlo.`
        );
      }

      // Verificar si el usuario ya existe
      let user = await tx.select().from(usuario).where(eq(usuario.email, email));
      let invitedUserId: string;

      if (user.length > 0 && user[0].tipoUsuario === 'SUPERADMIN') {
        throw new BadRequestException('No se puede invitar a un Superadmin');
      }

      if (user.length > 0 && user[0].tipoUsuario === 'CONTADOR_EXTERNO') {
        throw new BadRequestException('Este email pertenece a un contador externo y no puede ser usuario interno');
      }

      if (user.length === 0) {
        // Crear usuario
        const newUser = await tx.insert(usuario).values({
          email,
          tipoUsuario: 'INTERNO',
        }).returning({ id: usuario.id });
        invitedUserId = newUser[0].id;
      } else {
        invitedUserId = user[0].id;

        // M3: el sistema no soporta usuarios multi-empresa; un vínculo existente
        // con cualquier empresa bloquea la invitación
        const links = await tx.select().from(usuarioInternoEmpresa).where(
          eq(usuarioInternoEmpresa.usuarioId, invitedUserId)
        );

        if (links.some(l => l.empresaId === empresaId)) {
          throw new ConflictException('El usuario ya está vinculado a esta empresa');
        }

        if (links.length > 0) {
          throw new BadRequestException('Este usuario ya pertenece a otra empresa');
        }
      }

      // Crear vinculo
      await tx.insert(usuarioInternoEmpresa).values({
        empresaId,
        usuarioId: invitedUserId,
        rolId,
        estado: true,
      });

      return { message: 'Usuario invitado exitosamente' };
    });
  }

  /** Lanza 403 si el vínculo objetivo tiene el rol Administrador (inmutable). */
  private async assertNoEsAdministrador(rolId: string) {
    const rolInfo = await db.select({ esInmutable: rol.esInmutable }).from(rol).where(eq(rol.id, rolId));
    if (rolInfo.length && rolInfo[0].esInmutable) {
      throw new ForbiddenException('No se puede operar sobre un usuario con rol Administrador');
    }
  }

  async updateEstado(userId: string, usuarioId: string, estado: boolean) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    if (usuarioId === userId && estado === false) {
      throw new BadRequestException('No puedes desactivarte a ti mismo');
    }

    const link = await db.select().from(usuarioInternoEmpresa).where(
      and(
        eq(usuarioInternoEmpresa.empresaId, empresaId),
        eq(usuarioInternoEmpresa.usuarioId, usuarioId)
      )
    );

    if (link.length === 0) {
      throw new NotFoundException('Usuario no encontrado en la empresa');
    }

    await this.assertNoEsAdministrador(link[0].rolId);

    // Activar no puede superar el límite de la empresa (usuarios activos)
    if (estado === true && !link[0].estado) {
      const empresaInfo = await db
        .select({ limiteUsuarios: empresa.limiteUsuarios })
        .from(empresa)
        .where(eq(empresa.id, empresaId));
      const activos = await db
        .select({ c: count() })
        .from(usuarioInternoEmpresa)
        .where(and(
          eq(usuarioInternoEmpresa.empresaId, empresaId),
          eq(usuarioInternoEmpresa.estado, true)
        ));

      if (empresaInfo.length && activos[0].c >= empresaInfo[0].limiteUsuarios) {
        throw new BadRequestException(
          `No puedes activar más usuarios: la empresa alcanzó su límite de ${empresaInfo[0].limiteUsuarios} usuarios activos. Contacta al administrador de la plataforma para ampliarlo.`
        );
      }
    }

    await db.update(usuarioInternoEmpresa)
      .set({ estado })
      .where(
        and(
          eq(usuarioInternoEmpresa.empresaId, empresaId),
          eq(usuarioInternoEmpresa.usuarioId, usuarioId)
        )
      );

    return { message: 'Estado actualizado', estado };
  }
  async updateRol(userId: string, usuarioId: string, rolId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    if (usuarioId === userId) {
      throw new ForbiddenException('No puedes modificar tu propio rol');
    }

    // Validar que el rol exista y pertenezca a la empresa
    const rolInfo = await db.select().from(rol).where(and(eq(rol.id, rolId), eq(rol.empresaId, empresaId)));
    if (rolInfo.length === 0) {
      throw new BadRequestException('El rol especificado no pertenece a la empresa');
    }

    const link = await db.select().from(usuarioInternoEmpresa).where(
      and(
        eq(usuarioInternoEmpresa.empresaId, empresaId),
        eq(usuarioInternoEmpresa.usuarioId, usuarioId)
      )
    );

    if (link.length === 0) {
      throw new NotFoundException('Usuario no encontrado en la empresa');
    }

    await this.assertNoEsAdministrador(link[0].rolId);

    await db.update(usuarioInternoEmpresa)
      .set({ rolId })
      .where(
        and(
          eq(usuarioInternoEmpresa.empresaId, empresaId),
          eq(usuarioInternoEmpresa.usuarioId, usuarioId)
        )
      );

    return { message: 'Rol actualizado correctamente', rolId };
  }

  /**
   * Elimina el vínculo del usuario con la empresa (pierde todo acceso y libera
   * un cupo del límite). La fila de `usuario` se conserva: mantiene íntegras las
   * referencias históricas (observaciones, pagos, historial) y permite re-invitar
   * el mismo email después.
   */
  async eliminarUsuario(userId: string, usuarioId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    if (usuarioId === userId) {
      throw new BadRequestException('No puedes eliminarte a ti mismo');
    }

    const link = await db.select().from(usuarioInternoEmpresa).where(
      and(
        eq(usuarioInternoEmpresa.empresaId, empresaId),
        eq(usuarioInternoEmpresa.usuarioId, usuarioId)
      )
    );

    if (link.length === 0) {
      throw new NotFoundException('Usuario no encontrado en la empresa');
    }

    await this.assertNoEsAdministrador(link[0].rolId);

    await db.delete(usuarioInternoEmpresa).where(
      and(
        eq(usuarioInternoEmpresa.empresaId, empresaId),
        eq(usuarioInternoEmpresa.usuarioId, usuarioId)
      )
    );

    return { message: 'Usuario eliminado de la empresa' };
  }

  async getPerfil(userId: string) {
    const res = await db.select().from(usuario).where(eq(usuario.id, userId));
    if (!res.length) throw new NotFoundException('Usuario no encontrado');
    const u = res[0];
    return {
      id: u.id,
      email: u.email,
      nombre_completo: u.nombreCompleto,
      tipo_usuario: u.tipoUsuario,
      avatar_url: u.avatarUrl,
      fecha_registro: u.fechaRegistro,
    };
  }

  async updatePerfil(userId: string, body: { nombre_completo?: string; avatar_url?: string }) {
    if (!body.nombre_completo && !body.avatar_url) {
      return this.getPerfil(userId);
    }

    const updateData: Partial<typeof usuario.$inferInsert> = {};
    if (body.nombre_completo) updateData.nombreCompleto = formatearNombrePropio(body.nombre_completo);
    if (body.avatar_url !== undefined) updateData.avatarUrl = body.avatar_url;

    await db.update(usuario).set(updateData).where(eq(usuario.id, userId));
    return this.getPerfil(userId);
  }
}
