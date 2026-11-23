import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiUrl } from "@/config/api";
import DocumentosMensuales from "./DocumentosMensuales";
export default async function PantallaMensual({ vista }: { vista: "lista" | "factura" | "sustento" | "actividad" }) {
  const token = (await cookies()).get("token")?.value;
  if (!token) redirect("/login");
  const res = await fetch(`${getApiUrl()}/perfil/permisos`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 401) redirect("/login");
  if (!res.ok) return <p>No se pudo consultar tu acceso. Intenta nuevamente.</p>;
  const datos: { permisos: string[] } = await res.json();
  return <DocumentosMensuales permisos={datos.permisos} vista={vista}/>;
}
