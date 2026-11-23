import { getApiUrl } from '@/config/api';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sessionCookieOptions, publicAuthData } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${getApiUrl()}/auth/google/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    if (data.requiere_registro) {
      return NextResponse.json(data);
    }

    // Success login
    (await cookies()).set('token', data.access_token, sessionCookieOptions(data.expires_in));

    return NextResponse.json(publicAuthData(data));

  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
