import type { Metadata } from 'next'
import { LegalPending } from '@/components/legal/legal-pending'

export const metadata: Metadata = { title: 'Política de Privacidade' }

export default function PrivacidadePage() {
  return (
    <LegalPending
      title="Política de Privacidade"
      description="O texto da Política de Privacidade do ColeXa ainda está em preparação."
    />
  )
}
