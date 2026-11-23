import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import DocumentoEmpresaViewer from '@/components/DocumentoEmpresaViewer';
import MensajesDocEmpresa, { type MensajeDocEmpresa } from '@/components/MensajesDocEmpresa';

interface DocEmpresa {
  id: string;
  titulo: string;
  descripcion: string | null;
  anio: number | null;
  mes: number | null;
  archivoNombreOriginal: string;
  fechaSubida: string;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function periodoTexto(anio: number | null, mes: number | null): string {
  if (!anio) return '—';
  if (mes && mes >= 1 && mes <= 12) return `${MESES[mes - 1]} ${anio}`;
  return String(anio);
}

export default async function ContadorDocumentosEmpresaPage({ params: paramsPromise }: { params: Promise<{ empresaId: string }> }) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return notFound();

  const res = await fetch(
    `${getApiUrl()}/contador/empresas/${params.empresaId}/documentos-empresa`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );

  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return notFound();
    return <div className="p-8 text-red-600 bg-red-50 rounded-md">Error cargando documentos ({res.status}).</div>;
  }

  const { data } = (await res.json()) as { data: DocEmpresa[] };

  // Hilo de solicitudes/mensajes con la empresa.
  const resMsg = await fetch(
    `${getApiUrl()}/contador/empresas/${params.empresaId}/documentos-empresa/mensajes`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  const mensajes: MensajeDocEmpresa[] = resMsg.ok ? ((await resMsg.json()) as { data: MensajeDocEmpresa[] }).data : [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <Link href="/contador/dashboard" className="text-[var(--color-primary)] hover:underline flex items-center font-medium text-sm">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Volver a mis empresas
      </Link>

      <PageHeader
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        title="Documentos de la empresa"
        subtitle="Documentación financiera cargada por la empresa: cronograma de préstamos, estados de cuenta bancario, contratos Leasing, etc."
      />

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-gray-50/60 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Periodo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Archivo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subido</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">La empresa aún no ha cargado documentos</td></tr>
              ) : (
                data.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--color-text)]">{d.titulo}</div>
                      {d.descripcion && <div className="text-xs text-gray-500 mt-0.5 max-w-md">{d.descripcion}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{periodoTexto(d.anio, d.mes)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate" title={d.archivoNombreOriginal}>{d.archivoNombreOriginal}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(d.fechaSubida).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <DocumentoEmpresaViewer
                          descargarPath={`/contador/empresas/${params.empresaId}/documentos-empresa/${d.id}/descargar`}
                          nombreArchivo={d.archivoNombreOriginal}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MensajesDocEmpresa
        mensajes={mensajes}
        basePath={`/contador/empresas/${params.empresaId}/documentos-empresa/mensajes`}
        soyContador={true}
      />
    </div>
  );
}
