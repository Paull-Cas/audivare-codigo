'use client';
import { useState } from 'react';

/**
 * Selector de Año + Mes para los filtros. El mes solo aparece una vez elegido
 * el año (flujo: primero año, luego mes). Se usa dentro de un form GET normal:
 * los selects conservan name="anio"/name="mes" y se envían con el resto del form.
 * Al limpiar el año, el select de mes se desmonta y deja de enviarse.
 */
const MESES = [
  { v: '1', n: 'Enero' }, { v: '2', n: 'Febrero' }, { v: '3', n: 'Marzo' },
  { v: '4', n: 'Abril' }, { v: '5', n: 'Mayo' }, { v: '6', n: 'Junio' },
  { v: '7', n: 'Julio' }, { v: '8', n: 'Agosto' }, { v: '9', n: 'Septiembre' },
  { v: '10', n: 'Octubre' }, { v: '11', n: 'Noviembre' }, { v: '12', n: 'Diciembre' },
];

interface Props {
  anios: string[];
  defaultAnio?: string;
  defaultMes?: string;
  wrapAnioClass?: string;
  wrapMesClass?: string;
  selectAnioClass?: string;
  selectMesClass?: string;
}

export default function SelectorAnioMes({
  anios,
  defaultAnio,
  defaultMes,
  wrapAnioClass = '',
  wrapMesClass = '',
  selectAnioClass = '',
  selectMesClass = '',
}: Props) {
  const [anio, setAnio] = useState(defaultAnio || '');

  return (
    <>
      <div className={wrapAnioClass}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Año</label>
        <select
          name="anio"
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          className={selectAnioClass}
        >
          <option value="">Todos</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {anio && (
        <div className={wrapMesClass}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mes</label>
          <select name="mes" defaultValue={defaultMes || ''} className={selectMesClass}>
            <option value="">Todos</option>
            {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
