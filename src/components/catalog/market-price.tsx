import { Panel } from '@/components/ui/surface'
import type { MarketPrice } from '@/server/application/prices'

/**
 * O preço de mercado da carta.
 *
 * ## Por que em dólar, e dizendo que é dólar
 *
 * A cotação vem do TCGplayer, que é mercado americano (decisão 050). Converter
 * para real exigiria uma taxa de câmbio — outra fonte, outra data de captura —
 * e o número resultante pareceria o preço brasileiro sem ser: o mercado daqui
 * tem imposto, frete e escassez próprios. Então mostra-se o valor como ele é,
 * dito em voz alta como referência internacional, e o link da Liga logo abaixo
 * continua sendo o caminho para o preço em real.
 *
 * ## "Desde", e não "atualizado em"
 *
 * A série histórica só ganha linha quando o valor muda, então a data que
 * existe é a da última **mudança**. Escrever "atualizado em 12/08" numa carta
 * conferida hoje de manhã seria falso; "desde 12/08" é exatamente o que a
 * linha diz.
 *
 * ## Paralela sem preço não é bug
 *
 * O código identifica a carta, não a arte: a paralela é outra impressão, com
 * outro valor. A fonte distingue as artes pelo nome do produto e o nosso
 * catálogo só separa Normal de Parallel (decisão 023) — não há como dizer qual
 * paralela é qual. Mostrar o preço da comum ali seria inventar um número num
 * campo de dinheiro, então o painel diz por que está vazio em vez de sumir: a
 * ausência sem explicação vira dúvida sobre o produto.
 */
export function MarketPricePanel({
  price,
  variantType,
}: {
  price: MarketPrice | null
  /** `Normal` é a arte comum, a única que a fonte identifica sem ambiguidade. */
  variantType: string
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text">Preço de mercado</h2>

      <Panel className="px-4 py-3">
        {price ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-2xl font-bold tracking-tight text-text tabular-nums">
              {formatUsd(price.value)}
            </p>
            <p className="text-xs text-text-muted">desde {formatDate(price.since)}</p>
            <p className="w-full text-xs text-text-muted">
              Referência internacional, em dólar, do TCGplayer. Não é o preço no Brasil.
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{semPreco(variantType)}</p>
        )}
      </Panel>
    </section>
  )
}

/**
 * O motivo de não haver preço, que é diferente para paralela e para comum.
 *
 * Paralela é uma limitação conhecida e permanente até as artes serem mapeadas
 * uma a uma; arte comum sem preço é a carta que a fonte não anuncia — promo de
 * evento, quase sempre. Dizer "sem preço" nos dois casos faria a pessoa achar
 * que o produto quebrou.
 */
function semPreco(variantType: string): string {
  return variantType === 'Normal'
    ? 'Sem cotação na fonte para esta carta.'
    : 'Artes paralelas ainda não têm preço: a fonte não distingue qual paralela é qual.'
}

/**
 * Dólar com duas casas.
 *
 * `en-US` e não `pt-BR` de propósito: `US$ 12,34` com vírgula decimal mistura
 * duas convenções e faz o valor parecer convertido. O que está escrito é o que
 * a fonte cotou.
 */
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

/**
 * Data em português, no fuso de São Paulo.
 *
 * O fuso é fixo e não o do navegador porque isto renderiza no servidor: sem
 * fixar, a data trocaria entre a versão em cache e a recém-gerada.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value)
}
