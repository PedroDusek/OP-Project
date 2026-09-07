import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/app-shell'
import { ThemeControl } from '@/components/theme/theme-control'
import { Panel, PanelList, ListRow } from '@/components/ui/surface'
import { DESTINATIONS } from '@/components/layout/navigation'

export const metadata: Metadata = { title: 'Mais' }

/**
 * Mais.
 *
 * Secao 4: armazenamento, perfil, Premium e configuracoes. Destes, so a
 * aparencia existe hoje — e existe de verdade, nao como demonstracao: a escolha
 * de tema vale na hora e sobrevive ao recarregamento.
 *
 * As outras entradas nao aparecem como itens desabilitados de proposito. Uma
 * lista de seis linhas em que cinco nao levam a lugar nenhum ensina a pessoa a
 * nao tocar na lista.
 */
export default function MaisPage() {
  return (
    <>
      <PageHeader title="Mais" description="Preferências e o resto da sua conta." />

      <div className="flex flex-col gap-6">
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
      </div>
    </>
  )
}
