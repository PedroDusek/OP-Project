import type { ImageStorage, StoredImage, UploadImageInput } from '@/server/http/image-storage'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/server/domain/storage/image'

/**
 * Imagens enviadas pelo usuário, no Supabase Storage (decisão 042).
 *
 * Camada: infrastructure.
 *
 * ## Por que `fetch`, e não o `@supabase/supabase-js`
 *
 * `createClient` monta um cliente de Realtime junto, e o Realtime exige um
 * `WebSocket` global — que o Node 20 não tem. O construtor lança
 * `"Node.js detected but native WebSocket not found"` **antes** de qualquer
 * chamada de storage, então o upload nunca chegava a acontecer.
 *
 * Dava para injetar uma implementação de WebSocket só para calar o construtor.
 * Seria carregar uma dependência de tempo real para gravar um arquivo. A API de
 * Storage é REST comum, e é isto aqui: três endpoints e um cabeçalho.
 *
 * ## Por que a chave secreta, e não a sessão do usuário
 *
 * O upload acontece numa Server Action, depois de a fronteira de sessão já ter
 * dito quem é a pessoa. Usar a sessão dela aqui significaria repetir a
 * autorização em políticas de RLS escritas em SQL, num segundo lugar que pode
 * divergir do primeiro. O caminho do arquivo é montado **aqui** a partir do id
 * que veio do servidor, e não de nada que a tela mande — é isso que impede
 * gravar na pasta de outra pessoa.
 *
 * O bucket é público para leitura porque a imagem vai num `<img>`: URL assinada
 * expiraria no meio de uma página aberta, e renová-la a cada render trocaria uma
 * foto de binder por um problema de cache.
 *
 * ## Ausente é diferente de quebrado
 *
 * Sem `SUPABASE_SECRET_KEY` o provedor se declara indisponível em vez de
 * explodir no primeiro envio. Quem chama esconde o campo de foto — o mesmo
 * arranjo dos provedores sociais (decisão 032), pelo mesmo motivo: o
 * desenvolvimento local não precisa de um bucket para o resto funcionar.
 */

const DEFAULT_BUCKET = 'colexa-imagens'

/** Um ano. O nome do arquivo é único, então trocar a foto troca a URL. */
const CACHE_SECONDS = 60 * 60 * 24 * 365

interface Config {
  base: string
  secretKey: string
  bucket: string
}

function readConfig(): Config | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) return null

  return {
    base: `${url.replace(/\/+$/, '')}/storage/v1`,
    secretKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET,
  }
}

function required(): Config {
  const config = readConfig()
  if (!config) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas.')
  }
  return config
}

/**
 * `apikey` **e** `Authorization`: o gateway do Supabase encaminha pela primeira
 * e o serviço de storage autoriza pela segunda. Faltando uma, a resposta é 401
 * sem explicar qual.
 */
function headers(secretKey: string, extra: Record<string, string> = {}): HeadersInit {
  return { apikey: secretKey, Authorization: `Bearer ${secretKey}`, ...extra }
}

/** A mensagem do serviço, quando ela existe; senão, o status. */
async function failure(response: Response, what: string): Promise<Error> {
  const body = await response.text().catch(() => '')
  let detail = body
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string }
    detail = parsed.message || parsed.error || body
  } catch {
    // Corpo que não é JSON já serve como está.
  }
  return new Error(`${what}: ${response.status} ${detail}`.trim())
}

export class SupabaseImageStorage implements ImageStorage {
  readonly name = 'supabase-storage'

  get available(): boolean {
    return readConfig() !== null
  }

  async upload({ scope, bytes, contentType, extension }: UploadImageInput): Promise<StoredImage> {
    const { base, secretKey, bucket } = required()

    // O nome é sorteado, e não derivado do arquivo enviado: nome de arquivo é
    // texto do usuário, e texto do usuário não vira caminho.
    const path = `${sanitizeScope(scope)}/${crypto.randomUUID()}.${extension}`

    const response = await fetch(`${base}/object/${bucket}/${path}`, {
      method: 'POST',
      headers: headers(secretKey, {
        'Content-Type': contentType,
        'Cache-Control': `max-age=${CACHE_SECONDS}`,
        // Caminho sorteado nunca colide; `upsert` só serviria para mascarar isso.
        'x-upsert': 'false',
      }),
      body: bytes as BodyInit,
    })
    if (!response.ok) throw await failure(response, 'Falha ao enviar a imagem')

    return { url: `${base}/object/public/${bucket}/${path}` }
  }

  async remove(url: string): Promise<void> {
    const config = readConfig()
    if (!config) return

    const path = pathOf(url, config)
    if (!path) return

    const response = await fetch(`${config.base}/object/${config.bucket}/${path}`, {
      method: 'DELETE',
      headers: headers(config.secretKey),
    })
    // Já não existir é o estado desejado, não um erro.
    if (!response.ok && response.status !== 404) {
      throw await failure(response, 'Falha ao apagar a imagem')
    }
  }
}

/**
 * O caminho dentro do bucket, ou `null` para qualquer URL que não seja nossa.
 *
 * A coluna `image` pode guardar endereço de outra origem — foi assim antes de
 * existir upload —, e apagar o que não é nosso não é ignorar um caso: é recusar
 * apagar coisa alheia.
 */
function pathOf(url: string, { base, bucket }: Config): string | null {
  const prefix = `${base}/object/public/${bucket}/`
  if (!url.startsWith(prefix)) return null

  const path = url.slice(prefix.length)
  return path.length > 0 ? decodeURIComponent(path) : null
}

/** Só dígitos: o escopo é um id do nosso banco, não texto de tela. */
function sanitizeScope(scope: string): string {
  const clean = scope.replace(/[^0-9]/g, '')
  if (!clean) throw new Error('Escopo de upload inválido.')
  return clean
}

export type BucketOutcome = 'created' | 'confirmed'

/**
 * Cria (ou confere) o bucket das imagens. Chamado por `npm run supabase storage`.
 *
 * O limite de tamanho e a lista de tipos vêm da **mesma constante** que o
 * servidor usa para recusar. O servidor já barra antes de subir um byte; isto é
 * a segunda tranca, do lado do Supabase, para o caso de alguém escrever por
 * outro caminho — e, saindo da mesma origem, não há como as duas divergirem.
 */
export async function provisionImageBucket(): Promise<{
  outcome: BucketOutcome
  bucket: string
  host: string
}> {
  const { base, secretKey, bucket } = required()
  const host = new URL(base).hostname

  const settings = {
    public: true,
    file_size_limit: MAX_IMAGE_BYTES,
    allowed_mime_types: [...ACCEPTED_IMAGE_TYPES],
  }

  const created = await fetch(`${base}/bucket`, {
    method: 'POST',
    headers: headers(secretKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: bucket, name: bucket, ...settings }),
  })
  if (created.ok) return { outcome: 'created', bucket, host }

  // Já existir é o caso normal ao rodar de novo; qualquer outro erro é erro.
  const existing = await fetch(`${base}/bucket/${bucket}`, { headers: headers(secretKey) })
  if (!existing.ok) throw await failure(created, 'Falha ao criar o bucket')

  const updated = await fetch(`${base}/bucket/${bucket}`, {
    method: 'PUT',
    headers: headers(secretKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(settings),
  })
  if (!updated.ok) throw await failure(updated, 'Falha ao conferir os limites do bucket')

  return { outcome: 'confirmed', bucket, host }
}
