import {
  PARAM,
  toApiQuery,
  toCatalogQuery,
  type CatalogSearchParams,
} from '@/lib/catalog-params'

/**
 * A consulta ao catálogo: os filtros que a pessoa escolheu, dentro das travas do
 * deck.
 *
 * Os filtros são os mesmos do catálogo (decisão 095, pedido do dono do produto):
 * quem monta um deck pensa em custo, trait, set e raridade, e não em códigos.
 * Mas o deck tem travas que o filtro não pode furar — só Leader na primeira
 * etapa; só Character, Event e Stage na segunda, e só as cores do líder. A
 * escolha da pessoa é **cruzada** com a trava: pedir Azul num líder vermelho dá
 * nada, e não um azul que o servidor recusaria depois.
 */
export function deckCatalogQuery(
  filtros: CatalogSearchParams,
  termo: string,
  tipos: string[],
  cores: string[] | undefined,
): string | null {
  const pedido = toCatalogQuery({ ...filtros, [PARAM.busca]: termo.trim() || undefined }, { pageSize: 12 })

  // O filtro chega como valor unico ou lista; aqui tudo vira lista.
  const lista = <T,>(valor: T | readonly T[] | undefined): T[] =>
    valor === undefined ? [] : Array.isArray(valor) ? [...valor] : [valor as T]

  const tiposEscolhidos = lista(pedido.type) as string[]
  const tiposPedidos = tiposEscolhidos.length ? tiposEscolhidos.filter((tipo) => tipos.includes(tipo)) : tipos
  if (tiposPedidos.length === 0) return null

  let coresPedidas = lista(pedido.color)
  if (cores) {
    coresPedidas = coresPedidas.length ? coresPedidas.filter((cor) => cores.includes(cor)) : cores
    if (coresPedidas.length === 0) return null
  }

  return toApiQuery({
    ...pedido,
    type: tiposPedidos as typeof pedido.type,
    color: coresPedidas,
  })
}

