import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthHeading } from '@/components/auth/form-parts'
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/server/application/account'

export const metadata: Metadata = { title: 'Exclusão pedida', robots: { index: false } }

/**
 * Depois de pedir a exclusão da conta (decisão 091). A sessão já foi encerrada,
 * por isso mora nas telas de conta, e não dentro do app.
 */
export default function ExclusaoSolicitadaPage() {
  return (
    <>
      <AuthHeading
        title="Pedido recebido"
        description={`Sua conta está suspensa e será excluída em ${ACCOUNT_DELETION_GRACE_DAYS} dias. Enviamos um e-mail com a data.`}
      />
      <p className="text-sm text-text-muted">
        Se mudar de ideia, basta entrar de novo antes do prazo: o pedido é cancelado na hora.
      </p>
      <p className="mt-8 text-center text-sm text-text-muted">
        <Link href="/entrar" className="font-medium text-accent-ink underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  )
}
