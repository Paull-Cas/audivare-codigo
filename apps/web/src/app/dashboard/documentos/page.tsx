import { getApiUrl } from '@/config/api';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import SelectorAnioMes from '@/components/SelectorAnioMes';
import DocumentosEmpresaPanel from './DocumentosEmpresaPanel';
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

export default async function DocumentosEmpresaPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await searchParamsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return notFound();

  const qs = new URLSearchParams();
  if (searchParams.anio) qs.set('anio', searchParams.anio);
  if (searchParams.mes) qs.set('mes', searchParams.mes);

  const res = await fetch(`${getApiUrl()}/documentos-empresa?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 403) {
      return (
        <div className="p-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
            No tienes permiso para gestionar los documentos de la empresa.
          </div>
        </div>
      );
    }
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          Error al cargar los documentos (HTTP {res.status}).
        </div>
      </div>
    );
  }

  const { data } = (await res.json()) as { data: DocEmpresa[] };

  // Hilo de solicitudes/mensajes con el contador (no crítico: si falla, va vacío).
  const apiBase = getApiUrl();
  const resMsg = await fetch(`${apiBase}/documentos-empresa/mensajes`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const mensajes: MensajeDocEmpresa[] = resMsg.ok ? ((await resMsg.json()) as { data: MensajeDocEmpresa[] }).data : [];

  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 8 }, (_, i) => String(anioActual - i));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        title="Documentos de la empresa"
        subtitle="Documentación financiera para tu contador: cronograma de préstamos, estados de cuenta bancario, contratos Leasing y otra. El contador puede consultarla."
      />

      <div className="bg-white p-5 rounded-xl border border-[var(--color-border)] shadow-sm">
        <form method="GET" action="/dashboard/documentos" className="flex flex-wrap items-end gap-4">
          <SelectorAnioMes
            anios={anios}
            defaultAnio={searchParams.anio}
            defaultMes={searchParams.mes}
            selectAnioClass="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] bg-white"
            selectMesClass="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)] bg-white"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">Filtrar</button>
            <Link href="/dashboard/documentos" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center">Limpiar</Link>
          </div>
        </form>
      </div>

      <DocumentosEmpresaPanel documentos={data} />

      <MensajesDocEmpresa mensajes={mensajes} basePath="/documentos-empresa/mensajes" soyContador={false} />
    </div>
  );
}
