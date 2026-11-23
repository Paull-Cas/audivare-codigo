import { BadRequestException, Injectable } from "@nestjs/common";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import {
  DocumentosMensualesService,
  ActorMensual,
} from "./documentos-mensuales.service";
import { EntradaPdf } from "./ensamblar-pdf";
import {
  CupoTrabajo,
  controlarFrecuenciaTrabajo,
} from "../common/limites-trabajo";
const cupo = new CupoTrabajo(1);

@Injectable()
export class PdfMensualService {
  constructor(private readonly documentos: DocumentosMensualesService) {}
  async exportar(
    actor: ActorMensual,
    anio: unknown,
    mes: unknown,
    categorias: unknown,
    empresa?: string,
  ) {
    const liberar = cupo.adquirir();
    try {
      const {
        docs,
        empresaId,
        anio: a,
        mes: m,
      } = await this.documentos.documentosExport(
        actor,
        anio,
        mes,
        categorias,
        empresa,
      );
      controlarFrecuenciaTrabajo("exportacion", empresaId);
      const entradas: EntradaPdf[] = [];
      for (const doc of docs) {
        const stream = await this.documentos.storage.getObjectStream(
          doc.archivoPath,
        );
        const timer = setTimeout(
          () => stream.destroy(new Error("Tiempo de lectura excedido")),
          15000,
        );
        try {
          let total = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            const bytes = Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk as Uint8Array);
            total += bytes.length;
            if (total > doc.archivoBytes || total > 10 * 1024 * 1024)
              throw new Error();
            chunks.push(bytes);
          }
          if (total !== doc.archivoBytes) throw new Error();
          entradas.push({
            nombre: doc.archivoNombre,
            mime: doc.archivoMime,
            bytes: Buffer.concat(chunks),
          });
        } catch {
          throw new BadRequestException(
            `No se pudo leer «${doc.archivoNombre}». Intenta nuevamente; no se entregó un PDF incompleto.`,
          );
        } finally {
          clearTimeout(timer);
          stream.destroy();
        }
      }
      const bytes = await new Promise<Buffer>((resolve, reject) => {
        const worker = new Worker(join(__dirname, "pdf-mensual.worker.js"), {
          workerData: entradas,
          resourceLimits: {
            maxOldGenerationSizeMb: 192,
            maxYoungGenerationSizeMb: 16,
          },
        });
        let finalizado = false;
        const terminar = (error?: string, salida?: Uint8Array) => {
          if (finalizado) return;
          finalizado = true;
          clearTimeout(timer);
          void worker.terminate();
          if (error || !salida)
            reject(
              new BadRequestException(error || "No se pudo generar el PDF"),
            );
          else resolve(Buffer.from(salida));
        };
        const timer = setTimeout(
          () =>
            terminar(
              "La descarga tardó demasiado. Selecciona menos categorías.",
            ),
          30000,
        );
        worker.on("message", (result: { bytes?: Uint8Array; error?: string }) =>
          terminar(result.error, result.bytes),
        );
        worker.on("error", () =>
          terminar("No se pudo generar el PDF. Selecciona menos categorías."),
        );
        worker.on("exit", () => {
          if (!finalizado) terminar("No se pudo generar el PDF");
        });
      });
      await this.documentos.revalidarExport(actor, docs, empresaId);
      return {
        bytes,
        nombre: `audivare-${a}-${String(m).padStart(2, "0")}.pdf`,
      };
    } finally {
      liberar();
    }
  }
}
