import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export interface EntradaPdf {
  nombre: string;
  mime: string;
  bytes: Uint8Array;
}
export async function ensamblarPdf(
  entradas: EntradaPdf[],
): Promise<Uint8Array> {
  if (
    !entradas.length ||
    entradas.length > 100 ||
    entradas.reduce((s, e) => s + e.bytes.length, 0) > 50 * 1024 * 1024
  )
    throw new Error("La selección supera el límite de descarga");
  const salida = await PDFDocument.create();
  salida.setTitle("Documentos mensuales AudiVare");
  for (const entrada of entradas) {
    try {
      if (entrada.mime === "application/pdf") {
        const doc = await PDFDocument.load(entrada.bytes, {
          ignoreEncryption: false,
          throwOnInvalidObject: true,
        });
        if (
          doc.isEncrypted ||
          !doc.getPageCount() ||
          doc.getPageCount() + salida.getPageCount() > 500
        )
          throw new Error();
        const paginas = await salida.copyPages(doc, doc.getPageIndices());
        for (const pagina of paginas) salida.addPage(pagina);
      } else if (["image/png", "image/jpeg"].includes(entrada.mime)) {
        if (salida.getPageCount() >= 500) throw new Error();
        const jpeg = await sharp(Buffer.from(entrada.bytes), {
          limitInputPixels: 20000000,
          failOn: "warning",
        })
          .rotate()
          .resize({
            width: 2480,
            height: 3508,
            fit: "inside",
            withoutEnlargement: true,
          })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 90 })
          .toBuffer();
        const imagen = await salida.embedJpg(jpeg);
        const horizontal = imagen.width > imagen.height;
        const pagina = salida.addPage(horizontal ? [842, 595] : [595, 842]);
        const { width, height } = pagina.getSize();
        const escala = Math.min(
          (width - 40) / imagen.width,
          (height - 40) / imagen.height,
        );
        pagina.drawImage(imagen, {
          x: (width - imagen.width * escala) / 2,
          y: (height - imagen.height * escala) / 2,
          width: imagen.width * escala,
          height: imagen.height * escala,
        });
      } else throw new Error();
    } catch {
      throw new Error(
        `No se pudo incorporar «${entrada.nombre}». Revisa el archivo; no se entregó un PDF incompleto.`,
      );
    }
  }
  const bytes = await salida.save();
  if (bytes.length > 60 * 1024 * 1024)
    throw new Error("El PDF supera 60 MB. Selecciona menos categorías.");
  return bytes;
}
