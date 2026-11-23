'use client';

import Link from 'next/link';

interface OnboardingEstado {
  tiene_contador: boolean;
  invitacion_pendiente: boolean;
  total_facturas: number;
}

type EstadoPaso = 'hecho' | 'espera' | 'actual' | 'pendiente';

function Icono({ estado, numero }: { estado: EstadoPaso; numero: number }) {
  if (estado === 'hecho') {
    return (
      <span className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  }
  if (estado === 'espera') {
    return (
      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </span>
    );
  }
  const activo = estado === 'actual';
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${activo ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-400'}`}>
      {numero}
    </span>
  );
}

export default function PrimerosPasos({ estado, permisos }: { estado: OnboardingEstado; permisos: string[] }) {
  const { tiene_contador, invitacion_pendiente, total_facturas } = estado;

  // La guía no desaparece: cuando ya está todo en marcha se muestra colapsada
  // (se puede volver a abrir para consultarla), pero siempre queda disponible.
  const completo = tiene_contador && total_facturas > 0;

  const puedeInvitar = permisos.includes('CONTADOR_INVITE');
  const puedeDocsEmpresa = permisos.includes('DOCUMENTO_EMPRESA_MANAGE');

  // Estados de cada paso
  const paso1: EstadoPaso = tiene_contador ? 'hecho' : invitacion_pendiente ? 'espera' : 'actual';
  const paso2: EstadoPaso = total_facturas > 0 ? 'hecho' : tiene_contador ? 'espera' : 'pendiente';
  const paso3: EstadoPaso = total_facturas > 0 ? 'actual' : 'pendiente';

  return (
    <details open={!completo} className="group bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
      <summary className="flex items-start gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="w-9 h-9 rounded-xl bg-blue-50 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Primeros pasos</h2>
          <p className="text-sm text-gray-500">
            {completo
              ? 'Tu cuenta ya está en marcha. Puedes consultar esta guía cuando quieras.'
              : 'Así se pone en marcha tu cuenta. Cada paso se marca solo a medida que avanzas.'}
          </p>
        </div>
        <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </summary>

      <ol className="space-y-4 mt-5">
        {/* Paso 1: invitar al contador */}
        <li className="flex gap-3">
          <Icono estado={paso1} numero={1} />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Invita a tu contador</div>
            {paso1 === 'hecho' ? (
              <p className="text-sm text-gray-500">Ya tienes un contador vinculado.</p>
            ) : paso1 === 'espera' ? (
              <p className="text-sm text-amber-600">Invitación enviada. Pídele a tu contador que la acepte desde sus notificaciones en AudiVare.</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Comunícate con tu contador externo y <span className="font-medium text-gray-700">pídele el correo (Gmail) con el que ingresa a AudiVare</span>. Con ese correo lo invitas aquí y le das acceso a tu empresa; él será quien importe tus facturas desde SUNAT.
                </p>
                {puedeInvitar ? (
                  <Link href="/dashboard/contadores" className="inline-flex mt-2 btn-primary text-white px-3 py-1.5 rounded-md text-sm font-medium">Invitar contador con su correo</Link>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Pídele a un administrador de tu empresa que invite al contador con ese correo.</p>
                )}
              </>
            )}
          </div>
        </li>

        {/* Paso 2: el contador importa facturas */}
        <li className="flex gap-3">
          <Icono estado={paso2} numero={2} />
          <div className="flex-1">
            <div className={`font-medium ${paso2 === 'pendiente' ? 'text-gray-400' : 'text-gray-900'}`}>Tu contador importa tus facturas</div>
            {paso2 === 'hecho' ? (
              <p className="text-sm text-gray-500">Ya tienes facturas importadas ({total_facturas}).</p>
            ) : paso2 === 'espera' ? (
              <p className="text-sm text-gray-500">Pídele a tu contador que importe tus facturas (sube el Registro de Compras de SUNAT en CSV). Aparecerán aquí en cuanto lo haga.</p>
            ) : (
              <p className="text-sm text-gray-400">Disponible cuando tu contador acepte la invitación.</p>
            )}
          </div>
        </li>

        {/* Paso 3: completar documentación */}
        <li className="flex gap-3">
          <Icono estado={paso3} numero={3} />
          <div className="flex-1">
            <div className={`font-medium ${paso3 === 'pendiente' ? 'text-gray-400' : 'text-gray-900'}`}>Completa la documentación</div>
            {paso3 === 'actual' ? (
              <>
                <p className="text-sm text-gray-500">Sube los documentos de respaldo y registra los pagos de cada factura.</p>
                <Link href="/dashboard/facturas" className="inline-flex mt-2 bg-white border border-[var(--color-primary)] text-[var(--color-primary)] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors">Ver facturas</Link>
              </>
            ) : (
              <p className="text-sm text-gray-400">Disponible cuando tengas facturas.</p>
            )}
          </div>
        </li>

        {/* Paso 4 (opcional): documentos de la empresa */}
        {puedeDocsEmpresa && (
          <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0 text-xs font-semibold">+</span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Carga los documentos de tu empresa <span className="text-xs font-normal text-gray-400">(opcional)</span></div>
              <p className="text-sm text-gray-500">Sube cronograma de préstamos, estados de cuenta bancario, contratos Leasing… tu contador podrá consultarlos.</p>
              <Link href="/dashboard/documentos" className="inline-flex mt-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">Documentos de la empresa</Link>
            </div>
          </li>
        )}
      </ol>
    </details>
  );
}
