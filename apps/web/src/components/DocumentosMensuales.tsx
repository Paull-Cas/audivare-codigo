"use client";
import Link from "next/link";
import ModalDocumento from "./ModalDocumento";
import SelectorDocumento from "./SelectorDocumento";
import { EyeIcon, EditIcon, DeleteIcon, FacturaIcon, DocumentosIcon, UploadIcon, CloseIcon, SearchIcon, DownloadIcon, PagoIcon } from "./icons";
import { useCallback, useEffect, useState } from "react";

const categorias = [
  ["FACTURA", "Facturas"],
  ["MEDIO_PAGO", "Medios de pago"],
  ["GUIA_REMITENTE", "Guías de remisión del remitente"],
  ["GUIA_TRANSPORTISTA", "Guías de remisión del transportista"],
  ["OTRO", "Otros documentos"],
] as const;
const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const anios = Array.from({ length: 101 }, (_, i) => 2000 + i);
const DOCUMENTOS_POR_PAGINA = 10;
const REFERENCIA_EJEMPLO = "Indica la serie y número de la factura, la razón social del proveedor u otra referencia que permita identificarla";
type Categoria = (typeof categorias)[number][0];
const estilosCategoria = {
  FACTURA: {Icono: FacturaIcon, icono:"bg-violet-100 text-violet-700", seleccionado:"border-violet-300 bg-violet-50 ring-1 ring-violet-100", acento:"accent-violet-600"},
  MEDIO_PAGO: {Icono: PagoIcon, icono:"bg-emerald-100 text-emerald-700", seleccionado:"border-emerald-300 bg-emerald-50 ring-1 ring-emerald-100", acento:"accent-emerald-600"},
  GUIA_REMITENTE: {Icono: DocumentosIcon, icono:"bg-blue-100 text-blue-700", seleccionado:"border-blue-300 bg-blue-50 ring-1 ring-blue-100", acento:"accent-blue-600"},
  GUIA_TRANSPORTISTA: {Icono: DocumentosIcon, icono:"bg-amber-100 text-amber-800", seleccionado:"border-amber-300 bg-amber-50 ring-1 ring-amber-100", acento:"accent-amber-600"},
  OTRO: {Icono: DocumentosIcon, icono:"bg-slate-100 text-slate-600", seleccionado:"border-slate-300 bg-slate-50 ring-1 ring-slate-100", acento:"accent-slate-600"},
};
interface Documento {
  id: string;
  anio: number;
  mes: number;
  categoria: Categoria;
  nota: string | null;
  archivoNombre: string;
  fechaCarga: string;
  autor: string | null;
}
interface Evento {
  id: string;
  accion: string;
  fecha: string;
  autor: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}
const fecha = (valor: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(valor));
const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";
const boton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50";
async function errorApi(res: Response) {
  const dato = await res.json().catch(() => ({}));
  return typeof dato.message === "string"
    ? dato.message
    : "No se pudo completar la operación";
}

