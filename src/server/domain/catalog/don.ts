/**
 * A identidade dos DON!! (decisão 112).
 *
 * Camada: domain. Puro, sem I/O.
 *
 * ## Por que existe um código inventado
 *
 * Toda carta do ColeXa é identificada por `code`, e é por ele que se amarram
 * variantes, alocações, want list e decklists. O DON!! **não tem código**: no
 * tcgcsv o campo `Number` vem `-` nas 239, e a Bandai não o publica.
 *
 * A identidade disponível na fonte é `(grupo, nome)` — sem colisões dentro do
 * mesmo grupo, mas com nomes que se repetem entre grupos ("DON!! Card
 * (Alternate Art)" aparece em vários). Isso não cabe num código curto e
 * estável.
 *
 * O `productId` do TCGplayer cabe: é numérico, único no catálogo inteiro e não
 * muda. Ele já é a chave que o nosso preço usa, então o DON!! não estreia um
 * identificador novo no sistema — usa o que já estava lá.
 *
 * **Este código é para sempre.** Ele vai parar na coleção das pessoas, e trocá-lo
 * depois exige migração de dados. Por isso ele é derivado de um id estável, e
 * não de nome ou posição.
 *
 * ## O prefixo não é enfeite
 *
 * `DON-` faz o código não parecer código da Bandai, e isso tem consequência
 * prática: `ligaEdition` só reconhece `LETRAS+DÍGITOS-`, então `DON-482236` não
 * produz edição — e o link direto da Liga, que é montado a partir da edição,
 * nunca é inventado para uma carta que a Liga talvez nem tenha.
 */

const PREFIX = 'DON-'

/**
 * O set artificial dos DON!! (decisão 112, escolha do dono do produto).
 *
 * Ele **não existe na Bandai**: é nosso, e serve a duas coisas. Dá aos DON!! um
 * lugar onde morar, já que os grupos do TCGplayer não são os nossos sets e
 * mapeá-los seria adivinhar. E faz o filtro do catálogo oferecê-los juntos, que
 * é como a pessoa quer vê-los — separados do resto.
 *
 * Por ser artificial, ele tem uma espécie própria (`don`) em vez de se passar
 * por coleção: assim ordena por último e aparece com rótulo próprio, sem
 * fingir que saiu num booster.
 */
export const DON_SET_CODE = 'DON'
export const DON_SET_NAME = 'DON!!'

/** `482236` → `DON-482236`. Cabe nos 20 caracteres de `cards.code`. */
export function donCardCode(productId: number | string): string {
  return `${PREFIX}${String(productId).trim()}`
}

/** Se um código é de DON!!, sem precisar ler o tipo no banco. */
export function isDonCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(PREFIX)
}

/**
 * O tipo de arte de um DON!!.
 *
 * A fonte não separa arte normal de alternativa em campo próprio — só no nome
 * do produto, que é como o TCGplayer distingue os seus. "DON!! Card" é a arte
 * comum que vem nos decks; tudo que traz um personagem ou "(Alternate Art)" é
 * uma arte diferente, e é a que tem mercado.
 *
 * Classificar assim é o que o dado permite afirmar, e é a mesma linha da
 * decisão 023: só "Normal" e "Parallel", sem taxonomia mais fina inventada. O
 * nome inteiro fica guardado, então uma classificação melhor pode sair depois
 * sem reimportar.
 */
export function donVariantType(productName: string): string {
  const nome = productName.trim().replace(/\s+/g, ' ')
  // "DON!! Card" e "DON!! Card (Gold)" são a mesma arte comum em acabamentos
  // diferentes; o acabamento é do produto, não da ilustração.
  return /^DON!! Card( \(Gold\))?$/i.test(nome) ? 'Normal' : 'Parallel'
}
