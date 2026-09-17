import type { Metadata } from 'next'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { NetworkMemberBox } from '@/components/social/network-member'
import { NetworkSearch } from '@/components/social/network-search'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { getUsernameState, listNetwork, type NetworkPage } from '@/server/application/social'
import { RateLimitError } from '@/server/domain/errors'
import { requireViewer } from '@/server/http/viewer'

export const metadata: Metadata = { title: 'Social' }

/**
 * A rede (regras 6.1.2 a 6.1.4, decisões 060 e 079).
 *
 * Quem tem cartas para troca, cada pessoa numa caixa com a prévia — Premium
 * primeiro, depois quem tem mais do que quem olha procura. A busca por carta
 * devolve quem a tem, na mesma apresentação.
 *
 * A lista cresce ao pedir mais pessoas, e não troca de página: o endereço guarda
 * até onde se carregou, e voltar de um binder devolve a lista inteira. O teto
 * de páginas mora no domínio (`NETWORK_MAX_PAGES`).
 *
 * A tela continua cobrando o nome de usuário de quem ainda não escolheu: sem
 * ele, a pessoa vê a rede, mas ninguém a vê.
 */
export default async function SocialPage({ searchParams }: PageProps<'/social'>) {
  const viewer = await requireViewer('/social')
  const params = await searchParams
  const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) ?? null

  const [{ username }, resultado] = await Promise.all([
    getUsernameState(viewer),
    listNetwork(viewer, { query: primeiro(params.q), page: primeiro(params.pagina) }).catch((error: unknown) => {
      if (error instanceof RateLimitError) return error
      throw error
    }),
  ])

  return (
    <>
      <PageHeader title="Social" description="Quem tem o que você procura, e quem procura o que você tem." />

      <div className="flex flex-col gap-4">
        {username ? null : (
          <Panel className="px-4 py-3">
            <p className="text-sm text-text">
              Escolha seu nome na rede em{' '}
              <Link href="/conta" className="font-medium text-accent-ink hover:underline">
                Minha conta
              </Link>
              . Sem ele, você vê a rede, mas não aparece para ninguém.
            </p>
          </Panel>
        )}

        <NetworkSearch initial={resultado instanceof RateLimitError ? '' : (resultado.query ?? '')} />

        {resultado instanceof RateLimitError ? (
          <ErrorState
            title="Muitas consultas seguidas"
            description={`Espere ${resultado.retryAfterSeconds} segundos e tente de novo.`}
          />
        ) : (
          <Rede resultado={resultado} />
        )}
      </div>
    </>
  )
}

function Rede({ resultado }: { resultado: NetworkPage }) {
  if (resultado.members.length === 0) {
    return resultado.query ? (
      <EmptyState
        icon={<Users className="size-10" aria-hidden />}
        title={
          resultado.viewerHasMatch
            ? `Só você tem "${resultado.query}" para troca na rede`
            : `Nada na rede para "${resultado.query}"`
        }
        description={
          resultado.viewerHasMatch
            ? 'A carta está no seu Trade Binder. Você não aparece na sua própria busca — as outras pessoas veem você quando buscam por ela.'
            : 'Ninguém com esse nome tem cartas para troca, e ninguém tem essa carta no Trade Binder. Tente o código da carta, ou o nome da pessoa com @.'
        }
      />
    ) : (
      <EmptyState
        icon={<Users className="size-10" aria-hidden />}
        title="Ninguém na rede tem cartas para troca ainda"
        description="Quando alguém guardar cartas num local de troca, aparece aqui."
      />
    )
  }

  const mais = new URLSearchParams()
  if (resultado.query) mais.set('q', resultado.query)
  mais.set('pagina', String(resultado.page + 1))

  return (
    <>
      <ul className="flex flex-col gap-3">
        {resultado.members.map((member) => (
          <li key={member.username}>
            <NetworkMemberBox member={member} />
          </li>
        ))}
      </ul>
      {resultado.hasMore ? (
        <Link
          href={`/social?${mais.toString()}`}
          scroll={false}
          className="mx-auto inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-medium text-text hover:bg-surface-muted"
        >
          Ver mais pessoas
        </Link>
      ) : null}
    </>
  )
}
