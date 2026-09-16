import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/ui/surface'
import type { NetworkMember } from '@/server/application/social'

/**
 * Uma pessoa na rede, no desenho do dono do produto: o nome em cima e uma prévia
 * de até sete cartas rolando na horizontal dentro da caixa. Tocar no nome abre o
 * Trade Binder inteiro.
 *
 * A prévia é uma faixa com rolagem própria, e não um link inteiro: rolar com o
 * dedo sobre um link abriria a página no primeiro toque que parasse a rolagem.
 * Cada carta também leva ao binder, porque é onde o olho está.
 *
 * O que aparece é tudo o que pode aparecer (regra 6.1.2): o nome e as cartas
 * disponíveis. "Você procura" é sobre quem olha — é a want list **dele** —, e
 * nunca diz nada da want list da outra pessoa.
 */
export function NetworkMemberBox({ member }: { member: NetworkMember }) {
  const href = `/social/${member.username}`

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <Link href={href} className="group flex items-center gap-2" aria-label={`Trade Binder de @${member.username}`}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-text group-hover:underline">@{member.username}</span>
            {member.premium ? <Badge tone="accent">Premium</Badge> : null}
          </p>
          <p className="text-sm text-text-muted tabular-nums">
            {member.cards} {member.cards === 1 ? 'carta' : 'cartas'} para troca
            {member.interest > 0 ? (
              <>
                {' · '}
                <span className="font-medium text-success">
                  {member.interest} que você procura
                </span>
              </>
            ) : null}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-text-subtle" aria-hidden />
      </Link>

      <ul
        className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1"
        aria-label={`Prévia das cartas de @${member.username}`}
      >
        {member.preview.map((card) => (
          <li key={card.variantId} className="w-24 shrink-0 snap-start">
            <Link href={href} className="flex flex-col gap-1" tabIndex={-1}>
              <span className="relative block">
                <CardArt src={card.imageUrl} alt={`${card.cardCode} — ${card.cardName}`} fallback={card.cardCode} sizes="96px" />
                <span className="absolute right-1 bottom-1 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                  x{card.quantity}
                </span>
              </span>
              <span className="truncate text-xs font-semibold text-text tabular-nums">{card.cardCode}</span>
              {card.wanted ? (
                <Badge tone="success">Você procura</Badge>
              ) : card.variantType !== 'Normal' ? (
                <Badge tone="accent">{card.variantType}</Badge>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
