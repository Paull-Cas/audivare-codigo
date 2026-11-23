/**
 * Normaliza un nombre propio a formato título: "RENZO CASTAÑEDA" → "Renzo Castañeda".
 * Los conectores habituales de nombres en español quedan en minúscula
 * ("María DE LOS Ángeles" → "María de los Ángeles"), salvo al inicio.
 */
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von']);

export function formatearNombrePropio(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((palabra, i) => {
      if (i > 0 && CONECTORES.has(palabra)) return palabra;
      return palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1);
    })
    .join(' ');
}
