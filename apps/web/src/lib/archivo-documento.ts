// Extensiones concretas: evita el selector multimedia genérico en navegadores móviles.
export const ACCEPT_DOCUMENTO = '.pdf,.jpg,.jpeg,.png';
export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

export async function validarArchivoDocumento(file: File): Promise<File> {
  if (!file.size) throw new Error('El archivo está vacío. Selecciona una foto o un PDF.');
  if (file.size > MAX_DOCUMENTO_BYTES) throw new Error('El archivo no debe superar 10 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const esperado = extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension || '') ? 'image/jpeg' : null;
  if (!esperado || (file.type && file.type.toLowerCase() !== esperado))
    throw new Error('Solo puedes seleccionar fotos JPG o PNG y documentos PDF. No se admiten audio ni video.');
  const firma = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const correcto = esperado === 'application/pdf'
    ? new TextDecoder().decode(firma).startsWith('%PDF-')
    : esperado === 'image/png'
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => firma[i] === b)
      : firma[0] === 255 && firma[1] === 216 && firma[2] === 255;
  if (!correcto) throw new Error('El contenido no corresponde a una foto JPG/PNG o a un PDF. Selecciona otro archivo.');
  // Algunos selectores móviles omiten el MIME; el servidor vuelve a validar contenido y formato.
  return file.type ? file : new File([file], file.name, {type: esperado, lastModified: file.lastModified});
}
