import { Injectable, NotFoundException } from '@nestjs/common';
import { db, factura } from '@audivare/database';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';

@Injectable()
export class ProveedoresService {
  constructor(private readonly permisosService: PermisosService) {}

  async getProveedores(userId: string, buscar?: string, page = 1, limit = 10) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const baseConditions = [eq(factura.empresaId, empresaId)];
    if (buscar) {
      baseConditions.push(
        or(
          ilike(factura.proveedorNombre, `%${buscar}%`),
          ilike(factura.proveedorRuc, `%${buscar}%`),
        ) as typeof baseConditions[0],
      );
    }

    // Identidad del proveedor: el RUC si existe, si no el nombre (el RUC no es
    // obligatorio). Así un mismo RUC con nombres escritos distinto se agrupa como
    // un solo proveedor, y los proveedores sin RUC se separan por nombre.
    const identificador = sql<string>`coalesce(nullif(trim(${factura.proveedorRuc}), ''), ${factura.proveedorNombre})`;

    // Total de proveedores distintos (grupos) para la paginación.
    const totalResult = await db
      .select({ count: sql<number>`count(distinct ${identificador})::int` })
      .from(factura)
      .where(and(...baseConditions));
    const total = totalResult[0].count;
    // RUC y nombre representativos: los de la factura más reciente del grupo.
    const rucRepresentativo = sql<string | null>`(array_agg(${factura.proveedorRuc} order by ${factura.fechaEmision} desc nulls last))[1]`;
    const nombreRepresentativo = sql<string | null>`(array_agg(${factura.proveedorNombre} order by ${factura.fechaEmision} desc nulls last))[1]`;

    // Use SQL aggregation to get unique providers with metrics
    const result = await db
      .select({
        identificador,
        ruc: rucRepresentativo,
        nombre: nombreRepresentativo,
        total_facturas: sql<number>`count(*)::int`,
        // Sumas separadas por moneda: mezclar soles y dólares no tiene sentido contable
        monto_total_facturado_pen: sql<number>`coalesce(sum(${factura.montoTotal}::numeric) filter (where ${factura.moneda} = 'PEN'), 0)`,
        monto_total_facturado_usd: sql<number>`coalesce(sum(${factura.montoTotal}::numeric) filter (where ${factura.moneda} = 'USD'), 0)`,
        monto_pendiente_pen: sql<number>`coalesce(sum(${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'PEN'), 0)`,
        monto_pendiente_usd: sql<number>`coalesce(sum(${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'USD'), 0)`,
        ultima_factura: sql<string>`max(${factura.fechaEmision})`,
        activa: sql<number>`count(*) filter (where ${factura.estadoFactura} = 'ACTIVA')::int`,
        pagada: sql<number>`count(*) filter (where ${factura.estadoFactura} = 'PAGADA')::int`,
        documentacion_pendiente: sql<number>`count(*) filter (where ${factura.documentacionEstado} = 'PENDIENTE')::int`,
      })
      .from(factura)
      .where(and(...baseConditions))
      .groupBy(identificador)
      .orderBy(nombreRepresentativo)
      .limit(limit)
      .offset((page - 1) * limit);

    const data = result.map((r) => ({
      identificador: r.identificador,
      ruc: r.ruc,
      nombre: r.nombre,
      total_facturas: r.total_facturas,
      monto_total_facturado_pen: Number(r.monto_total_facturado_pen ?? 0),
      monto_total_facturado_usd: Number(r.monto_total_facturado_usd ?? 0),
      monto_pendiente_pen: Number(r.monto_pendiente_pen ?? 0),
      monto_pendiente_usd: Number(r.monto_pendiente_usd ?? 0),
      ultima_factura: r.ultima_factura,
      estados: {
        activa: r.activa,
        pagada: r.pagada,
        documentacion_pendiente: r.documentacion_pendiente,
      },
    }));

    return { data, total, page, limit };
  }

  async getProveedorDetalle(userId: string, identificador: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    // El identificador es el RUC cuando el proveedor lo tiene; si no, es el
    // nombre. Se matchea por RUC para facturas con RUC, y por nombre para las que
    // no tienen RUC. (Se asume que un RUC nunca coincide con un nombre.)
    const identidadCondicion = or(
      // Proveedor con RUC: se matchea por el RUC recortado (igual que la identidad del listado).
      sql`nullif(trim(${factura.proveedorRuc}), '') = ${identificador}`,
      // Proveedor sin RUC: se matchea por nombre.
      and(sql`nullif(trim(${factura.proveedorRuc}), '') is null`, eq(factura.proveedorNombre, identificador)),
    );
    const condiciones = and(eq(factura.empresaId, empresaId), identidadCondicion);

    // Get summary (RUC y nombre representativos: los de la factura más reciente)
    const resumenResult = await db
      .select({
        ruc: sql<string | null>`(array_agg(${factura.proveedorRuc} order by ${factura.fechaEmision} desc nulls last))[1]`,
        nombre: sql<string | null>`(array_agg(${factura.proveedorNombre} order by ${factura.fechaEmision} desc nulls last))[1]`,
        total_facturas: sql<number>`count(*)::int`,
        monto_total_facturado_pen: sql<number>`coalesce(sum(${factura.montoTotal}::numeric) filter (where ${factura.moneda} = 'PEN'), 0)`,
        monto_total_facturado_usd: sql<number>`coalesce(sum(${factura.montoTotal}::numeric) filter (where ${factura.moneda} = 'USD'), 0)`,
        monto_pendiente_pen: sql<number>`coalesce(sum(${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'PEN'), 0)`,
        monto_pendiente_usd: sql<number>`coalesce(sum(${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'USD'), 0)`,
        monto_pagado_pen: sql<number>`coalesce(sum(${factura.montoTotal}::numeric - ${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'PEN'), 0)`,
        monto_pagado_usd: sql<number>`coalesce(sum(${factura.montoTotal}::numeric - ${factura.saldoPendiente}::numeric) filter (where ${factura.moneda} = 'USD'), 0)`,
      })
      .from(factura)
      .where(condiciones);

    if (!resumenResult.length || resumenResult[0].total_facturas === 0) {
      throw new NotFoundException(`No se encontró proveedor "${identificador}"`);
    }

    const r = resumenResult[0];

    // Get all facturas for this proveedor
    const facturas = await db
      .select({
        id: factura.id,
        serie: factura.serie,
        numero: factura.numero,
        moneda: factura.moneda,
        monto_total: factura.montoTotal,
        saldo_pendiente: factura.saldoPendiente,
        estado_factura: factura.estadoFactura,
        fecha_emision: factura.fechaEmision,
      })
      .from(factura)
      .where(condiciones)
      .orderBy(factura.fechaCreacion);

    return {
      ruc: r.ruc,
      nombre: r.nombre,
      resumen: {
        total_facturas: r.total_facturas,
        monto_total_facturado_pen: Number(r.monto_total_facturado_pen ?? 0),
        monto_total_facturado_usd: Number(r.monto_total_facturado_usd ?? 0),
        monto_pagado_pen: Number(r.monto_pagado_pen ?? 0),
        monto_pagado_usd: Number(r.monto_pagado_usd ?? 0),
        monto_pendiente_pen: Number(r.monto_pendiente_pen ?? 0),
        monto_pendiente_usd: Number(r.monto_pendiente_usd ?? 0),
      },
      facturas: facturas.map((f) => ({
        ...f,
        monto_total: Number(f.monto_total),
        saldo_pendiente: Number(f.saldo_pendiente),
      })),
    };
  }
}
