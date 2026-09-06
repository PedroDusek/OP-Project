import 'dotenv/config'

/**
 * Seed estrutural.
 *
 * Deliberadamente vazio nesta fase, e isso e uma decisao, nao um esquecimento.
 *
 * O unico dado que caberia aqui seria o vocabulario (cores, traits, atributos,
 * mecanicas, efeitos). Ele nao entra por dois motivos:
 *
 * 1. A especificacao proibe inventar classificacoes. Esses valores vem da fonte
 *    externa do catalogo, que ainda nao foi aprovada (ver docs/integrations.md).
 * 2. Pre-popular vocabulario aqui criaria risco de divergencia de grafia com a
 *    fonte ("Red" contra "RED"), gerando linhas duplicadas apesar do
 *    UNIQUE (name) e quebrando a idempotencia da importacao.
 *
 * A importacao real do catalogo e um processo separado, entregue no
 * Checkpoint 3. Dados de teste ficam em tests/, nunca aqui.
 */
async function main(): Promise<void> {
  console.log('[seed] Nenhum dado estrutural a inserir nesta fase.')
  console.log('[seed] O vocabulario vem da importacao do catalogo (Checkpoint 3).')
}

main().catch((error: unknown) => {
  console.error('[seed] falhou:', error)
  process.exit(1)
})
