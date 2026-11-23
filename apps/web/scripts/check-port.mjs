// Evita el bug del "Next fantasma": si el 3000 está ocupado, `next dev` no falla,
// se muda silenciosamente al 3001 (el puerto de la API) y todo empieza a dar 404.
// Este check hace que `pnpm --filter web dev` falle con un mensaje claro en su lugar.
import net from 'node:net';

const PORT = 3000;

function puertoLibre(host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(PORT, host);
  });
}

const libreIPv4 = await puertoLibre('0.0.0.0');
const libreIPv6 = await puertoLibre('::');

if (!libreIPv4 || !libreIPv6) {
  console.error(`
✖ El puerto ${PORT} ya está ocupado: seguramente hay otro "next dev" corriendo
  (quizá de una terminal que cerraste sin Ctrl+C).

  NO se levantó un segundo servidor, porque Next se movería al 3001 (el puerto
  de la API) y todo daría 404.

  Para ver y matar el proceso que ocupa el ${PORT}, en PowerShell:

    Get-NetTCPConnection -LocalPort ${PORT} -State Listen |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

  Y vuelve a correr: pnpm --filter web dev
`);
  process.exit(1);
}
