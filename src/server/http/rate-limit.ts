import { RateLimitError } from '@/server/domain/errors'

/**
 * Limite de taxa por janela fixa.
 *
 * Camada: http.
 *
 * ## Limitacao que precisa estar escrita
 *
 * O contador vive na memoria do processo. Com mais de uma instancia servindo,
 * cada uma conta sozinha, e o limite efetivo vira o limite vezes o numero de
 * instancias. Isso basta para conter abuso acidental e um script ingenuo; nao
 * basta para conter alguem determinado.
 *
 * Quando houver mais de uma instancia, o contador precisa sair para um lugar
 * compartilhado. Nao antecipamos isso agora porque exigiria uma dependencia de
 * infraestrutura que o produto ainda nao tem.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Sem isto, um processo longo acumularia uma chave por usuario para sempre. */
function evictExpired(now: number): void {
  if (buckets.size < 1000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** Chamadas permitidas dentro da janela. */
  limit: number
  windowMs: number
}

/**
 * Consome uma unidade da cota de `key`. Lanca `RateLimitError` ao estourar.
 *
 * A chave deve identificar quem chama, nao o que e chamado: use o id do usuario
 * quando houver sessao. Limitar por rota deixaria um usuario derrubar a cota de
 * todos os outros.
 */
export function consumeRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now()
  evictExpired(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > options.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    throw new RateLimitError(retryAfter)
  }
}

/** Zera todos os contadores. Existe para os testes nao vazarem estado entre si. */
export function resetRateLimits(): void {
  buckets.clear()
}

/**
 * Cota de leitura do catalogo.
 *
 * Generosa para uso humano — navegar a grade e abrir cartas nao chega perto —
 * e apertada o bastante para que extrair o catalogo inteiro pela API leve tempo
 * demais para valer a pena. Isso sustenta na pratica o compromisso da decisao
 * 020 de nunca reexpor o catalogo.
 */
export const CATALOG_READ_LIMIT: RateLimitOptions = {
  limit: 300,
  windowMs: 60_000,
}

/**
 * Tentativas de entrar, por endereco de e-mail.
 *
 * Dez por dez minutos: quem erra a senha algumas vezes seguidas nao esbarra
 * nisso, e quem esta chutando consegue mil tentativas por dia por conta, o que
 * torna adivinhacao inviavel contra qualquer senha razoavel.
 *
 * O contador vive em memoria de processo, com a limitacao ja descrita no topo
 * deste arquivo. Para conter chute distribuido, isso e insuficiente por si so —
 * o Supabase tambem aplica limite proprio do lado dele.
 */
export const AUTH_ATTEMPT_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 10 * 60_000,
}

/**
 * Operacoes que fazem o provedor **enviar e-mail**: cadastro e redefinicao.
 *
 * Bem mais apertado que o login, por dois motivos. Cada chamada custa uma
 * mensagem na caixa de outra pessoa, entao repeticao vira incomodo dirigido; e
 * o servico de e-mail embutido do Supabase tem cota propria e baixa, que
 * estourada derruba o cadastro para todo mundo.
 */
export const EMAIL_SEND_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60_000,
}
