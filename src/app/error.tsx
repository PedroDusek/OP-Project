'use client'

import { ErrorScreen } from '@/components/layout/error-screen'

/** Erro numa página (decisão 092). O layout raiz continua de pé: tema e fontes valem. */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />
}
