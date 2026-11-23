import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Subida de documento de sustento por el contador (multipart) → API del contador.
export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ empresaId: string; facturaId: string }> }) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();

    const res = await fetch(
      `${getApiUrl()}/contador/empresas/${params.empresaId}/facturas/${params.facturaId}/documentos`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
