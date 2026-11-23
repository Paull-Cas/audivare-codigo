import { redirect } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  redirect(`/contador/empresa/${empresaId}`);
}