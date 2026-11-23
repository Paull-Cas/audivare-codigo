import { getApiUrl } from '@/config/api';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession } from '@/lib/session';

export async function POST() {
  try {
    const revoked = await revokeSession(
      (await cookies()).get('token')?.value,
      getApiUrl(),
    );
    if (!revoked) {
      return NextResponse.json({ message: 'No se pudo cerrar la sesión. Inténtalo nuevamente.' }, { status: 503 });
    }
  } catch {
    // Conservar la cookie para poder reintentar la revocación si la API no responde.
    return NextResponse.json({ message: 'No se pudo cerrar la sesión. Inténtalo nuevamente.' }, { status: 503 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete('token');
  return response;
}
