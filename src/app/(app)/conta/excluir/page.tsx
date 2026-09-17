import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { DeleteAccountForm } from '@/components/account/delete-account-form'
import { Panel } from '@/components/ui/surface'
import { ACCOUNT_DELETION_CONFIRMATION, ACCOUNT_DELETION_GRACE_DAYS } from '@/server/application/account'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Excluir conta' }

/**
 * Excluir a conta (decisões 015 e 091).
 *
 * Diz, antes de pedir, o que acontece na hora, o que acontece no fim do prazo e
 * o que fica. Quem exclui precisa saber que as trocas em andamento são canceladas
 * **agora**, e não daqui a trinta dias.
 */
export default async function ExcluirContaPage() {
  await requireViewer('/conta/excluir')

  return (
    <>
      <PageHeader
        title="Excluir conta"
        description={`Você tem ${ACCOUNT_DELETION_GRACE_DAYS} dias para desistir.`}
      />

      <div className="flex flex-col gap-5">
        <Panel className="flex flex-col gap-3 p-4 text-sm text-text">
          <h2 className="font-semibold">Assim que você pedir</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-text-muted">
            <li>Você sai da conta, em todos os aparelhos.</li>
            <li>Seu perfil some da rede, e o link do seu Trade Binder sai do ar.</li>
            <li>As trocas que ainda não foram concluídas são canceladas.</li>
            <li>Enviamos um e-mail com a data da exclusão.</li>
          </ul>

          <h2 className="pt-1 font-semibold">Depois de {ACCOUNT_DELETION_GRACE_DAYS} dias</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-text-muted">
            <li>Seu nome, seu e-mail, seu nome na rede, sua coleção, seus binders e sua want list são apagados.</li>
            <li>Não é possível recuperar nada depois disso.</li>
            <li>
              Trocas concluídas e mensagens enviadas continuam para a outra pessoa, com o nome
              &ldquo;Conta excluída&rdquo;.
            </li>
          </ul>

          <h2 className="pt-1 font-semibold">Mudou de ideia?</h2>
          <p className="text-text-muted">
            Entre de novo na sua conta antes do prazo, e o pedido é cancelado na hora. As trocas
            canceladas não voltam.
          </p>
        </Panel>

        <DeleteAccountForm confirmation={ACCOUNT_DELETION_CONFIRMATION} />
      </div>
    </>
  )
}
