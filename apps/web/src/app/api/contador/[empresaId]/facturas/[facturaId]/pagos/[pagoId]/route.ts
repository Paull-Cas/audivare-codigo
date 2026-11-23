import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const apiBase = (empresaId: string, facturaId: string, pagoId: string) =>
  `${getApiUrl()}/contador/empresas/${empresaId}/facturas/${facturaId}/pagos/${pagoId}`;

// Editar pago (multipart) por el contador.
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ empresaId: string; facturaId: string; pagoId: string }> },
) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const res = await fetch(apiBase(params.empresaId, params.facturaId, params.pagoId), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}

// Eliminar pago por el contador.
export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ empresaId: string; facturaId: string; pagoId: string }> },
) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const res = await fetch(apiBase(params.empresaId, params.facturaId, params.pagoId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
