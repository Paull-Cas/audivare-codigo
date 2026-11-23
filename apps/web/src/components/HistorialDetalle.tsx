const campos = new Map<string, string>(Object.entries({
  proveedorNombre: 'Proveedor', proveedorRuc: 'RUC del proveedor', tipoComprobante: 'Tipo de comprobante',
  serie: 'Serie', numero: 'Número', moneda: 'Moneda', fechaEmision: 'Fecha de emisión',
  montoTotal: 'Total', baseImponible: 'Base imponible', igv: 'IGV',
}));

type Valor = string | number | boolean | null;
type Cambio = { campo: string; antes: Valor; despues: Valor };
const esValor = (valor: unknown): valor is Valor =>
  valor === null || ['string', 'number', 'boolean'].includes(typeof valor);
const esCambio = (valor: unknown): valor is Cambio =>
  valor !== null && typeof valor === 'object' && 'campo' in valor && typeof valor.campo === 'string' &&
  'antes' in valor && esValor(valor.antes) && 'despues' in valor && esValor(valor.despues);

export default function HistorialDetalle({ evento, detalle }: { evento: string; detalle: string }) {
  // Las descripciones de documentos son texto libre, incluso si contienen JSON.
  const estructurado = evento === 'Datos de factura editados' || evento === 'Factura registrada individualmente';
  if (estructurado) {
    try {
      const datos: unknown = JSON.parse(detalle);
      if (datos && typeof datos === 'object' && 'autor' in datos && typeof datos.autor === 'string' && 'cambios' in datos) {
        const cambios = datos.cambios;
        const edicion = evento === 'Datos de factura editados';
        if (edicion && (!Array.isArray(cambios) || !cambios.every(esCambio))) {
          return <p className="text-sm text-gray-500 mt-1">{detalle}</p>;
        }
        return <div className="text-sm text-gray-600 mt-1">
          <p>Autor: {datos.autor}</p>
          {edicion && Array.isArray(cambios) && <ul className="mt-1 space-y-1">{cambios.map((c: Cambio, i: number) =>
            <li key={i}>{campos.get(c.campo) ?? c.campo}: {String(c.antes ?? 'Sin dato')} → {String(c.despues ?? 'Sin dato')}</li>)}</ul>}
        </div>;
      }
    } catch { /* Los eventos anteriores utilizan texto libre. */ }
  }
  return <p className="text-sm text-gray-500 mt-1">{detalle}</p>;
}
