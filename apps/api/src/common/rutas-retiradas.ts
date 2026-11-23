export function rutaContableRetirada(ruta: string): boolean {
  return /^\/(?:facturas|pagos|proveedores)(?:\/|$)/.test(ruta)
    || /^\/contador\/empresas\/[^/]+\/(?:facturas|importar|importaciones|exportar)(?:\/|$)/.test(ruta);
}
