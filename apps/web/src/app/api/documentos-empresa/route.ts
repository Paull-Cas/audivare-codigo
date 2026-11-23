import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Subir documento de empresa (multipart).
export async function POST(request: NextRequest) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;
  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const res = await fetch(`${getApiUrl()}/documentos-empresa`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
