import { NextResponse } from 'next/server';
import { fetchApi } from '@/lib/api';
import { sessionCookieOptions } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 429) return NextResponse.json({ error: 'Demasiados intentos. Intenta nuevamente en un minuto.' }, { status: 429, headers: { 'Retry-After': '60' } });
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const data = await res.json();
    
    // Rutas de redirección por rol
    let redirectUrl = '/dashboard';
    if (data.tipo_usuario === 'SUPERADMIN') {
      redirectUrl = '/superadmin/dashboard';
    } else if (data.tipo_usuario === 'CONTADOR_EXTERNO') {
      redirectUrl = '/contador/dashboard';
    }

    const response = NextResponse.json({ success: true, redirectUrl });
    
    response.cookies.set('token', data.access_token, sessionCookieOptions(data.expires_in));

    return response;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