export default function DocumentosMensuales({
  empresaId,
  permisos,
  nombre,
  vista = "lista",
}: {
  empresaId?: string;
  permisos: string[];
  nombre?: string;
  vista?: "lista" | "factura" | "sustento" | "actividad" | "descargas";
}) {
  const actual = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const [anio, setAnio] = useState(
    vista === "lista" ? 2026 : Number(actual.find((p) => p.type === "year")?.value),
  );
  const [mes, setMes] = useState(
    vista === "lista" ? 0 : Number(actual.find((p) => p.type === "month")?.value),
  );
  const [filtro, setFiltro] = useState("");
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [total, setTotal] = useState(0);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [validandoArchivo, setValidandoArchivo] = useState(false);
  const [revision, setRevision] = useState(0);
  const [formulario, setFormulario] = useState<"factura" | "sustento" | null>(
    vista === "factura" || vista === "sustento" ? vista : null,
  );
  const [editando, setEditando] = useState<Documento | null>(null);
  const [archivoEdicion, setArchivoEdicion] = useState<File | null>(null);
  const [eliminando, setEliminando] = useState<Documento | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>(["FACTURA"]);
  const [actividad] = useState(vista === "actividad");
  const [elegido, setElegido] = useState<File | null>(null);
  const puede = (codigo: string) => permisos.includes(codigo);
  const puedeLeer = !!empresaId || puede("DOCUMENTO_MENSUAL_READ");
  const puedeCrear = !!empresaId || puede("DOCUMENTO_MENSUAL_CREATE");
  const puedeEditar = !!empresaId || puede("DOCUMENTO_MENSUAL_UPDATE");
  const baseDocumentos = empresaId ? `/contador/empresa/${empresaId}` : "/dashboard/documentos-mensuales";
  const baseCarga = empresaId ? baseDocumentos : "/dashboard";
  const contextoEmpresa = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : "";
  const puedeExportar = !!empresaId && vista === "descargas";
  const query = useCallback(() => {
    const q = new URLSearchParams({
      pagina: String(pagina),
    });
    if (anio) q.set("anio", String(anio));
    if (mes) q.set("mes", String(mes));
    if (filtro) q.set("categoria", filtro);
    if (busqueda) q.set("busqueda", busqueda);
    if (empresaId) q.set("empresaId", empresaId);
    return q;
  }, [anio, mes, pagina, filtro, busqueda, empresaId]);
  useEffect(() => {
    if (!puedeLeer || vista !== "lista") return;
    const controller = new AbortController();
    setCargando(true);
    setError("");
    void fetch(`/api/documentos-mensuales?${query()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorApi(res));
        const data: { data: Documento[]; total: number } = await res.json();
        if (pagina > Math.max(1, Math.ceil(data.total / DOCUMENTOS_POR_PAGINA))) {
          setPagina(Math.max(1, Math.ceil(data.total / DOCUMENTOS_POR_PAGINA)));
          return;
        }
        setDocs(data.data);
        setTotal(data.total);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setDocs([]);
          setError(e instanceof Error ? e.message : "No se pudo cargar");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [query, revision, puedeLeer, vista, pagina]);
  useEffect(() => {
    if (!actividad || !puedeLeer) return;
    const controller = new AbortController();
    void fetch(
      `/api/documentos-mensuales/actividad${empresaId ? "?empresaId=" + encodeURIComponent(empresaId) : ""}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorApi(res));
        const datos: { data: Evento[] } = await res.json();
        setEventos(datos.data);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la actividad",
          );
      });
    return () => controller.abort();
  }, [actividad, empresaId, revision, puedeLeer]);
  async function operacion(url: string, options: RequestInit, exito: string) {
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(await errorApi(res));
      setMensaje(exito);
      setRevision((v) => v + 1);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return false;
    } finally {
      setOcupado(false);
    }
  }
  async function subir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!elegido) {
      setError("Selecciona una foto o un PDF");
      return;
    }
    if (elegido.size > 10 * 1024 * 1024) {
      setError("El archivo no debe superar 10 MB");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const referencia = String(data.get("nota") || "").trim();
    if (!referencia) { setError(REFERENCIA_EJEMPLO); return; }
    data.set("nota", referencia);
    data.set("archivo", elegido);
    if (formulario === "factura") data.set("categoria", "FACTURA");
    if (
      await operacion(
        `/api/documentos-mensuales${contextoEmpresa}`,
        { method: "POST", body: data },
        "Documento cargado correctamente",
      )
    ) {
      setAnio(Number(data.get("anio")));
      setMes(Number(data.get("mes")));
      setFiltro("");
      setPagina(1);
      setElegido(null);
      form.reset();
    }
  }
  async function exportar() {
    setOcupado(true);
    setError("");
    try {
      const q = query();
      q.delete("categoria");
      q.delete("pagina");
      q.set("categorias", seleccion.join(","));
      const res = await fetch(`/api/documentos-mensuales/pdf?${q}`);
      if (!res.ok) throw new Error(await errorApi(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audivare-${anio}-${String(mes).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setOcupado(false);
    }
  }
  async function abrir(doc: Documento) {
    setOcupado(true);
    setError("");
    const ventana = window.open("about:blank", "_blank");
    if (ventana) ventana.opener = null;
    try {
      const res = await fetch(
        `/api/documentos-mensuales/${doc.id}/archivo${empresaId ? "?empresaId=" + encodeURIComponent(empresaId) : ""}`,
      );
      if (!res.ok) throw new Error(await errorApi(res));
      const data: { url: string } = await res.json();
      if (ventana) ventana.location.replace(data.url);
      else setError("Permite abrir pestañas para visualizar el documento");
    } catch (e: unknown) {
      ventana?.close();
      setError(e instanceof Error ? e.message : "No se pudo abrir");
    } finally {
      setOcupado(false);
    }
  }
  const accion = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
  const paginaBoton = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40";
  const totalPaginas = Math.max(1, Math.ceil(total / DOCUMENTOS_POR_PAGINA));
  const paginas: (number | "…")[] = [];
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1) paginas.push(p);
    else if (paginas[ paginas.length - 1 ] !== "…") paginas.push("…");
  }
  const camposPeriodo = (a = anio, m = mes) => (
    <div className="grid grid-cols-2 gap-3">
      <label>
        Año
        <select className={input} name="anio" required defaultValue={a}>
          {anios.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mes
        <select className={input} name="mes" required defaultValue={m}>
          {meses.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  if ((vista === "factura" || vista === "sustento") ? !puedeCrear : !puedeLeer)
    return (
      <p>
        No tienes permisos para gestionar documentos. Comunícate con el
        administrador de tu empresa.
      </p>
    );
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-slate-900">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600">{vista === "factura" ? <FacturaIcon className="h-6 w-6"/> : <DocumentosIcon className="h-6 w-6"/>}</span>
          {nombre || ({ lista: "Facturas y sustentos", factura: "Cargar factura", sustento: "Cargar sustento", actividad: "Actividad de documentos", descargas: "Descargas del mes" }[vista])}
        </h1>
        <p className="mt-2 text-slate-600">
          Facturas y sustentos organizados por año y mes.
        </p>
      </header>
      {vista === "lista" && puedeCrear && (
        <div className="flex flex-wrap gap-3">
          <Link href={`${baseCarga}/cargar-factura`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:border-violet-400 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
            <FacturaIcon className="h-5 w-5"/> Cargar factura
          </Link>
          <Link href={`${baseCarga}/cargar-sustento`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
            <DocumentosIcon className="h-5 w-5"/> Cargar sustento
          </Link>
        </div>
      )}
      {error && !editando && !eliminando && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {mensaje}
        </p>
      )}
      {mensaje && formulario && <Link href={baseDocumentos} className={boton}><DocumentosIcon className="h-5 w-5"/> Consultar facturas y sustentos</Link>}
      {formulario && (
        <form
          onSubmit={subir}
          className="space-y-4 rounded-2xl border bg-white p-5"
        >
          {camposPeriodo()}
          <p className="text-sm text-slate-600">
            Selecciona el mes al que corresponde el documento, aunque lo estés
            subiendo después. La fecha de carga se registra automáticamente.
          </p>
          {formulario === "sustento" && (
            <label className="block">
              Tipo de sustento
              <select className={input} name="categoria" required>
                {categorias.slice(1).map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SelectorDocumento archivo={elegido} onChange={setElegido} onProcessing={setValidandoArchivo} disabled={ocupado}/>
          <label className="block">
            Nota o referencia (obligatoria)
            <textarea
              className={input}
              name="nota"
              required
              maxLength={1000}
              rows={3}
              placeholder={REFERENCIA_EJEMPLO}
            />
          </label>
          <div className="flex gap-3">
            <button className={boton} disabled={ocupado || validandoArchivo || !elegido}>
              <UploadIcon className="h-5 w-5"/> {ocupado ? "Guardando…" : "Guardar documento"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              disabled={ocupado}
              onClick={() => { window.location.assign(empresaId ? baseDocumentos : "/dashboard"); }}
            >
              <CloseIcon className="h-4 w-4"/> Cancelar
            </button>
          </div>
        </form>
      )}
      {puedeLeer && (vista === "lista" || vista === "descargas") && (
        <>
          {vista === "lista" && <form role="search" onSubmit={e => {e.preventDefault();setBusqueda(textoBusqueda.trim());setPagina(1);}} className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Buscar por referencia
              <input type="search" value={textoBusqueda} onChange={e => setTextoBusqueda(e.target.value)} maxLength={200} placeholder="Serie, número, razón social u otra referencia" className={`${input} mt-2`}/>
            </label>
            <button className={boton}><SearchIcon/> Buscar</button>
            {busqueda && <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50" onClick={() => {setTextoBusqueda("");setBusqueda("");setPagina(1);}}>Limpiar búsqueda</button>}
          </form>}
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Año
              <select
                className={input}
                value={anio}
                onChange={(e) => {
                  const nuevoAnio = Number(e.target.value);
                  setAnio(nuevoAnio);
                  if (!nuevoAnio) setMes(0);
                  setPagina(1);
                }}
              >
                {vista === "lista" && <option value={0}>Todos los años</option>}
                {anios.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mes
              <select
                className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
                disabled={!anio}
                value={mes}
                onChange={(e) => {
                  setMes(Number(e.target.value));
                  setPagina(1);
                }}
              >
                {vista === "lista" && <option value={0}>{anio ? "Todos los meses" : "Primero selecciona un año"}</option>}
                {meses.map((n, i) => (
                  <option key={n} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {vista === "lista" && <label>
              Tipo
              <select
                className={input}
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  setPagina(1);
                }}
              >
                <option value="">Todos</option>
                {categorias.map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </label>}
            {vista === "lista" && <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setRevision((v) => v + 1)}
            >
              Actualizar
            </button>}
          </div>
          {vista === "lista" && <>
          <div aria-busy={cargando} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Facturas y sustentos · {mes ? meses[mes - 1] : "Todos los meses"} · {anio || "Todos los años"}</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th scope="col" className="px-5 py-4">Tipo</th><th scope="col" className="px-5 py-4">Referencia</th><th scope="col" className="px-5 py-4">Periodo</th><th scope="col" className="px-5 py-4">Cargado el</th><th scope="col" className="px-5 py-4 text-right">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargando ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Cargando documentos…</td></tr> : docs.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No hay documentos con estos filtros.</td></tr> : docs.map(doc => <tr key={doc.id} className="hover:bg-blue-50/30">
                    <td className="px-5 py-4"><span className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{categorias.find(([c]) => c === doc.categoria)?.[1]}</span></td>
                    <td className="max-w-[300px] whitespace-pre-wrap break-words px-5 py-4 font-medium text-slate-800">{doc.nota || "Sin referencia"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{meses[doc.mes - 1]} {doc.anio}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{fecha(doc.fechaCarga)}<p className="mt-1 text-slate-400">{doc.autor || "Usuario"}</p></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button type="button" disabled={ocupado} className={accion} title="Ver archivo" aria-label={`Ver ${doc.nota || "documento sin referencia"}`} onClick={() => void abrir(doc)}><EyeIcon/></button>
                      {puedeEditar && <button type="button" disabled={ocupado} className={accion} title="Editar documento" aria-label={`Editar ${doc.nota || "documento sin referencia"}`} onClick={() => {setError("");setArchivoEdicion(null);setEditando(doc);setFormulario(null);}}><EditIcon/></button>}
                      {!empresaId && puede("DOCUMENTO_MENSUAL_DELETE") && <button type="button" disabled={ocupado} className={`${accion} text-red-600 hover:bg-red-50`} title="Eliminar documento" aria-label={`Eliminar ${doc.nota || "documento sin referencia"}`} onClick={() => {setError("");setEliminando(doc);}}><DeleteIcon/></button>}
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row">
              <p className="text-sm text-slate-500">{total ? `Mostrando ${(pagina - 1) * DOCUMENTOS_POR_PAGINA + 1} a ${Math.min(pagina * DOCUMENTOS_POR_PAGINA, total)} de ${total} documentos` : "0 documentos"}</p>
              <nav aria-label="Paginación" className="flex items-center gap-1.5">
                <button type="button" className={paginaBoton} disabled={pagina === 1 || cargando} aria-label="Página anterior" onClick={() => setPagina(p => p - 1)}>‹</button>
                {paginas.map((p, i) => p === "…" ? <span key={`salto-${i}`} className="px-1 text-slate-400">…</span> : <button type="button" key={p} disabled={cargando} aria-label={`Página ${p}`} aria-current={p === pagina ? "page" : undefined} className={`${paginaBoton} ${p === pagina ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-slate-600"}`} onClick={() => setPagina(p)}>{p}</button>)}
                <button type="button" className={paginaBoton} disabled={pagina >= totalPaginas || cargando} aria-label="Página siguiente" onClick={() => setPagina(p => p + 1)}>›</button>
              </nav>
            </div>
          </div></>}
        </>
      )}
      {editando && (
        <ModalDocumento titulo="Editar documento" ocupado={ocupado || validandoArchivo} onClose={() => setEditando(null)}>
        <form
          key={editando.id}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const referencia = String(data.get("nota") || "").trim();
            if (!referencia) { setError(REFERENCIA_EJEMPLO); return; }
            data.set("nota", referencia);
            if (archivoEdicion && archivoEdicion.size > 10 * 1024 * 1024) { setError("El archivo no debe superar 10 MB"); return; }
            if (archivoEdicion) data.set("archivo", archivoEdicion);
            if (
              await operacion(
                `/api/documentos-mensuales/${editando.id}${contextoEmpresa}`,
                {
                  method: "PATCH",
                  ...(archivoEdicion ? { body: data } : {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ anio: Number(data.get("anio")), mes: Number(data.get("mes")), nota: data.get("nota") }),
                  }),
                },
                "Cambios guardados",
              )
            )
              setEditando(null);
          }}
        >
          <p className="break-words text-sm text-slate-500">{editando.nota || "Completa la referencia de este documento."}</p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {camposPeriodo(editando.anio, editando.mes)}
          <label className="block">
            Nota o referencia (obligatoria)
            <textarea
              className={input}
              name="nota"
              defaultValue={editando.nota || ""}
              required
              placeholder={REFERENCIA_EJEMPLO}
              maxLength={1000}
            />
          </label>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Reemplazar foto o documento (opcional)</p>
            <SelectorDocumento archivo={archivoEdicion} onChange={setArchivoEdicion} onProcessing={setValidandoArchivo} disabled={ocupado}/>
            {!archivoEdicion && <p className="text-xs text-slate-500">Si no seleccionas otro archivo, se conserva el actual.</p>}
          </div>
          <p className="text-sm">La fecha original de carga se conserva.</p>
          <button className={boton} disabled={ocupado || validandoArchivo}>
            Guardar cambios
          </button>
          <button
            type="button"
            className="ml-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            disabled={ocupado}
            onClick={() => setEditando(null)}
          >
            Cancelar
          </button>
        </form>
        </ModalDocumento>
      )}
      {eliminando && (
        <ModalDocumento titulo="Eliminar documento" peligro ocupado={ocupado} onClose={() => setEliminando(null)}>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <p className="break-all">
            ¿Eliminar «{eliminando.nota || "documento sin referencia"}»? El archivo se retirará. El
            evento quedará en la actividad.
          </p>
          <button
            disabled={ocupado}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            onClick={async () => {
              if (
                await operacion(
                  `/api/documentos-mensuales/${eliminando.id}`,
                  { method: "DELETE" },
                  "Documento eliminado",
                )
              )
                setEliminando(null);
            }}
          >
            <DeleteIcon/> {ocupado ? "Eliminando…" : "Eliminar documento"}
          </button>
          <button
            className="ml-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            disabled={ocupado}
            data-modal-initial-focus
            onClick={() => setEliminando(null)}
          >
            Cancelar
          </button>
        </ModalDocumento>
      )}
      {puedeExportar && (
        <div className="space-y-3 rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold">
            Descargar PDF · {meses[mes - 1]} {anio}
          </h2>
          <p className="text-sm text-slate-600">
            Elige el año, el mes y los tipos que necesitas. Cada foto ocupa su propia página; los PDF conservan todas sus páginas. Nunca se mezclan documentos distintos en una misma página.
          </p>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-slate-700">Tipos de documentos a descargar</legend>
            {categorias.map(([c, n]) => {
              const estilo = estilosCategoria[c];
              const Icono = estilo.Icono;
              return <label key={c} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-blue-400 ${seleccion.includes(c) ? estilo.seleccionado : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                <input
                  type="checkbox"
                  className={`h-4 w-4 shrink-0 ${estilo.acento}`}
                  checked={seleccion.includes(c)}
                  onChange={(e) =>
                    setSeleccion((v) =>
                      e.target.checked ? [...v, c] : v.filter((x) => x !== c),
                    )
                  }
                />
                <span className={`shrink-0 rounded-lg p-2 ${estilo.icono}`}><Icono className="h-5 w-5"/></span><span className="text-sm font-medium text-slate-800">{n}</span>
              </label>;
            })}
          </fieldset>
          <p className="text-xs text-slate-500">
            Máximo 100 archivos, 50 MB de originales y 500 páginas. Copia para
            consulta; conserva los originales si necesitas sus firmas digitales.
          </p>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={ocupado || !seleccion.length}
            onClick={() => void exportar()}
          >
            <DownloadIcon/> {ocupado ? "Procesando…" : "Descargar PDF"}
          </button>
        </div>
      )}
      {puedeLeer && vista === "actividad" && (
        <div>
          {actividad && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">
                Últimos 100 eventos de la empresa, incluidos documentos
                eliminados.
              </p>
              {eventos.map((e) => (
                <article key={e.id} className="rounded-xl border bg-white p-3">
                  <p>
                    {
                      (
                        {
                          CARGA: "Documento cargado",
                          EDICION: "Documento editado",
                          ELIMINACION: "Documento eliminado",
                        } as Record<string, string>
                      )[e.accion]
                    }
                  </p>
                  <p className="text-sm">
                    {String(
                      (e.despues || e.antes)?.nota || "Sin referencia",
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.autor || "Usuario"} · {fecha(e.fecha)}
                  </p>
                  {e.accion === "EDICION" && (
                    <p className="text-sm">
                      {e.despues?.archivoReemplazado === true && <span className="block">Archivo reemplazado: {String(e.antes?.archivoNombre || "Original")} → {String(e.despues?.archivoNombre || "Nuevo archivo")}</span>}
                      Periodo anterior: {String(e.antes?.mes)}/
                      {String(e.antes?.anio)} · nuevo: {String(e.despues?.mes)}/
                      {String(e.despues?.anio)}. Nota anterior:{" "}
                      {String(e.antes?.nota || "Sin nota")} · nueva:{" "}
                      {String(e.despues?.nota || "Sin nota")}
                    </p>
                  )}
                </article>
              ))}
              {!eventos.length && <p>No hay actividad registrada.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
