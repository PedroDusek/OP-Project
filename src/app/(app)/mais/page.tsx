import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { ThemeControl } from '@/components/theme/theme-control'
import { Panel, PanelList, ListRow } from '@/components/ui/surface'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DESTINATIONS } from '@/components/layout/navigation'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { currentViewer } from '@/server/http/viewer'
import { isPremium } from '@/server/application/authorization'

export const metadata: Metadata = { title: 'Mais' }

/**
 * Mais.
 *
 * Secao 4: armazenamento, perfil, Premium e configuracoes. Destes existem hoje
 * a identidade de quem esta logado, a aparencia e sair da conta — e existem de
 * verdade, nao como demonstracao.
 *
 * As outras entradas nao aparecem como itens desabilitados de proposito. Uma
 * lista de seis linhas em que cinco nao levam a lugar nenhum ensina a pessoa a
 * nao tocar na lista.
 */
export default async function MaisPage() {
  // O layout ja exigiu sessao; aqui ela so e lida de novo para os dados.
  const viewer = await currentViewer()

  return (
    <>
      <PageHeader title="Mais" description="Sua conta e suas preferências." />

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
          <h2 className="text-sm font-semibold text-text">Seções</h2>
          <PanelList>
            {DESTINATIONS.filter((destination) => destination.href !== '/mais').map(
              (destination) => (
                <ListRow
                  key={destination.href}
                  href={destination.href}
                  leading={
                    <destination.icon className="size-5 text-text-muted" aria-hidden />
                  }
                  title={destination.label}
                  description={destination.description}
                />
              ),
            )}
          </PanelList>
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
