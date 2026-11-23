import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { TERMINOS_AUDIVARE } from '@/config/legal';

export const metadata: Metadata = { title: 'Términos de uso | AudiVare' };

export default function TerminosPage() {
  return <LegalDocument documento={TERMINOS_AUDIVARE} />;
}
