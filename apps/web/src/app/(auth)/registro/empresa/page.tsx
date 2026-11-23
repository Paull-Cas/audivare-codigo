'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContactoContador from '@/components/ContactoContador';
import { CONTACTO_CONTADOR } from '@/config/contacto';
import LegalLinks from '@/components/LegalLinks';
import ConsentimientoLegal from '@/components/ConsentimientoLegal';
import { TERMINOS_AUDIVARE } from '@/config/legal';

export default function RegistroEmpresaPage() {
  const router = useRouter();
  const [googleUser, setGoogleUser] = useState<{ email: string; nombre?: string; credential?: string } | null>(null);

  const [formData, setFormData] = useState({
    nombreCompleto: '',
    ruc: '',
    razonSocial: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendiente, setPendiente] = useState(false);

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
        setFormData((prev) => ({ ...prev, nombreCompleto: parsed.nombre ?? '' }));
      }
    }
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const consentimiento = new FormData(e.currentTarget as HTMLFormElement);
    setError('');

    if (!formData.nombreCompleto.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }

    if (formData.ruc.length !== 11) {
      setError('El RUC debe tener exactamente 11 dígitos');
      return;
    }

    if (!formData.razonSocial.trim()) {
      setError('La razón social no puede estar vacía');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/google/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: googleUser?.credential,
          nombre_completo: formData.nombreCompleto,
          tipo: 'EMPRESA',
          ruc: formData.ruc,
          razon_social: formData.razonSocial,
          acepta_terminos: consentimiento.get('acepta_terminos') === 'on',
          privacidad_leida: consentimiento.get('privacidad_leida') === 'on',
          declara_representacion: consentimiento.get('declara_representacion') === 'on',
          version_legal: TERMINOS_AUDIVARE.version,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        const errMsg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(errMsg || 'Error al registrar la empresa');
        setLoading(false);
        return;
      }

      sessionStorage.removeItem('google_user');

      // Compatibilidad con una API anterior durante la transición; la nueva
      // API emite sesión y concede una prueba de siete días.
      if (data.pendiente_activacion) {
        setPendiente(true);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Ocurrió un error. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  if (!googleUser) return null;

  if (pendiente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-[var(--color-bg)]">
        <div className="w-full max-w-md p-8 text-center border border-[var(--color-border)] rounded-lg shadow-sm bg-white">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-[var(--color-text)]">¡Registro completo!</h1>
          <p className="text-[var(--color-text)] mb-2">
            Tu empresa <strong>{formData.razonSocial}</strong> quedó registrada y está{' '}
            <strong>pendiente de activación</strong>.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Para activar el acceso a tu cuenta, comunícate con nosotros. Te avisaremos cuando puedas ingresar.
          </p>

          <div className="mb-6">
            <ContactoContador
              descripcion={`Comunícate con ${CONTACTO_CONTADOR.nombre} para activar el acceso de ${formData.razonSocial || 'tu empresa'}.`}
              mensajeWhatsapp={`Hola, acabo de registrar mi empresa "${formData.razonSocial}" en AudiVare y quiero activar el acceso a mi cuenta.`}
              asuntoEmail="Activación de cuenta AudiVare"
            />
          </div>

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-[var(--color-primary)] text-white font-medium py-3 rounded hover:opacity-90 transition-opacity"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-[var(--color-bg)]">
      <div className="w-full max-w-md p-8 text-center border border-[var(--color-border)] rounded-lg shadow-sm bg-white">
        <h1 className="text-3xl font-bold mb-2 text-[var(--color-primary)]">Datos de tu empresa</h1>
        <p className="text-[var(--color-text)] mb-8">Completa la información para finalizar el registro</p>

        <p className="text-sm text-gray-600 mb-4">Al registrarte tendrás siete días de acceso gratuito. Para continuar después, coordina tu pago con AudiVare.</p>
        <form onSubmit={handleRegister} className="flex flex-col gap-4 text-left">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Tu nombre completo</label>
            <input
              type="text"
              value={formData.nombreCompleto}
              onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
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
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">RUC</label>
            <input
              type="text"
              value={formData.ruc}
              onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '') })}
              className="w-full border border-[var(--color-border)] rounded-md p-2 outline-none focus:border-[var(--color-primary)] text-[var(--color-text)]"
              maxLength={11}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Razón social</label>
            <input
              type="text"
              value={formData.razonSocial}
              onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
              className="w-full border border-[var(--color-border)] rounded-md p-2 outline-none focus:border-[var(--color-primary)] text-[var(--color-text)]"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">{error}</p>}
          
          <ConsentimientoLegal empresa />
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
