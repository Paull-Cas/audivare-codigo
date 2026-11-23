import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string; documentoId: string }> }
) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();

    const res = await fetch(`${getApiUrl()}/facturas/${params.id}/documentos/${params.documentoId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string; documentoId: string }> }
) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const res = await fetch(`${getApiUrl()}/facturas/${params.id}/documentos/${params.documentoId}`, {
      method: 'DELETE',
      headers: { 
        Authorization: `Bearer ${token}`,
      }
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
