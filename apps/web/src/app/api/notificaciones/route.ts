import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const leida = searchParams.get('leida');
  const query = leida ? `?leida=${leida}` : '';

  try {
    const res = await fetch(`${getApiUrl()}/notificaciones${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
