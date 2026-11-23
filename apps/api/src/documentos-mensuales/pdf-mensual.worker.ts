import { parentPort, workerData } from "node:worker_threads";
import { ensamblarPdf, EntradaPdf } from "./ensamblar-pdf";
void ensamblarPdf(workerData as EntradaPdf[])
  .then((bytes) => parentPort?.postMessage({ bytes }))
  .catch((error: unknown) =>
    parentPort?.postMessage({
      error:
        error instanceof Error ? error.message : "No se pudo generar el PDF",
    }),
  );
