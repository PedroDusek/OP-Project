'use client'

import './globals.css'
import { ErrorScreen } from '@/components/layout/error-screen'

/**
 * Erro no próprio layout raiz (decisão 092). Substitui o layout inteiro, então
 * precisa do próprio `<html>` e do CSS.
 */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full font-sans">
        <ErrorScreen {...props} />
      </body>
    </html>
  )
}
