import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://audivare.com'),
  title: 'AudiVare | Gestión documental para empresas y contadores',
  description: 'Carga facturas y sustentos por año y mes. AudiVare conecta empresas y contadores en Perú para organizar sus documentos y descargarlos en un PDF de consulta.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
