'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SOPORTE, soporteWhatsappUrl, soporteEmailUrl } from '@/config/soporte';

/**
 * Botón "Asistencia" para el pie del sidebar (todos los roles). Abre un modal
 * con los canales de contacto de soporte (WhatsApp + correo) para consultas.
 */
export default function AsistenciaButton({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [open, setOpen] = useState(false);

  const mensajeWa = 'Hola, tengo una consulta sobre AudiVare.';
  const asuntoMail = 'Consulta sobre AudiVare';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={isCollapsed ? 'Asistencia' : undefined}
        className={`flex items-center rounded-md transition-colors text-sm text-slate-300 hover:bg-white/10 hover:text-white w-full ${
          isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
        }`}
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13v-1a7 7 0 0114 0v1" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 00-2 2 2 2 0 002 2h1v-4H5zM19 13h-1v4h1a2 2 0 002-2 2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 17v1a3 3 0 01-3 3h-2" />
        </svg>
        {!isCollapsed && <span className="truncate">Asistencia</span>}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">¿Necesitas ayuda?</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                ¿Tienes una consulta o algo no funciona como esperabas? Escríbenos y te ayudamos.
              </p>

              <a
                href={soporteWhatsappUrl(mensajeWa)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">WhatsApp</span>
                  <span className="block text-xs text-gray-500">{SOPORTE.telefono}</span>
                </span>
              </a>

              <a
                href={soporteEmailUrl(asuntoMail)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Correo</span>
                  <span className="block text-xs text-gray-500">{SOPORTE.email}</span>
                </span>
              </a>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
