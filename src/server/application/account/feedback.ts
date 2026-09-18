import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { isPremium } from '@/server/application/authorization'
import { ConflictError } from '@/server/domain/errors'
import { feedbackEmail, normalizeFeedback } from '@/server/domain/account/feedback'
import type { Mailer } from '@/server/http/mailer'
import { consumeRateLimit, FEEDBACK_LIMIT } from '@/server/http/rate-limit'

/**
 * Mandar feedback ao suporte (decisão 096).
 *
 * Camada: application.
 *
 * **Não é guardado no banco** — escolha do dono do produto: vai por e-mail e é
 * lá que se lê. Por isso, ao contrário da denúncia, **falhar no envio é erro
 * para quem escreveu**: não existe registro de reserva, e dizer "enviado" sem
 * ter enviado seria perder a mensagem calado.
 */
export async function sendFeedback(
  prisma: PrismaClient,
  mailer: Mailer,
  user: AuthenticatedUser,
  rawMessage: string,
  now: Date = new Date(),
): Promise<void> {
  const message = normalizeFeedback(rawMessage)

  if (!mailer.available) {
    throw new ConflictError('FEEDBACK_INDISPONIVEL', 'O envio de feedback não está disponível agora. Tente mais tarde.')
  }

  consumeRateLimit(`feedback:${user.id}`, FEEDBACK_LIMIT)

  const conta = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { username: true } })

  try {
    await mailer.send(
      feedbackEmail(
        { name: user.name, email: user.email, username: conta.username, premium: isPremium(user, now) },
        message,
        now,
      ),
    )
  } catch (error) {
    console.error('[feedback] envio falhou', {
      userId: String(user.id),
      message: error instanceof Error ? error.message : String(error),
    })
    throw new ConflictError('FEEDBACK_FALHOU', 'Não foi possível enviar agora. Tente de novo em alguns minutos.')
  }
}
