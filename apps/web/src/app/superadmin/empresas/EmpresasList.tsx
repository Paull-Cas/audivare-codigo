'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BadgeEstadoEmpresa from '@/components/BadgeEstadoEmpresa';
import ConfirmarEliminacion from '@/components/ConfirmarEliminacion';

export interface CicloPago {
  ultimo_pago: { fecha: string; monto: string; duracion_meses: number } | null;
  fecha_vencimiento: string;
  fecha_suspension: string;
  estado_pago: 'AL_DIA' | 'VENCIDO';
  prueba_hasta?: string | null;
}

export interface EmpresaAdmin {
  id: string;
  email_registro: string;
  ruc: string;
  razon_social: string;
  plan_suscripcion: string;
  estado_suscripcion: string;
  limite_usuarios: number;
  fecha_creacion: string;
  suspendida_por_pago: boolean;
  total_facturas: number;
  total_usuarios: number;
  ciclo_pago: CicloPago;
}

interface PagoSuscripcion {
  id: string;
  monto: string;
  fecha_pago: string;
  duracion_meses: number;
  fecha_registro: string;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sin depender de la zona horaria. */
function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function periodoLegible(meses: number): string {
  if (meses === 12) return '1 año';
  return meses === 1 ? '1 mes' : `${meses} meses`;
}

export default function EmpresasList({ empresas, puedeGestionar = true }: { empresas: EmpresaAdmin[]; puedeGestionar?: boolean }) {
  const router = useRouter();
  // Empresa que se está configurando (panel único de configuración).
  const [configEmpresa, setConfigEmpresa] = useState<EmpresaAdmin | null>(null);
  // Confirmación de activar/suspender (se muestra sobre el panel).
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  // Límite de usuarios
  const [nuevoLimite, setNuevoLimite] = useState('');
  const [limiteError, setLimiteError] = useState('');
  const [savingLimite, setSavingLimite] = useState(false);
  // Pago de la suscripción del servicio
  const [historialPagos, setHistorialPagos] = useState<PagoSuscripcion[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [duracionMeses, setDuracionMeses] = useState('1');
  const [pagoError, setPagoError] = useState('');
  const [savingPago, setSavingPago] = useState(false);
  // Eliminación de empresa
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const abrirConfig = async (empresa: EmpresaAdmin) => {
    setConfigEmpresa(empresa);
    setNuevoLimite(String(empresa.limite_usuarios));
    setLimiteError('');
    setMontoPago('');
    setFechaPago(hoyISO());
    setDuracionMeses('1');
    setPagoError('');
    setHistorialPagos([]);
    setCargandoHistorial(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/superadmin/empresas/${empresa.id}/pagos`, method: 'GET' }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistorialPagos(data.data ?? []);
      }
    } catch {
      // El historial es informativo: si falla, el formulario sigue disponible.
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cerrarConfig = () => {
    setConfigEmpresa(null);
    setConfirmToggleOpen(false);
    setEliminarOpen(false);
  };

  const eliminarEmpresa = async () => {
    if (!configEmpresa) return;
    setEliminando(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/superadmin/empresas/${configEmpresa.id}`, method: 'DELETE' }),
      });
      if (res.ok) {
        setEliminarOpen(false);
        cerrarConfig();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Error al eliminar la empresa');
      }
    } catch {
      alert('Error de red al eliminar la empresa');
    } finally {
      setEliminando(false);
    }
  };

  const confirmToggle = async () => {
    if (!configEmpresa) return;
    setLoadingToggle(true);
    const nuevoEstado = configEmpresa.estado_suscripcion === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/superadmin/empresas/${configEmpresa.id}/estado`,
          method: 'PATCH',
          body: { estado_suscripcion: nuevoEstado },
        }),
      });
      if (res.ok) {
        cerrarConfig();
        router.refresh();
      } else {
        alert('Error al actualizar el estado');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al actualizar estado');
    } finally {
      setLoadingToggle(false);
    }
  };

  const guardarLimite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configEmpresa) return;
    const limite = parseInt(nuevoLimite, 10);
    if (isNaN(limite) || limite < 1) {
      setLimiteError('El límite debe ser un número mayor o igual a 1');
      return;
    }
    setSavingLimite(true);
    setLimiteError('');
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/superadmin/empresas/${configEmpresa.id}/limite-usuarios`,
          method: 'PATCH',
          body: { limite_usuarios: limite },
        }),
      });
      if (res.ok) {
        cerrarConfig();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setLimiteError(data.message || 'Error al actualizar el límite');
      }
    } catch {
      setLimiteError('Error de red al actualizar el límite');
    } finally {
      setSavingLimite(false);
    }
  };

  const guardarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configEmpresa) return;
    const monto = Number(montoPago);
    if (!montoPago || isNaN(monto) || monto < 0) {
      setPagoError('El monto debe ser un número mayor o igual a 0');
      return;
    }
    if (!fechaPago) {
      setPagoError('Indica la fecha del pago');
      return;
    }
    setSavingPago(true);
    setPagoError('');
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/superadmin/empresas/${configEmpresa.id}/pagos`,
          method: 'POST',
          body: { monto, fecha_pago: fechaPago, duracion_meses: Number(duracionMeses) },
        }),
      });
      if (res.ok) {
        cerrarConfig();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setPagoError(data.message || 'Error al registrar el pago');
      }
    } catch {
      setPagoError('Error de red al registrar el pago');
    } finally {
      setSavingPago(false);
    }
  };

  const celdaSuscripcion = (e: EmpresaAdmin) => {
    const ciclo = e.ciclo_pago;
    if (!ciclo) return <span className="text-gray-400 text-xs">—</span>;

    // Empresa recién registrada que aún no realiza su primer pago
    if (e.estado_suscripcion === 'PENDIENTE') {
      return (
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
            Pendiente de activación
          </span>
          <div className="text-xs text-gray-500">Sin acceso hasta el primer pago</div>
        </div>
      );
    }

    const ultimo = ciclo.ultimo_pago;
    let badge: React.ReactNode;
    if (ciclo.prueba_hasta && !ultimo) {
      badge = <span className="text-sm text-amber-800">
        {ciclo.estado_pago === 'VENCIDO' ? 'Prueba terminada; sin acceso' : 'Prueba de siete días'} — hasta {new Date(ciclo.prueba_hasta).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Perú)
      </span>;
    } else if (e.estado_suscripcion === 'SUSPENDIDO' && e.suspendida_por_pago) {
      badge = <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">Suspendida por pago</span>;
    } else if (ciclo.estado_pago === 'VENCIDO') {
      badge = (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
          Vencida — suspende el {fechaLegible(ciclo.fecha_suspension)}
        </span>
      );
    } else {
      badge = (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-[var(--color-accent)]">
          Al día — vence el {fechaLegible(ciclo.fecha_vencimiento)}
        </span>
      );
    }

    return (
      <div className="space-y-1">
        {badge}
        <div className="text-xs text-gray-500">
          {ultimo
            ? <>Último pago: {fechaLegible(ultimo.fecha)} · S/ {ultimo.monto} · {periodoLegible(ultimo.duracion_meses)}</>
            : 'Sin pagos registrados'}
        </div>
      </div>
    );
  };

  const esActivo = configEmpresa?.estado_suscripcion === 'ACTIVO';
  const limiteBajaDelUso = configEmpresa ? parseInt(nuevoLimite, 10) < configEmpresa.total_usuarios : false;

  return (
    <>
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[var(--color-border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RUC</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Razón social</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Suscripción</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Facturas</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Usuarios</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha registro</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Configurar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {empresas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 font-medium">No hay empresas registradas</td>
                </tr>
              ) : (
                empresas.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text)]">{e.ruc}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text)] font-medium">
                      {e.razon_social}
                      <div className="text-xs text-gray-500 font-normal mt-0.5">{e.email_registro}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{e.plan_suscripcion}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <BadgeEstadoEmpresa estado={e.estado_suscripcion} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {celdaSuscripcion(e)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">{e.total_facturas}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={e.total_usuarios >= e.limite_usuarios ? 'text-amber-600 font-semibold' : 'text-gray-600'}>
                        {e.total_usuarios} / {e.limite_usuarios}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(e.fecha_creacion).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      {puedeGestionar ? (
                        <button
                          onClick={() => abrirConfig(e)}
                          title="Configurar empresa"
                          aria-label="Configurar empresa"
                          className="inline-flex items-center justify-center p-2 rounded-md text-[var(--color-primary)] hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel único de configuración: estado, suscripción y límite */}
      {configEmpresa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={cerrarConfig}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Configurar empresa</h3>
                <p className="text-sm text-gray-500 mt-0.5">{configEmpresa.razon_social} · RUC {configEmpresa.ruc}</p>
              </div>
              <button onClick={cerrarConfig} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sección: Estado / suspensión */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado de la empresa</h4>
                <div className="flex items-center justify-between gap-4 bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BadgeEstadoEmpresa estado={configEmpresa.estado_suscripcion} />
                    {configEmpresa.estado_suscripcion === 'SUSPENDIDO' && configEmpresa.suspendida_por_pago && (
                      <span className="text-xs text-red-600">Suspendida automáticamente por falta de pago</span>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmToggleOpen(true)}
                    disabled={loadingToggle}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50 ${esActivo ? 'bg-red-600 hover:bg-red-700' : 'btn-accent'}`}
                  >
                    {esActivo ? 'Suspender' : 'Activar'}
                  </button>
                </div>
              </section>

              {/* Sección: Pago de la suscripción del servicio */}
              <section className="border-t border-gray-100 pt-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Suscripción del servicio</h4>

                {configEmpresa.estado_suscripcion === 'PENDIENTE' ? (
                  <p className="text-xs text-[var(--color-accent)] font-medium mb-3 bg-green-50 rounded-lg px-3 py-2">
                    Empresa pendiente de activación: al registrar este primer pago se activará y podrá ingresar.
                  </p>
                ) : (
                  <>
                    {configEmpresa.ciclo_pago && (
                      <div className={`rounded-lg px-3 py-2 mb-3 text-xs ${configEmpresa.ciclo_pago.estado_pago === 'VENCIDO' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {configEmpresa.ciclo_pago.estado_pago === 'VENCIDO'
                          ? <>Suscripción vencida el {fechaLegible(configEmpresa.ciclo_pago.fecha_vencimiento)}; suspensión automática el {fechaLegible(configEmpresa.ciclo_pago.fecha_suspension)}.</>
                          : <>Al día: el ciclo actual vence el {fechaLegible(configEmpresa.ciclo_pago.fecha_vencimiento)}.</>}
                      </div>
                    )}
                    {configEmpresa.estado_suscripcion === 'SUSPENDIDO' && configEmpresa.suspendida_por_pago && (
                      <p className="text-xs text-[var(--color-accent)] font-medium mb-3">
                        Al registrar el pago se reactivará automáticamente.
                      </p>
                    )}
                  </>
                )}

                <form onSubmit={guardarPago} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
                    <input
                      type="number" min="0" step="0.01" value={montoPago}
                      onChange={(ev) => setMontoPago(ev.target.value)} placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                    <input
                      type="date" value={fechaPago} max={hoyISO()}
                      onChange={(ev) => setFechaPago(ev.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
                    <select
                      value={duracionMeses}
                      onChange={(ev) => setDuracionMeses(ev.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
                    >
                      <option value="1">1 mes</option>
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">1 año</option>
                    </select>
                  </div>
                  {pagoError && <p className="text-sm text-red-600 sm:col-span-3">{pagoError}</p>}
                  <div className="sm:col-span-3 flex justify-end">
                    <button type="submit" disabled={savingPago} className="btn-accent px-4 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50">
                      {savingPago ? 'Guardando...' : 'Registrar pago'}
                    </button>
                  </div>
                </form>

                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pagos anteriores</h5>
                  {cargandoHistorial ? (
                    <p className="text-xs text-gray-400">Cargando...</p>
                  ) : historialPagos.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin pagos registrados</p>
                  ) : (
                    <ul className="max-h-32 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                      {historialPagos.map((p) => (
                        <li key={p.id} className="flex justify-between gap-3 px-3 py-1.5 text-xs text-gray-600">
                          <span>{fechaLegible(p.fecha_pago)}</span>
                          <span className="font-medium">S/ {p.monto} · {periodoLegible(p.duracion_meses)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Sección: Límite de usuarios */}
              <section className="border-t border-gray-100 pt-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Límite de usuarios</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Máximo de usuarios internos (incluye al administrador). Actualmente usa <strong>{configEmpresa.total_usuarios}</strong>.
                </p>
                <form onSubmit={guardarLimite} className="flex items-end gap-3">
                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Límite</label>
                    <input
                      type="number" min={1} value={nuevoLimite}
                      onChange={(ev) => setNuevoLimite(ev.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <button type="submit" disabled={savingLimite} className="btn-primary px-4 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50">
                    {savingLimite ? 'Guardando...' : 'Guardar límite'}
                  </button>
                </form>
                {limiteError && <p className="text-sm text-red-600 mt-2">{limiteError}</p>}
                {limiteBajaDelUso && (
                  <p className="text-xs text-amber-600 mt-2">
                    El límite quedará por debajo de los usuarios actuales: se desactivarán automáticamente los últimos usuarios registrados (nunca el administrador) y se notificará a la empresa.
                  </p>
                )}
              </section>

              {/* Sección: Zona de peligro */}
              <section className="border-t border-red-100 pt-6">
                <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3">Zona de peligro</h4>
                <div className="flex items-center justify-between gap-4 bg-red-50/60 border border-red-100 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-600">
                    Eliminar la empresa borra <span className="font-semibold">todas sus facturas, documentos, pagos y archivos</span>. No se puede deshacer.
                  </p>
                  <button
                    onClick={() => setEliminarOpen(true)}
                    className="shrink-0 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    Eliminar empresa
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación de empresa (escribir ELIMINAR) */}
      {configEmpresa && eliminarOpen && (
        <ConfirmarEliminacion
          titulo="Eliminar empresa"
          textoBoton="Eliminar empresa"
          loading={eliminando}
          onCancelar={() => !eliminando && setEliminarOpen(false)}
          onConfirmar={eliminarEmpresa}
          mensaje={
            <>
              Vas a eliminar <strong>{configEmpresa.razon_social}</strong> (RUC {configEmpresa.ruc}) y{' '}
              <strong>todos sus datos</strong>: facturas, documentos, pagos, roles y usuarios. Esta acción es irreversible.
            </>
          }
        />
      )}

      {/* Confirmación de activar/suspender (sobre el panel) */}
      {configEmpresa && confirmToggleOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !loadingToggle && setConfirmToggleOpen(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar acción</h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro que deseas {esActivo ? 'suspender' : 'activar'} a la empresa <strong>{configEmpresa.razon_social}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmToggleOpen(false)}
                disabled={loadingToggle}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggle}
                disabled={loadingToggle}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${esActivo ? 'bg-red-600 hover:bg-red-700' : 'btn-accent'}`}
              >
                {loadingToggle ? 'Procesando...' : `Sí, ${esActivo ? 'suspender' : 'activar'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
