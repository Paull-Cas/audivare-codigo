import { Injectable, NotFoundException } from '@nestjs/common';
import { db, factura, pagoFactura } from '@audivare/database';
import { eq, and, or, ilike, gte, lt, sql, SQL } from 'drizzle-orm';
import { StorageService } from '../storage/storage.service';
import { PermisosService } from '../common/permisos/permisos.service';

/** Rango [desde, hasta) por año (obligatorio) y mes opcional, sobre un timestamp. */
function rangoPorAnioMes(anio?: string, mes?: string): { desde: string; hasta: string } | null {
  if (!anio) return null;
  const y = Number(anio);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (mes) {
    const m = Number(mes);
    if (!Number.isInteger(m) || m < 1 || m > 12) return null;
    const mm = String(m).padStart(2, '0');
    const hasta = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { desde: `${y}-${mm}-01`, hasta };
  }
  return { desde: `${y}-01-01`, hasta: `${y + 1}-01-01` };
}

@Injectable()
export class PagosService {
  constructor(
    private readonly storageService: StorageService,
    private readonly permisosService: PermisosService,
  ) {}

  async getPagos(
    userId: string,
    anio?: string,
    mes?: string,
    proveedor?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const conditions: SQL[] = [eq(factura.empresaId, empresaId)];

    // Filtro por fecha de registro del pago (año obligatorio, mes opcional).
    const rango = rangoPorAnioMes(anio, mes);
    if (rango) {
      conditions.push(gte(pagoFactura.fechaRegistro, new Date(rango.desde)));
      conditions.push(lt(pagoFactura.fechaRegistro, new Date(rango.hasta)));
    }
    if (proveedor) {
      const proveedorCondition = or(
        ilike(factura.proveedorNombre, `%${proveedor}%`),
        ilike(factura.proveedorRuc, `%${proveedor}%`)
      );
      if (proveedorCondition) {
        conditions.push(proveedorCondition);
      }
    }

    const whereClause = and(...conditions);

    const offset = (page - 1) * limit;

    const queryData = await db
      .select({
        id: pagoFactura.id,
        factura_serie: factura.serie,
        factura_numero: factura.numero,
        proveedor_nombre: factura.proveedorNombre,
        proveedor_ruc: factura.proveedorRuc,
        moneda: factura.moneda,
        monto_pagado: pagoFactura.montoPagado,
        tipo_pago: pagoFactura.tipoPago,
        nota: pagoFactura.nota,
        fecha_registro: pagoFactura.fechaRegistro,
        comprobante_nombre: pagoFactura.comprobanteNombre,
        tiene_comprobante: sql<boolean>`${pagoFactura.comprobantePath} IS NOT NULL`,
        factura_id: factura.id,
      })
      .from(pagoFactura)
      .innerJoin(factura, eq(pagoFactura.facturaId, factura.id))
      .where(whereClause)
      // El id como último criterio garantiza un orden único y determinista para el paginado.
      .orderBy(sql`${pagoFactura.fechaRegistro} DESC, ${pagoFactura.id} DESC`)
      .limit(limit)
      .offset(offset);

    // Resumen: los montos se separan por moneda (sumar soles y dólares no tiene sentido contable).
    const summaryResult = await db
      .select({
        total_pagado_pen: sql<number>`COALESCE(SUM(${pagoFactura.montoPagado}) FILTER (WHERE ${factura.moneda} = 'PEN'), 0)::numeric`,
        total_pagado_usd: sql<number>`COALESCE(SUM(${pagoFactura.montoPagado}) FILTER (WHERE ${factura.moneda} = 'USD'), 0)::numeric`,
        total_pagos: sql<number>`COUNT(*)::int`,
        total_pagos_pen: sql<number>`COUNT(*) FILTER (WHERE ${factura.moneda} = 'PEN')::int`,
        total_pagos_usd: sql<number>`COUNT(*) FILTER (WHERE ${factura.moneda} = 'USD')::int`,
      })
      .from(pagoFactura)
      .innerJoin(factura, eq(pagoFactura.facturaId, factura.id))
      .where(whereClause);

    const s = summaryResult[0];

    const data = queryData.map(d => ({
      id: d.id,
      factura_serie: d.factura_serie,
      factura_numero: d.factura_numero,
      factura_id: d.factura_id,
      proveedor_nombre: d.proveedor_nombre,
      proveedor_ruc: d.proveedor_ruc,
      moneda: d.moneda,
      monto_pagado: Number(d.monto_pagado),
      tipo_pago: d.tipo_pago,
      nota: d.nota,
      fecha_registro: d.fecha_registro,
      comprobante_nombre: d.comprobante_nombre,
      tiene_comprobante: d.tiene_comprobante,
    }));

    return {
      data,
      total: s.total_pagos,
      page,
      limit,
      resumen: {
        total_pagado_pen: Number(s.total_pagado_pen),
        total_pagado_usd: Number(s.total_pagado_usd),
        total_pagos: s.total_pagos,
        total_pagos_pen: s.total_pagos_pen,
        total_pagos_usd: s.total_pagos_usd,
      }
    };
  }

  async getComprobanteDownloadUrl(userId: string, pagoId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const result = await db
      .select({
        comprobantePath: pagoFactura.comprobantePath,
        comprobanteNombre: pagoFactura.comprobanteNombre,
      })
      .from(pagoFactura)
      .innerJoin(factura, eq(pagoFactura.facturaId, factura.id))
      .where(and(eq(pagoFactura.id, pagoId), eq(factura.empresaId, empresaId)));

    if (!result.length) {
      throw new NotFoundException('Pago no encontrado o sin acceso');
    }

    if (!result[0].comprobantePath) {
      throw new NotFoundException('El pago no tiene comprobante');
    }

    const url = await this.storageService.getPresignedUrl(result[0].comprobantePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url, nombre: result[0].comprobanteNombre };
  }
}
