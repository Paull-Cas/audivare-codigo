import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const res = await fetch(`${getApiUrl()}/perfil`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

  try {
    const body = await request.json();
    const res = await fetch(`${getApiUrl()}/perfil`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
