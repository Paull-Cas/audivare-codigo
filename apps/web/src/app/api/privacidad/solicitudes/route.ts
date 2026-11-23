import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/config/api';
export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({ message: 'Solicitud demasiado extensa' }, { status: 413 });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8192) return NextResponse.json({ message: 'Solicitud demasiado extensa' }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    const res = await fetch(`${getApiUrl()}/privacidad/solicitudes`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ message: 'No se pudo confirmar la recepción. Intenta nuevamente más tarde.' }, { status: 503 }); }
}
