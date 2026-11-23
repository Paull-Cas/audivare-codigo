import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { PRIVACIDAD_AUDIVARE } from '@/config/legal';

export const metadata: Metadata = { title: 'Política de privacidad | AudiVare' };

export default function PoliticaPrivacidadPage() {
  return <LegalDocument documento={PRIVACIDAD_AUDIVARE} />;
}
