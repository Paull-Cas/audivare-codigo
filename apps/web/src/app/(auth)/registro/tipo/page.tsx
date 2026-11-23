'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SeleccionTipoRegistroPage() {
  const router = useRouter();

  const handleSelectContador = () => {
    router.push('/registro/contador');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-4xl p-8 bg-white rounded-2xl shadow-sm border border-[var(--color-border)] relative">
        <div className="flex flex-col items-center justify-center mb-8">
            <Image src="/logo-audivare.png" alt="Logo" width={64} height={64} className="object-contain mb-4" />
            <h1 className="text-3xl font-bold text-center text-[var(--color-primary)]">¿Cómo quieres usar <Image src="/titulo-audivare.png" alt="AudiVare" width={140} height={32} className="inline-block object-contain translate-y-[-2px]" />?</h1>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <button 
            onClick={() => router.push('/registro/empresa')}
            className="flex flex-col items-center text-center p-8 bg-white border-2 border-transparent shadow-sm rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group disabled:opacity-50"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏢</div>
            <h2 className="text-xl font-bold mb-2 text-[var(--color-text)]">Empresa</h2>
            <p className="text-gray-500 text-sm">Gestiona las facturas y documentos de tu organización</p>
          </button>

          <button 
            onClick={handleSelectContador}
            className="flex flex-col items-center text-center p-8 bg-white border-2 border-transparent shadow-sm rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group disabled:opacity-50"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">👤</div>
            <h2 className="text-xl font-bold mb-2 text-[var(--color-text)]">Contador</h2>
            <p className="text-gray-500 text-sm">Accede a la información contable de tus clientes</p>
          </button>
        </div>
      </div>
    </div>
  );
}
