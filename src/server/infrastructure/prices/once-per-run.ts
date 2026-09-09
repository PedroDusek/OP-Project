import type { KnownCardNames, PriceProvider, PriceSnapshot } from '@/server/http/price-provider'

/**
 * Uma passada pela fonte por execução, mesmo com dois casos de uso.
 *
 * Camada: infrastructure.
 *
 * O vínculo das artes e a importação de preços pedem a mesma coisa: os 87
 * arquivos da fonte. Rodando um atrás do outro, cada um pedia a sua cópia — 348
 * requisições onde 174 bastam, contra infraestrutura que é de outra pessoa e
 * pelo mesmo motivo da decisão 020.
 *
 * A memória vale para **esta execução e só**. Não é cache com validade: o
 * objeto vive o tempo do script, e o próximo dia começa do zero. Guardar entre
 * execuções seria servir preço velho sem que nada dissesse isso.
 *
 * O `knownNames` da segunda chamada é ignorado de propósito — vem do mesmo
 * catálogo, na mesma execução. Se um dia dois chamadores passarem catálogos
 * diferentes, este atalho passa a mentir, e é por isso que ele está escrito
 * aqui em vez de escondido dentro do provedor.
 */
export function oncePerRun(provider: PriceProvider): PriceProvider {
  let pending: Promise<PriceSnapshot> | null = null

  return {
    name: provider.name,
    fetchSnapshot(knownNames: KnownCardNames): Promise<PriceSnapshot> {
      pending ??= provider.fetchSnapshot(knownNames)
      return pending
    },
  }
}
