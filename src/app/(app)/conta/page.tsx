import type { Metadata } from 'next'
import { UsernameForm } from '@/components/social/username-form'
import { getUsernameState } from '@/server/application/social'
import { PageHeader } from '@/components/layout/app-shell'
import { ThemeControl } from '@/components/theme/theme-control'
import { Panel, PanelList, ListRow } from '@/components/ui/surface'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { currentViewer } from '@/server/http/viewer'
import { isPremium } from '@/server/application/authorization'

export const metadata: Metadata = { title: 'Minha conta' }

/**
 * Minha conta.
 *
 * Quem voce e, o nome que a rede ve, e as preferencias do aplicativo. Deixou de
 * ser "Mais" — uma gaveta de tudo que nao coubera na barra — quando a navegacao
 * virou gaveta e passou a caber inteira (decisao 061).
 *
 * A lista de secoes saiu daqui pelo mesmo motivo: ela existia porque a barra de
 * cinco escondia destinos, e agora nenhum esta escondido. Repeti-la seria um
 * segundo lugar para navegar, que discordaria do primeiro no dia em que alguem
 * acrescentasse um destino e esquecesse deste.
 */
export default async function MaisPage() {
  // O layout ja exigiu sessao; aqui ela so e lida de novo para os dados.
  const viewer = await currentViewer()
  const username = viewer ? await getUsernameState(viewer) : null

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados, sua identidade na rede e as preferências." />

      <div className="flex flex-col gap-6">
        {viewer ? (
          <Panel className="flex items-center gap-3 p-4">
            <Avatar name={viewer.name} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate text-lg font-semibold text-text">{viewer.name}</p>
              <p className="truncate text-sm text-text-muted">{viewer.email}</p>
              {isPremium(viewer) ? (
                <span className="mt-0.5">
                  <Badge tone="accent">Membro Premium</Badge>
                </span>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {username ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text">Sua identidade na rede</h2>
            <UsernameForm state={username} />
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text">Aparência</h2>
          <Panel className="p-3">
            <ThemeControl />
            <p className="mt-3 text-xs text-text-muted">
              Em Sistema, o ColeXa acompanha o tema do seu aparelho. A escolha vale neste
              dispositivo.
            </p>
          </Panel>
        </section>



        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text">Sobre</h2>
          <PanelList>
            <ListRow title="ColeXa" description="Sua coleção. Do seu jeito." hideChevron />
            {/*
              Atribuição visível é uma das mitigações obrigatórias da decisão
              020, e não um rodapé de cortesia: é parte do que sustenta o uso do
              catálogo da fonte.
            */}
            <ListRow
              title="Fonte do catálogo"
              description="Dados de cartas do site oficial do One Piece Card Game, da Bandai. O ColeXa não tem vínculo, parceria ou endosso da Bandai."
              hideChevron
            />
          </PanelList>
        </section>

        <PanelList>
          <SignOutButton />
        </PanelList>
      </div>
    </>
  )
}
