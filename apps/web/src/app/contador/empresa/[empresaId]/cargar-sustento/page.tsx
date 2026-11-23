import DocumentosMensuales from "@/components/DocumentosMensuales";
export default async function Page({params}: {params: Promise<{empresaId: string}>}) {
  const {empresaId} = await params;
  return <DocumentosMensuales empresaId={empresaId} permisos={[]} vista="sustento"/>;
}
