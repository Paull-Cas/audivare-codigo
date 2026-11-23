import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = (await cookies());
  const token = cookieStore.get('token')?.value;

  try {
    const payload = await request.json();
    const { path, method, body } = payload;
    if (typeof path !== 'string' || path.length > 2048 || !/^\/(?!\/)/.test(path) || /[\\\x00-\x1f#]/.test(path)
      || !['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method || 'POST'))
      return NextResponse.json({ message: 'Solicitud inválida' }, {status: 400});

    if (!token) {
      return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    }

    const apiUrl = getApiUrl();
    const destino = new URL(path, apiUrl);
    let segmentos: string[];
    try { segmentos = decodeURIComponent(path.split('?')[0]).split('/'); }
    catch { return NextResponse.json({ message: 'Ruta inválida' }, {status: 400}); }
    if (destino.origin !== new URL(apiUrl).origin || segmentos.some(s => s === '.' || s === '..') || /%2f|%5c/i.test(path.split('?')[0]))
      return NextResponse.json({ message: 'Ruta inválida' }, {status: 400});

    // Sin body no se envía Content-Type: Fastify rechaza application/json con body vacío
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let bodyForward: string | undefined;
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      bodyForward = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const res = await fetch(`${apiUrl}${path}`, {
      method: method || 'POST',
      headers,
      body: bodyForward,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      return NextResponse.json(data || { message: 'Error de la API' }, { status: res.status });
    }
    
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ message: 'No se pudo completar la solicitud' }, { status: 502 });
  }
}
