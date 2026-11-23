'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LegalLinks from '@/components/LegalLinks';
import ConsentimientoLegal from '@/components/ConsentimientoLegal';
import { TERMINOS_AUDIVARE } from '@/config/legal';

export default function RegistroContadorPage() {
  const router = useRouter();
  const [googleUser, setGoogleUser] = useState<{ email: string; nombre?: string; credential?: string } | null>(null);

  const [nombreCompleto, setNombreCompleto] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userStr = sessionStorage.getItem('google_user');
    if (!userStr) {
      router.push('/login');
    } else {
      const parsed = JSON.parse(userStr) as { email: string; nombre?: string; credential?: string };
      if (!parsed.credential) {
        // Sesión de Google incompleta: volver a iniciar el flujo
        sessionStorage.removeItem('google_user');
        router.push('/login');
        return;
      }
      setGoogleUser(parsed);
      if (parsed.nombre) {
        setNombreCompleto(parsed.nombre);
      }
    }
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const consentimiento = new FormData(e.currentTarget as HTMLFormElement);
    setError('');

    if (!nombreCompleto.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/google/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: googleUser?.credential,
          nombre_completo: nombreCompleto,
          tipo: 'CONTADOR',
          acepta_terminos: consentimiento.get('acepta_terminos') === 'on',
          privacidad_leida: consentimiento.get('privacidad_leida') === 'on',
          version_legal: TERMINOS_AUDIVARE.version,
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.message || 'Error al registrar el contador');
        setLoading(false);
        return;
      }

      sessionStorage.removeItem('google_user');
      router.push('/contador/dashboard');
    } catch {
      setError('Ocurrió un error. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  if (!googleUser) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-[var(--color-bg)]">
      <div className="w-full max-w-md p-8 text-center border border-[var(--color-border)] rounded-lg shadow-sm bg-white">
        <h1 className="text-3xl font-bold mb-2 text-[var(--color-primary)]">Datos de Contador</h1>
        <p className="text-[var(--color-text)] mb-8">Completa tu información para finalizar el registro</p>

        <form onSubmit={handleRegister} className="flex flex-col gap-4 text-left">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Tu nombre completo</label>
            <input
              type="text"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-md p-2 outline-none focus:border-[var(--color-primary)] text-[var(--color-text)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Email</label>
            <input
              type="email"
              value={googleUser.email}
              readOnly
              className="w-full border border-[var(--color-border)] rounded-md p-2 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">{error}</p>}
          
          <ConsentimientoLegal />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => router.push('/registro/tipo')}
              className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 rounded hover:bg-gray-200 transition-colors"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[var(--color-primary)] text-white font-medium py-3 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Completando...' : 'Completar registro'}
            </button>
          </div>
        </form>
        <div className="mt-6"><LegalLinks /></div>
      </div>
    </div>
  );
}
