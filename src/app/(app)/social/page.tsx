import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { getUsernameState } from '@/server/application/social'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Social' }

/**
 * Social.
 *
 * A rede ainda não existe: as regras estão escritas (`business-rules.md` 6.1.1
 * a 6.1.4) e a identidade está construída, mas a listagem, a busca por carta e
 * o bloqueio não.
 *
 * A tela existe assim mesmo porque o destino está na navegação por escolha do
 * dono do produto, e um destino que não leva a nada é pior que um que explica.
 * Ela também faz uma coisa útil hoje: cobra o nome de usuário de quem ainda não
 * escolheu — sem ele, ninguém aparece para ninguém quando a rede abrir.
 */
export default async function SocialPage() {
  const viewer = await requireViewer('/social')
  const { username } = await getUsernameState(viewer)

  return (
    <>
      <PageHeader
        title="Social"
        description="Quem tem o que você procura, e quem procura o que você tem."
      />

      <div className="flex flex-col gap-4">
        {username ? (
          <Panel className="px-4 py-3">
            <p className="text-sm text-text">
              Você aparecerá como <strong>@{username}</strong>.
            </p>
          </Panel>
        ) : (
          <Panel className="px-4 py-3">
            <p className="text-sm text-text">
              Escolha seu nome na rede em <strong>Minha conta</strong>. Sem ele, você não aparece
              para ninguém quando a rede abrir.
            </p>
          </Panel>
        )}

        <EmptyState
          icon={<Users className="size-10" aria-hidden />}
          title="A rede ainda não está aberta"
          description="Aqui você vai ver o Trade Binder de outras pessoas e buscar quem tem uma carta específica. Enquanto isso, dá para trocar com quem você já conhece: comece uma troca em Trocas e mande o convite."
          action={{ label: 'Ir para Trocas', href: '/trocas' }}
        />
      </div>
    </>
  )
}
