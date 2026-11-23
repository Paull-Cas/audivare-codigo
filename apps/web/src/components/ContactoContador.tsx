// Tarjeta de contacto del contador (socio). Se muestra cuando la empresa no
// tiene acceso (pendiente de activación o suspendida) para que el usuario
// se comunique y active/recupere el acceso a su cuenta por WhatsApp o email.
import { CONTACTO_CONTADOR, whatsappUrl, emailUrl } from '@/config/contacto';

export default function ContactoContador({
  descripcion,
  mensajeWhatsapp,
  asuntoEmail,
}: {
  descripcion?: string;
  mensajeWhatsapp?: string;
  asuntoEmail?: string;
}) {
  return (
    <div className="w-full text-left border border-[var(--color-border)] rounded-xl bg-gray-50/70 p-4">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
        ¿Necesitas ayuda con tu acceso?
      </p>
      <p className="text-xs text-gray-500 mb-3">
        {descripcion || `Comunícate con ${CONTACTO_CONTADOR.nombre} para activar el acceso a tu cuenta.`}
      </p>

      <div className="flex flex-col gap-2">
        <a
          href={whatsappUrl(mensajeWhatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] text-white px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
          </svg>
          Escribir por WhatsApp
        </a>
        <a
          href={emailUrl(asuntoEmail)}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Enviar un email
        </a>
      </div>

      <div className="mt-3 text-xs text-gray-400 space-y-0.5">
        <p>Teléfono: {CONTACTO_CONTADOR.telefono}</p>
        <p>Email: {CONTACTO_CONTADOR.email}</p>
      </div>
    </div>
  );
}
