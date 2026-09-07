/**
 * Ordenacao e exibicao de sets.
 *
 * Camada: domain. Puro, sem I/O.
 *
 * Existe porque os codigos que a fonte usa **nao sao uniformes**. No catalogo
 * importado convivem `OP01` e `OP-07`, `ST13` e `ST-01`, alem de `OP14-EB04`,
 * `PRB-01`, `GC-01` e `PROMO`. Ordenar por texto puro coloca `OP-07` antes de
 * `OP01`, o que embaralha a unica sequencia que a pessoa reconhece.
 */

/**
 * Chave de ordenacao: prefixo de letras, primeiro numero, e o codigo
 * normalizado como desempate.
 *
 * `OP14-EB04` cai em (`OP`, 14) e fica entre OP13 e OP15, que e onde ele
 * pertence. `PROMO`, que nao tem numero, vai para o fim do proprio prefixo.
 */
export function setSortKey(code: string): [string, number, string] {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = /^([A-Z]+)(\d+)?/.exec(normalized)
  const prefix = match?.[1] ?? normalized
  const number = match?.[2] ? Number(match[2]) : Number.POSITIVE_INFINITY
  return [prefix, number, normalized]
}

export function compareSetCodes(a: string, b: string): number {
  const [prefixA, numberA, rawA] = setSortKey(a)
  const [prefixB, numberB, rawB] = setSortKey(b)

  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1
  if (numberA !== numberB) return numberA - numberB
  return rawA < rawB ? -1 : rawA > rawB ? 1 : 0
}

/**
 * Nome do set para exibicao.
 *
 * A fonte envolve varios nomes em hifens decorativos: `-ROMANCE DAWN-`. Tirar
 * os dois deixa `ROMANCE DAWN`, que e o nome.
 *
 * A regra e simetrica de proposito: so remove quando **comeca e termina** com
 * hifen. `BOOSTER PACK -THE WORLD'S STRONGEST WARRIORS-` fica intacto, porque
 * remover so o hifen final deixaria um nome pela metade — pior que o original.
 *
 * Isto e apresentacao, e nao correcao de dado: o valor guardado continua sendo
 * o que a fonte publicou.
 */
export function displaySetName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length > 2 && trimmed.startsWith('-') && trimmed.endsWith('-')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}
