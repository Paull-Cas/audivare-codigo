import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose/jwt/verify';
import { getJwtSecret } from '@/config/jwt';

const JWT_SECRET = new TextEncoder().encode(getJwtSecret());

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;
  // Las cookies no autorizan peticiones de escritura originadas en otro sitio.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    let valido = !origin;
    if (origin) {
      try {
        const fuente = new URL(origin);
        valido = ['http:', 'https:'].includes(fuente.protocol) && fuente.host === request.headers.get('host');
      } catch { valido = false; }
    }
    if (!valido || site === 'cross-site' || site === 'same-site')
      return NextResponse.json({ message: 'Origen de la solicitud no permitido' }, {status: 403});
  }
  const sinSesion = () => {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ message: 'Tu sesión venció. Inicia sesión nuevamente.' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  };

  // Rutas exentas de protección
  if (pathname === '/' || pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname.startsWith('/api/auth') || pathname === '/login' || pathname.startsWith('/registro')
    || pathname === '/privacidad' || pathname === '/terminos' || pathname === '/politica-privacidad'
    || pathname === '/api/privacidad/solicitudes') {
    return NextResponse.next();
  }

  // Si no hay token, redirigir al login
  if (!token) {
    return sinSesion();
  }

  let tipoUsuario: string | undefined;
  try {
    // Verificar la firma del JWT (no solo decodificarlo)
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'audivare-api',
      audience: 'audivare-web',
      requiredClaims: ['sub', 'sid', 'exp', 'tipo_usuario'],
    });
    tipoUsuario = typeof payload.tipo_usuario === 'string' ? payload.tipo_usuario : undefined;
  } catch {
    // Token corrupto, forjado o no verificable: limpiar cookie y volver al login
    return sinSesion();
  }

  if (pathname.startsWith('/superadmin') && tipoUsuario !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/contador') && tipoUsuario !== 'CONTADOR_EXTERNO') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && tipoUsuario === 'CONTADOR_EXTERNO') {
    return NextResponse.redirect(new URL('/contador/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && tipoUsuario === 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
