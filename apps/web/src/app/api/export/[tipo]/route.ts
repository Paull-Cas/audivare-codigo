import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ tipo: string }> },
) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresaId');

  if (!empresaId) {
    return NextResponse.json({ message: 'Parámetro empresaId requerido' }, { status: 400 });
  }

  const tipo = params.tipo;
  if (tipo !== 'excel' && tipo !== 'zip') {
    return NextResponse.json({ message: 'Tipo de exportación inválido' }, { status: 400 });
  }

  // Forward remaining query params (filters)
  const forwardParams = new URLSearchParams();
  ['estado', 'proveedor', 'anio', 'mes', 'facturaId'].forEach((key) => {
    const val = searchParams.get(key);
    if (val) forwardParams.set(key, val);
  });

  const apiUrl = `${getApiUrl()}/contador/empresas/${empresaId}/exportar/${tipo}?${forwardParams.toString()}`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Error del servidor' })) as { message?: string };
    return NextResponse.json(
      { message: body.message || 'Error al generar exportación' },
      { status: res.status },
    );
  }

  const contentType =
    tipo === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/zip';
  const ext = tipo === 'excel' ? 'xlsx' : 'zip';
  const filename = `facturas_${new Date().toISOString().slice(0, 10)}.${ext}`;

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
