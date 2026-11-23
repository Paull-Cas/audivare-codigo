import Link from 'next/link';
import { TERMINOS_AUDIVARE } from '@/config/legal';

export default function ConsentimientoLegal({ empresa = false }: { empresa?: boolean }) {
  return <fieldset className="space-y-3 rounded border p-4 text-sm text-gray-700">
    <legend className="px-1 font-medium">Condiciones de uso · {TERMINOS_AUDIVARE.version}</legend>
    <label className="flex items-start gap-2">
      <input className="mt-1" type="checkbox" name="acepta_terminos" required />
      <span>He leído y acepto los <Link href="/terminos" target="_blank" rel="noopener" className="underline">términos de uso (abre otra pestaña)</Link>.</span>
    </label>
    <label className="flex items-start gap-2">
      <input className="mt-1" type="checkbox" name="privacidad_leida" required />
      <span>He leído la <Link href="/politica-privacidad" target="_blank" rel="noopener" className="underline">política de privacidad (abre otra pestaña)</Link>. Esta lectura no autoriza publicidad ni otros usos opcionales.</span>
    </label>
    {empresa ? <label className="flex items-start gap-2">
      <input className="mt-1" type="checkbox" name="declara_representacion" required />
      <span>Estoy autorizado para representar a la empresa y gestionar su documentación en AudiVare.</span>
    </label> : null}
  </fieldset>;
}
