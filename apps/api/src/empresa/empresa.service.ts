import { Injectable, NotFoundException } from '@nestjs/common';
import { db, empresa } from '@audivare/database';
import { eq } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';

@Injectable()
export class EmpresaService {
  constructor(private readonly permisosService: PermisosService) {}

  async getEmpresa(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const res = await db.select().from(empresa).where(eq(empresa.id, empresaId));
    
    if (!res.length) throw new NotFoundException('Empresa no encontrada');
    
    const e = res[0];
    return {
      id: e.id,
      email_registro: e.emailRegistro,
      ruc: e.ruc,
      razon_social: e.razonSocial,
      plan_suscripcion: e.planSuscripcion,
      estado_suscripcion: e.estadoSuscripcion,
      limite_usuarios: e.limiteUsuarios,
      fecha_creacion: e.fechaCreacion,
      prueba_hasta: e.pruebaHasta,
      en_prueba: (await this.permisosService.getAccesoEmpresa(empresaId)).prueba,
    };
  }

  // El email de registro no es editable: es el Gmail con el que se creó la empresa (identidad de Google)
  async updateEmpresa(userId: string, data: { razon_social?: string }) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const updateData: Partial<typeof empresa.$inferInsert> = {};
    if (data.razon_social) updateData.razonSocial = data.razon_social;

    if (Object.keys(updateData).length > 0) {
      await db.update(empresa).set(updateData).where(eq(empresa.id, empresaId));
    }
    
    return this.getEmpresa(userId);
  }
}
