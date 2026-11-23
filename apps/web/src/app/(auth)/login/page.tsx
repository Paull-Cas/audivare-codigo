'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import ContactoContador from '@/components/ContactoContador';
import LegalLinks from '@/components/LegalLinks';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const procesarLogin = useCallback(async (credential: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      if (data.requiere_registro) {
        sessionStorage.setItem('google_user', JSON.stringify({
          email: data.google_email,
          nombre: data.google_nombre || '',
          credential,
        }));
        router.push('/registro/tipo');
      } else {
        if (data.tipo_usuario === 'CONTADOR_EXTERNO') {
           router.push('/contador/dashboard');
        } else if (data.tipo_usuario === 'SUPERADMIN') {
           router.push('/superadmin/dashboard');
        } else {
           router.push('/dashboard');
        }
      }
    } catch {
      setError('Ocurrió un error. Inténtalo de nuevo.');
      setLoading(false);
    }
  }, [router]);

  const inicializarGoogle = useCallback(() => {
    if (!window.google || !googleButtonRef.current) return;
    if (!GOOGLE_CLIENT_ID) {
      setError('Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => procesarLogin(response.credential),
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'filled_blue',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
      locale: 'es',
    });
  }, [procesarLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen app-surface p-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={inicializarGoogle}
        onError={() => setError('No se pudo cargar Google. Revisa tu conexión.')}
      />

      <div className="w-full max-w-md p-8 text-center border border-white/60 rounded-2xl shadow-xl glass-strong relative">
        <div className="flex flex-col items-center justify-center mb-8">
            <Image src="/logo-audivare.png" alt="Logo" width={80} height={80} className="object-contain mb-4" />
            <Image src="/titulo-audivare.png" alt="AudiVare" width={240} height={60} className="object-contain" />
        </div>
        <p className="text-[var(--color-text)] mb-8">Plataforma de gestión documental contable</p>
        <div className="mb-6"><LegalLinks /></div>

        <div className="flex flex-col items-center gap-4">
          <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" />

          {loading && (
            <p className="text-sm text-gray-500">Iniciando sesión...</p>
          )}

          {error && (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          )}

          {/* Empresa sin acceso (pendiente de activación o suspendida): ofrecer contacto */}
          {/pendiente|suspend|periodo.*termin/i.test(error) && (
            <ContactoContador
              descripcion="Tu empresa aún no tiene acceso. Comunícate con nosotros para activar el acceso a tu cuenta."
              mensajeWhatsapp="Hola, intento ingresar a AudiVare pero mi empresa no tiene acceso. Quiero activar el acceso a mi cuenta."
              asuntoEmail="Acceso a mi cuenta AudiVare"
            />
          )}
        </div>
      </div>
    </div>
  );
}
