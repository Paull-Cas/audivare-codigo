import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/config/api";

async function reenviar(
  request: NextRequest,
  context: { params: Promise<{ ruta?: string[] }> },
) {
  const token = (await cookies()).get("token")?.value;
  if (!token)
    return NextResponse.json(
      { message: "Inicia sesión nuevamente" },
      { status: 401 },
    );
  const { ruta = [] } = await context.params;
  if (!/^(?:|resumen|actividad|pdf|[0-9a-f-]{36}(?:\/(?:archivo|descarga))?)$/i.test(ruta.join("/")))
    return NextResponse.json({ message: "Ruta inválida" }, { status: 400 });
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  try {
    let body: FormData | string | undefined;
    if (request.method === "POST" || (request.method === "PATCH" && request.headers.get("content-type")?.startsWith("multipart/form-data"))) {
      const length = request.headers.get("content-length");
      if (!length || !/^\d+$/.test(length) || Number(length) > 11 * 1024 * 1024)
        return NextResponse.json(
          {
            message:
              "La carga debe tener tamaño conocido y no superar 10 MB por archivo",
          },
          { status: 413 },
        );
      body = await request.formData();
    } else if (request.method === "PATCH") {
      body = JSON.stringify(await request.json());
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(
      `${getApiUrl()}/documentos-mensuales${ruta.length ? "/" + ruta.join("/") : ""}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      },
    );
    if (res.ok && (ruta[0] === "pdf" || ruta[1] === "descarga"))
      return new NextResponse(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition":
            res.headers.get("content-disposition") ||
            'attachment; filename="audivare.pdf"',
          "Cache-Control": "private, no-store",
        },
      });
    return NextResponse.json(
      await res
        .json()
        .catch(() => ({ message: "No se pudo completar la operación" })),
      { status: res.status },
    );
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar. Intenta nuevamente." },
      { status: 502 },
    );
  }
}
export const GET = reenviar;
export const POST = reenviar;
export const PATCH = reenviar;
export const DELETE = reenviar;
