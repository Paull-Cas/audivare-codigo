export function sessionCookieOptions(expiresIn: unknown) {
  if (typeof expiresIn !== 'number' || !Number.isInteger(expiresIn) || expiresIn <= 0) {
    throw new Error('La API no devolvió una duración de sesión válida');
  }
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expiresIn,
  };
}

export function publicAuthData(data: Record<string, unknown>) {
  const result = { ...data };
  delete result.access_token;
  return result;
}

export async function revokeSession(token: string | undefined, apiUrl: string): Promise<boolean> {
  if (!token) return true;
  const res = await fetch(`${apiUrl}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  // Un token ya inválido/vencido tampoco da acceso; se puede retirar la cookie.
  return res.ok || res.status === 401;
}
