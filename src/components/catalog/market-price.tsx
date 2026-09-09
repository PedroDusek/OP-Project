import { Panel } from '@/components/ui/surface'
import type { MarketPrice, PriceFreshness } from '@/server/application/prices'

/**
 * O preço de mercado da carta.
 *
 * ## Dólar em cima, real embaixo, e a cotação à vista
 *
 * A cotação vem do TCGplayer, que é mercado americano. O real aparece porque é
 * a moeda de quem usa o produto — mas convertido, e dizendo por quanto: sem a
 * taxa escrita, o número em real vira uma afirmação sobre o mercado brasileiro
 * que ele não é. Com a taxa, é o que ele realmente é: o preço lá, em reais de
 * hoje (decisão 051).
 *
 * O dólar continua sendo o valor principal por isso mesmo — ele é o dado; o
 * real é a leitura dele. O link da Liga, logo abaixo, continua sendo o caminho
 * para o preço praticado no Brasil.
 *
 * Sem cotação recente o real some e o dólar fica. Converter por uma taxa velha
 * seria apresentar um palpite com cara de dado.
 *
 * ## Duas datas, e nenhuma delas mente
 *
 * "Atualizado hoje às 04:00" fala da **conferência**, e vem do registro de
 * importação. A data de quando o preço mudou não entra aqui: num common estável
 * ela é de semanas atrás e faria o produto parecer abandonado.
 *
 * Quando o dado do mercado é de outro dia — e é o caso normal, porque o espelho
 * publica às 17:00 e a importação roda de madrugada —, a linha diz as duas
 * coisas. Dizer só a nossa daria a entender que o mercado foi lido às 04:00.
 *
 * ## Paralela sem preço não é bug
 *
 * O código identifica a carta, não a arte: a paralela é outra impressão, com
 * outro valor. Mostrar o preço da comum ali seria inventar um número num campo
 * de dinheiro, então o painel diz por que está vazio em vez de sumir — a
 * ausência sem explicação vira dúvida sobre o produto.
 */
export function MarketPricePanel({
  price,
  variantType,
  freshness = null,
}: {
  price: MarketPrice | null
  /** `Normal` é a arte comum, a única que a fonte identifica sem ambiguidade. */
  variantType: string
  /** Quando os preços foram conferidos. Ausente antes da primeira importação. */
  freshness?: PriceFreshness | null
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text">Preço de mercado</h2>

      <Panel className="flex flex-col gap-2 px-4 py-3">
        {price ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-2xl font-bold tracking-tight text-text tabular-nums">
                {formatUsd(price.value)}
              </p>
              {price.brl ? (
                <p className="text-lg font-semibold text-text-muted tabular-nums">
                  {formatBrl(price.brl.value)}
                </p>
              ) : null}
            </div>

            {price.brl ? (
              <p className="text-xs text-text-muted tabular-nums">
                Dólar a {formatBrl(price.brl.rate)} — PTAX do Banco Central de{' '}
                {formatCalendarDate(price.brl.rateDate)}.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-text-muted">{semPreco(variantType)}</p>
        )}

        <p className="text-xs text-text-subtle">{sourceNote(freshness)}</p>
      </Panel>
    </section>
  )
}

/**
 * A linha de origem e frescor.
 *
 * Sempre presente, com ou sem preço: quem está olhando uma paralela sem valor
 * também precisa saber de onde o produto tira preço quando tira.
 */
function sourceNote(freshness: PriceFreshness | null): string {
  if (!freshness) return 'Fonte: TCGplayer.'

  const checked = `Fonte: TCGplayer. Atualizado ${relativeDay(freshness.checkedAt)} às ${formatTime(freshness.checkedAt)}`

  // O dado do mercado costuma ser do dia anterior: o espelho publica as 17:00 e
  // a importacao roda de madrugada. Calar isso faria "atualizado hoje as 04:00"
  // parecer uma leitura do mercado naquele instante.
  if (freshness.sourceUpdatedAt && !sameDay(freshness.sourceUpdatedAt, freshness.checkedAt)) {
    return `${checked}, com dados do mercado de ${formatDate(freshness.sourceUpdatedAt)}.`
  }
  return `${checked}.`
}

/**
 * O motivo de não haver preço, que é diferente para paralela e para comum.
 *
 * Paralela é uma limitação conhecida até as artes serem mapeadas uma a uma;
 * arte comum sem preço é a carta que a fonte não anuncia — promo de evento,
 * quase sempre. Dizer "sem preço" nos dois casos faria a pessoa achar que o
 * produto quebrou.
 */
function semPreco(variantType: string): string {
  return variantType === 'Normal'
    ? 'Sem cotação na fonte para esta carta.'
    : 'Artes paralelas ainda não têm preço: a fonte não distingue qual paralela é qual.'
}

/**
 * "hoje", "ontem", ou a data.
 *
 * O pedido do dono do produto é "Atualizado hoje 04:00", e "hoje" só pode ser
 * escrito quando é verdade. No dia em que a importação não rodar, a linha passa
 * a mostrar a data — que é justamente o dia em que essa informação importa.
 */
function relativeDay(value: Date): string {
  const days = daysAgo(value, new Date())
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `em ${formatDate(value)}`
}

const SAO_PAULO = 'America/Sao_Paulo'

/**
 * Dias de calendário entre dois instantes, no fuso de São Paulo.
 *
 * No fuso do produto e não em UTC: às 22h de Brasília já é o dia seguinte em
 * Londres, e a tela diria "ontem" sobre algo de duas horas atrás.
 */
function daysAgo(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((localMidnight(to) - localMidnight(from)) / MS_PER_DAY)
}

function localMidnight(value: Date): number {
  return Date.parse(`${formatIsoDate(value)}T00:00:00Z`)
}

function sameDay(a: Date, b: Date): boolean {
  return formatIsoDate(a) === formatIsoDate(b)
}

/** `en-CA` dá `AAAA-MM-DD`, que é a forma ordenável e comparável. */
function formatIsoDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO }).format(value)
}

/**
 * Dólar com duas casas.
 *
 * `en-US` e não `pt-BR` de propósito: `US$ 12,34` com vírgula decimal mistura
 * duas convenções e faz o valor parecer convertido. O que está escrito é o que
 * a fonte cotou.
 */
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/**
 * Data e hora em português, no fuso de São Paulo.
 *
 * O fuso é fixo e não o do navegador porque isto renderiza no servidor: sem
 * fixar, a data trocaria entre a versão em cache e a recém-gerada.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: SAO_PAULO,
  }).format(value)
}

/**
 * Data de calendário, sem fuso.
 *
 * A data da cotação vem de uma coluna `DATE`: é um dia, não um instante, e
 * chega como meia-noite UTC. Formatá-la em São Paulo a jogaria para as 21h do
 * dia anterior — a cotação de 08/09 apareceria como 07/09. Aqui o dia é lido
 * como ele foi gravado.
 */
function formatCalendarDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(value)
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAO_PAULO,
  }).format(value)
}
