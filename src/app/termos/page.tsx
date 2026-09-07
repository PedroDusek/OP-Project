import type { Metadata } from 'next'
import { LegalPending } from '@/components/legal/legal-pending'

export const metadata: Metadata = { title: 'Termos de Uso' }

export default function TermosPage() {
  return (
    <LegalPending
      title="Termos de Uso"
      description="O texto dos Termos de Uso do ColeXa ainda está em preparação."
    />
  )
}
