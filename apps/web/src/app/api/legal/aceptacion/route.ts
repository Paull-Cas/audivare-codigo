import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiUrl } from '@/config/api';

async function consultar(request?: NextRequest) {
  const token = (await cookies()).get('token')?.value;
  if (!token) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  try {
    let body: unknown;
    if (request) {
      try { body = await request.json(); }
      catch { return NextResponse.json({ message: 'Solicitud inválida' }, { status: 400 }); }
    }
    const res = await fetch(`${getApiUrl()}/legal/aceptacion`, {
      method: request ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(request ? { body: JSON.stringify(body) } : {}),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ message: 'No se pudo comprobar la aceptación. Inténtalo nuevamente.' }, { status: 503 }); }
}

export function GET() { return consultar(); }
export function POST(request: NextRequest) { return consultar(request); }
