import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Package } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Logotype } from '@/components/brand/logo'
import { Badge } from '@/components/ui/badge'
import { readPublicTradeBinder } from '@/server/application/trades'

/**
 * O Trade Binder publicado, em `/trade/<token>` (regra 6.1).
 *
 * ## Não pede sessão, de propósito
 *
 * É a única página do produto que mostra dado de alguém sem login, e isso é o
 * que ela existe para fazer: quem recebe o link no grupo abre e vê. A proteção
 * não é a sessão — é o token ser longo, aleatório e revogável.
 *
 * Note que ela **não** chama `requireViewer`. Essa ausência é a decisão.
 *
 * ## O que aparece aqui é tudo o que pode aparecer
 *
 * Nome de usuário e as cartas disponíveis para troca. A regra 6.1 é uma lista
 * do que **nunca** aparece — coleção, outros armazenamentos, decks, want list,
 * nome real, e-mail —, e a consulta em `readPublicTradeBinder` é onde isso é
 * garantido. Aqui não há como acrescentar o que ela não trouxe.
 *
 * ## Token inválido e token revogado são a mesma resposta
 *
 * Os dois dão `notFound`. Distinguir contaria a quem tentasse que aquele link
 * já existiu, que é informação sobre uma pessoa que ela decidiu deixar de dar.
 */

export const metadata: Metadata = {
  title: 'Trade Binder',
  /*
   * Fora dos buscadores. O link e para mandar a quem se quer, e nao para ser
   * encontrado — indexar transformaria um endereco compartilhado numa vitrine
   * publica, que e exatamente o que a regra 4.6.1 recusa.
   */
  robots: { index: false, follow: false },
}

export default async function TradeBinderPublicoPage({ params }: PageProps<'/trade/[token]'>) {
  const { token } = await params
  const binder = await readPublicTradeBinder(token)

  if (!binder) notFound()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <Link href="/" className="w-fit" aria-label="ColeXa">
          <Logotype label="ColeXa" className="h-6 w-auto text-text" />
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            O Trade Binder de {binder.username}
          </h1>
          <p className="mt-1 text-sm text-text-muted tabular-nums">
            {binder.cards.length} {binder.cards.length === 1 ? 'carta' : 'cartas'} ·{' '}
            {binder.copies} {binder.copies === 1 ? 'cópia' : 'cópias'} disponíveis para troca
          </p>
        </div>
      </header>

      {binder.cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-subtle"
          >
            <Package className="size-6" />
          </span>
          <p className="text-sm text-text">
            {binder.username} não tem nenhuma carta disponível para troca agora.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {binder.cards.map((card) => (
            <li key={card.variantId} className="flex flex-col gap-1.5">
              <span className="relative block">
                <CardArt
                  src={card.imageUrl}
                  alt={`${card.cardCode} — ${card.cardName}`}
                  fallback={card.cardCode}
                  sizes="(max-width: 639px) 33vw, (max-width: 767px) 25vw, 17vw"
                />
                {/*
                  Fundo próprio, e não um token de superfície: o contador fica
                  sobre arte de qualquer cor, e é o mesmo arranjo de `CardTile`.
                  A primeira versão usava `bg-ink`, que **não é um token deste
                  projeto** — a classe não gerava CSS nenhum, e o texto branco
                  ficava invisível sobre a arte clara.
                */}
                <span className="absolute right-1 bottom-1 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                  x{card.quantity}
                </span>
              </span>
              <span className="truncate text-xs font-semibold text-text tabular-nums">
                {card.cardCode}
              </span>
              <span className="truncate text-xs text-text-muted">{card.cardName}</span>
              {card.variantType !== 'Normal' ? (
                <Badge tone="accent">{card.variantType}</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-border pt-6 text-sm text-text-muted">
        <p>
          Estas cartas estão disponíveis para troca — não estão reservadas para ninguém
          (regra 4.2). Combine direto com {binder.username}.
        </p>
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 font-medium text-accent-ink hover:underline"
        >
          Organize a sua coleção no ColeXa
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        {/*
          A atribuicao acompanha toda tela que mostra carta, e esta e publica —
          e a unica alcancavel por quem nunca entrou no produto.
        */}
        <p className="text-xs text-text-subtle">
          Dados de cartas do site oficial do One Piece Card Game, da Bandai. O ColeXa não tem
          vínculo, parceria ou endosso da Bandai.
        </p>
      </footer>
    </main>
  )
}
