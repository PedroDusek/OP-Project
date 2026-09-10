/**
 * O nome de usuário: o que vale, e quando pode mudar.
 *
 * Camada: domain. Puro, síncrono, sem I/O.
 *
 * É a **única** identidade que outros usuários veem (`business-rules.md`
 * 6.1.1). Nome real e e-mail nunca aparecem, então este texto carrega sozinho o
 * peso de a pessoa ser reconhecida entre uma troca e outra.
 *
 * ## Por que as regras são estreitas
 *
 * Cada uma fecha um jeito de se passar por outra pessoa.
 *
 * **Um alfabeto só.** Letras latinas, números, ponto e sublinhado. Sem acento,
 * sem cirílico, sem espaço. `pedrо` com um `о` cirílico é indistinguível de
 * `pedro` na tela, e seria uma conta diferente — o ataque mais barato que
 * existe contra identidade escrita.
 *
 * **Comparação sem caixa.** `Pedro` e `pedro` são o mesmo nome, e o segundo a
 * pedir não leva. Quem lê não distingue os dois com confiança.
 *
 * **Nem começa nem termina em separador**, e não repete separador: `pedro..`,
 * `.pedro` e `pe..dro` são variações que só servem para parecer outra coisa.
 *
 * ## Uma troca por semana
 *
 * O nome é como as pessoas se reconhecem. Trocar à vontade permitiria assumir a
 * aparência de alguém logo depois de ela mudar, e apagaria o rastro de quem se
 * comportou mal.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Uma semana entre trocas, em milissegundos. */
export const USERNAME_CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

const SHAPE = /^[a-z0-9](?:[a-z0-9]|[._](?=[a-z0-9]))*$/

/**
 * Palavras que o produto reserva para si.
 *
 * Um usuário chamado `suporte` ou `colexa` pode pedir senha a estranhos e ser
 * acreditado. A lista é curta de propósito: ela protege contra o caso óbvio, e
 * não tenta adivinhar o inventivo.
 */
const RESERVED = new Set([
  'colexa',
  'admin',
  'administrador',
  'suporte',
  'support',
  'ajuda',
  'help',
  'moderador',
  'moderacao',
  'oficial',
  'staff',
  'root',
  'sistema',
  'system',
  'null',
  'undefined',
  'eu',
  'me',
])

export type UsernameProblem =
  | 'curto'
  | 'longo'
  | 'formato'
  | 'reservado'

export const USERNAME_PROBLEM_MESSAGE: Record<UsernameProblem, string> = {
  curto: `O nome precisa de pelo menos ${USERNAME_MIN} caracteres.`,
  longo: `O nome pode ter no máximo ${USERNAME_MAX} caracteres.`,
  formato:
    'Use letras sem acento, números, ponto ou sublinhado. Comece e termine com letra ou número.',
  reservado: 'Este nome é reservado. Escolha outro.',
}

/**
 * A forma guardada e comparada: sempre minúscula, sem espaço em volta.
 *
 * O banco guarda esta forma, e é sobre ela que a unicidade vale. Guardar como a
 * pessoa digitou e comparar de outro jeito criaria dois nomes que o banco
 * aceita e o olho não distingue.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateUsername(raw: string): UsernameProblem | null {
  const username = normalizeUsername(raw)

  if (username.length < USERNAME_MIN) return 'curto'
  if (username.length > USERNAME_MAX) return 'longo'
  if (!SHAPE.test(username)) return 'formato'
  if (RESERVED.has(username)) return 'reservado'

  return null
}

/**
 * Quando esta pessoa poderá trocar de nome, ou `null` se já pode.
 *
 * Recebe o instante da última troca — `null` para quem nunca trocou, que pode
 * sempre. Escolher o nome pela primeira vez **não** é troca: seria cobrar uma
 * semana de espera de quem acabou de chegar.
 */
export function usernameChangeAllowedAt(lastChangedAt: Date | null): Date | null {
  if (!lastChangedAt) return null

  const allowed = new Date(lastChangedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS)
  return allowed
}

export function canChangeUsername(lastChangedAt: Date | null, now: Date): boolean {
  const allowed = usernameChangeAllowedAt(lastChangedAt)
  return allowed === null || now.getTime() >= allowed.getTime()
}
