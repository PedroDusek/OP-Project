import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { FeedbackForm } from '@/components/account/feedback-form'
import { FEEDBACK_MAX } from '@/server/application/account'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Enviar feedback' }

/**
 * Enviar feedback (decisão 096). Para todos os planos: é por aqui que quem usa o
 * ColeXa conta o que falta, e cobrar por isso seria cobrar para ajudar.
 */
export default async function FeedbackPage() {
  await requireViewer('/conta/feedback')

  return (
    <>
      <PageHeader
        title="Enviar feedback"
        description="Conte o que funcionou, o que atrapalhou e o que faria o ColeXa melhor para você."
      />
      <FeedbackForm max={FEEDBACK_MAX} />
    </>
  )
}
