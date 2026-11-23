import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ invitacionId: string }> }) {
  const params = await paramsPromise;
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const res = await fetch(`${getApiUrl()}/contadores/invitaciones/${params.invitacionId}/aceptar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
