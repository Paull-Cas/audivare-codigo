import { Injectable } from '@nestjs/common';
import { db, factura, pagoFactura, observacion, relacionEmpresaContador, invitacionContador } from '@audivare/database';
import { eq, and, sql } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';

@Injectable()
export class DashboardService {
  constructor(private readonly permisosService: PermisosService) {}

  async getResumen(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    // 1. Facturas activas
    const facturasActivasResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(factura)
      .where(and(eq(factura.empresaId, empresaId), eq(factura.estadoFactura, 'ACTIVA')));
    const facturas_activas = Number(facturasActivasResult[0]?.count || 0);

    // 2. Facturas con documentación pendiente
    const pendientesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(factura)
      .where(
        and(
          eq(factura.empresaId, empresaId),
          eq(factura.documentacionEstado, 'PENDIENTE')
        )
      );
    const documentacion_pendiente = Number(pendientesResult[0]?.count || 0);

    // 3. Pagos registrados en el mes actual (por fecha de registro), por moneda de la factura
    const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
    const pagosResult = await db
      .select({
        sum_pen: sql<number>`COALESCE(SUM(CAST(${pagoFactura.montoPagado} AS NUMERIC)) FILTER (WHERE ${factura.moneda} = 'PEN'), 0)`,
        sum_usd: sql<number>`COALESCE(SUM(CAST(${pagoFactura.montoPagado} AS NUMERIC)) FILTER (WHERE ${factura.moneda} = 'USD'), 0)`,
      })
      .from(pagoFactura)
      .innerJoin(factura, eq(pagoFactura.facturaId, factura.id))
      .where(
        and(
          eq(factura.empresaId, empresaId),
          sql`to_char(${pagoFactura.fechaRegistro}, 'YYYY-MM') = ${currentMonthStr}`
        )
      );
    const pagos_del_mes = Number(pagosResult[0]?.sum_pen || 0);
    const pagos_del_mes_usd = Number(pagosResult[0]?.sum_usd || 0);

    // 4. Observaciones pendientes (tipo = 'EXTERNA' y atendida = false)
    const observacionesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(observacion)
      .innerJoin(factura, eq(observacion.facturaId, factura.id))
      .where(
        and(
          eq(factura.empresaId, empresaId),
          eq(observacion.tipo, 'EXTERNA'),
          eq(observacion.atendida, false)
        )
      );
    const observaciones_pendientes = Number(observacionesResult[0]?.count || 0);

    return {
      facturas_activas,
      documentacion_pendiente,
      pagos_del_mes,
      pagos_del_mes_usd,
      observaciones_pendientes
    };
  }

  /** Estado para la guía "Primeros pasos" de la empresa (flujo de primera sesión). */
  async getOnboarding(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const [contadorRows, invRows, facturaRows] = await Promise.all([
      db.select({ c: sql<number>`count(*)` })
        .from(relacionEmpresaContador)
        .where(eq(relacionEmpresaContador.empresaId, empresaId)),
      db.select({ c: sql<number>`count(*)` })
        .from(invitacionContador)
        .where(and(
          eq(invitacionContador.empresaId, empresaId),
          eq(invitacionContador.estadoInvitacion, 'PENDIENTE'),
        )),
      db.select({ c: sql<number>`count(*)` })
        .from(factura)
        .where(eq(factura.empresaId, empresaId)),
    ]);

    return {
      tiene_contador: Number(contadorRows[0]?.c || 0) > 0,
      invitacion_pendiente: Number(invRows[0]?.c || 0) > 0,
      total_facturas: Number(facturaRows[0]?.c || 0),
    };
  }
}
