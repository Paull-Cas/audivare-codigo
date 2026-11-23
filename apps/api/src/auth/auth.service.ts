import { Injectable, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SesionesService } from './sesiones.service';
import { db, usuario, empresa, rol, usuarioInternoEmpresa, rolPermiso, permiso } from '@audivare/database';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginDto, GoogleRegistroDto } from './google-auth.dto';
import { formatearNombrePropio } from '../common/nombre.util';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { HORAS_PRUEBA } from '../common/acceso-empresa.util';
import { getGoogleClientId } from '../common/config';
import { registrarAceptacionLegal, validarAceptacionLegal } from './aceptacion-legal';

const GOOGLE_CLIENT_ID = getGoogleClientId();

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  constructor(
    private sesionesService: SesionesService,
    private notificacionesService: NotificacionesService,
    private permisosService: PermisosService,
  ) {}

  // Verifica el ID token contra las claves públicas de Google (firma, audiencia, expiración)
  private async verificarCredencialGoogle(credential: string): Promise<{ email: string; nombre: string }> {
    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Credencial de Google inválida o expirada');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('La cuenta de Google no tiene un email verificado');
    }

    // Google suele devolver nombres en MAYÚSCULAS: normalizar a "Nombre Propio"
    return { email: payload.email, nombre: payload.name ? formatearNombrePropio(payload.name) : '' };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const identidad = await this.verificarCredencialGoogle(dto.credential);

    const user = await db.select().from(usuario).where(eq(usuario.email, identidad.email));

    if (user.length > 0) {
      const u = user[0];

      // Usuario interno eliminado de su empresa (sin vínculos): se trata como
      // cuenta nueva y vuelve a elegir perfil (Empresa o Contador)
      if (u.tipoUsuario === 'INTERNO') {
        const vinculos = await db.select()
          .from(usuarioInternoEmpresa)
          .where(eq(usuarioInternoEmpresa.usuarioId, u.id));
        if (vinculos.length === 0) {
          return {
            requiere_registro: true,
            google_email: identidad.email,
            google_nombre: identidad.nombre || u.nombreCompleto || '',
          };
        }
      }

      // Usuarios invitados nacen sin nombre: completarlo con el de Google al ingresar
      if (!u.nombreCompleto && identidad.nombre) {
        await db.update(usuario)
          .set({ nombreCompleto: identidad.nombre })
          .where(eq(usuario.id, u.id));
      }

      // El usuario existe, hacer login bypass password
      return this.login(identidad.email, null, true);
    }

    // No existe, requiere registro
    return {
      requiere_registro: true,
      google_email: identidad.email,
      google_nombre: identidad.nombre,
    };
  }

  // Modificamos login para aceptar bypassPassword (para Google Login de usuarios existentes)
  async login(email: string, password: string | null, bypassPassword = false) {
    const userResult = await db
      .select({
        id: usuario.id,
        email: usuario.email,
        passwordHash: usuario.passwordHash,
        nombreCompleto: usuario.nombreCompleto,
        tipoUsuario: usuario.tipoUsuario,
      })
      .from(usuario)
      .where(eq(usuario.email, email));

    if (userResult.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = userResult[0];

    if (!bypassPassword) {
      if (!password || !user.passwordHash) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
    }

    // I6: los permisos NO viajan en el JWT; se consultan desde BD vía GET /perfil/permisos
    if (user.tipoUsuario === 'INTERNO') {
      const uieResult = await db.select()
        .from(usuarioInternoEmpresa)
        .where(eq(usuarioInternoEmpresa.usuarioId, user.id));

      // Usuario eliminado de su empresa: sin vínculo no hay nada que pueda ver
      if (uieResult.length === 0) {
        throw new ForbiddenException(
          'Tu cuenta ya no tiene acceso a ninguna empresa. Pide a un administrador que te invite nuevamente.'
        );
      }

      if (uieResult.length > 0) {
        const uie = uieResult[0];

        if (!uie.estado) {
          throw new ForbiddenException(
            'Tu usuario está desactivado en la empresa. Contacta al administrador.'
          );
        }

        await this.permisosService.checkEmpresaActiva(uie.empresaId);
      }
    }

    return this.sesionesService.crear(user);
  }

  async googleRegistro(dto: GoogleRegistroDto) {
    validarAceptacionLegal(dto);
    if (dto.tipo === 'EMPRESA' && dto.declara_representacion !== true) {
      throw new ForbiddenException('Confirma que puedes representar a la empresa');
    }
    const { tipo, ruc, razon_social } = dto;
    const nombre_completo = formatearNombrePropio(dto.nombre_completo);

    // El email siempre sale de la credencial verificada, nunca del formulario
    const { email } = await this.verificarCredencialGoogle(dto.credential);

    try {
      return await db.transaction(async tx => {
        // Serializa identidades incluso antes de que exista una fila que bloquear.
        const claves = [`registro:email:${email}`, ...(tipo === 'EMPRESA' && ruc ? [`registro:ruc:${ruc}`] : [])].sort();
        for (const clave of claves) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${clave}, 0))`);
        // 1. Validar que el email no exista. Excepción: un usuario interno huérfano
        // (eliminado de su empresa, sin vínculos) se reutiliza como cuenta nueva.
        let usuarioHuerfanoId: string | null = null;
        const userExists = await tx.select().from(usuario).where(eq(usuario.email, email)).for('update');
        if (userExists.length > 0) {
          const u = userExists[0];
          const vinculos = u.tipoUsuario === 'INTERNO'
            ? await tx.select().from(usuarioInternoEmpresa).where(eq(usuarioInternoEmpresa.usuarioId, u.id))
            : [];
          if (u.tipoUsuario === 'INTERNO' && vinculos.length === 0) {
            usuarioHuerfanoId = u.id;
          } else {
            throw new UnauthorizedException('El email ya está registrado');
          }
        }

        if (tipo === 'EMPRESA') {
          if (!ruc || !razon_social) {
            throw new UnauthorizedException('RUC y Razón social son requeridos para empresa');
          }

          // Validar RUC
          const rucExists = await tx.select().from(empresa).where(eq(empresa.ruc, ruc));
          if (rucExists.length > 0) {
            throw new UnauthorizedException('El RUC ya está registrado');
          }

          const fechaCreacion = new Date();
          const pruebaHasta = new Date(fechaCreacion.getTime() + HORAS_PRUEBA * 60 * 60 * 1000);
          const [nuevaEmpresa] = await tx.insert(empresa).values({
            ruc,
            razonSocial: razon_social,
            emailRegistro: email,
            planSuscripcion: 'BASICO',
            estadoSuscripcion: 'ACTIVO',
            fechaCreacion,
            pruebaHasta,
          }).returning();

          // 4. Crear usuario INTERNO (o reutilizar la cuenta huérfana)
          // Sin passwordHash porque se loguea por Google
          let nuevoUsuario: { id: string };
          if (usuarioHuerfanoId) {
            await tx.update(usuario)
              .set({ nombreCompleto: nombre_completo, tipoUsuario: 'INTERNO' })
              .where(eq(usuario.id, usuarioHuerfanoId));
            nuevoUsuario = { id: usuarioHuerfanoId };
          } else {
            const [creado] = await tx.insert(usuario).values({
              email,
              nombreCompleto: nombre_completo,
              tipoUsuario: 'INTERNO',
            }).returning();
            nuevoUsuario = creado;
          }

          // 5. Crear el rol Administrador
          const [nuevoRol] = await tx.insert(rol).values({
            empresaId: nuevaEmpresa.id,
            nombreRol: 'Administrador',
            descripcion: 'Administrador del sistema',
            esInmutable: true,
          }).returning();

          // 6. Asignar todos los permisos al rol
          const permisosDb = await tx.select().from(permiso);
          const permisosToInsert = permisosDb.map(p => ({
            rolId: nuevoRol.id,
            permisoId: p.id,
          }));
          if (permisosToInsert.length > 0) {
            await tx.insert(rolPermiso).values(permisosToInsert);
          }

          // 7. Asociar usuario a la empresa
          await tx.insert(usuarioInternoEmpresa).values({
            empresaId: nuevaEmpresa.id,
            usuarioId: nuevoUsuario.id,
            rolId: nuevoRol.id,
            estado: true,
          });

          // 8. Avisar a los superadmins que gestionan empresas: hay una nueva
          // empresa que inicia su prueba de siete días.
          const superadmins = await this.permisosService.getSuperadminsGestionEmpresa(tx);
          for (const adminId of superadmins) {
            await this.notificacionesService.crearNotificacion(
              adminId,
              'EMPRESA_REGISTRADA_PENDIENTE',
              'Nueva empresa en prueba de siete días',
              `${razon_social} (RUC ${ruc}) inició su prueba de siete días; registra un periodo de servicio para continuar después.`.slice(0, 500),
              { empresa_id: nuevaEmpresa.id, empresa_nombre: razon_social ?? email }, tx,
            );
          }

          const [user] = await tx.select().from(usuario).where(eq(usuario.id, nuevoUsuario.id));
          await registrarAceptacionLegal(tx, user.id, nuevaEmpresa.id, 'REGISTRO');
          return { ...await this.sesionesService.crear(user, tx), prueba_hasta: pruebaHasta.toISOString() };

        } else if (tipo === 'CONTADOR') {
          // 4. Crear usuario CONTADOR_EXTERNO (o reconvertir la cuenta huérfana)
          if (usuarioHuerfanoId) {
            await tx.update(usuario)
              .set({ nombreCompleto: nombre_completo, tipoUsuario: 'CONTADOR_EXTERNO' })
              .where(eq(usuario.id, usuarioHuerfanoId));
          } else {
            await tx.insert(usuario).values({
              email,
              nombreCompleto: nombre_completo,
              tipoUsuario: 'CONTADOR_EXTERNO',
            });
          }

          // Login
          const [user] = await tx.select().from(usuario).where(eq(usuario.email, email));
          await registrarAceptacionLegal(tx, user.id, null, 'REGISTRO');
          return this.sesionesService.crear(user, tx);
        }

        throw new UnauthorizedException('Tipo de usuario no válido');
      });
    } catch (error) {
      // Drizzle puede envolver el error PostgreSQL en cause. No exponer SQL/datos.
      const origen = error instanceof Error && 'cause' in error ? error.cause : error;
      if (typeof origen === 'object' && origen !== null && 'code' in origen && origen.code === '23505') {
        throw new ConflictException('El email o RUC ya está registrado');
      }
      throw error;
    }
  }
}
