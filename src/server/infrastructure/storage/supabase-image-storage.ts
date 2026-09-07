import { createClient } from '@supabase/supabase-js'
import type { ImageStorage, StoredImage, UploadImageInput } from '@/server/http/image-storage'

/**
 * Imagens enviadas pelo usuário, no Supabase Storage (decisão 042).
 *
 * Camada: infrastructure.
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

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET
  return { url, secretKey, bucket }
}

export class SupabaseImageStorage implements ImageStorage {
  readonly name = 'supabase-storage'

  get available(): boolean {
    const { url, secretKey } = config()
    return Boolean(url && secretKey)
  }

  private bucket() {
    const { url, secretKey, bucket } = config()
    if (!url || !secretKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas.')
    }
    // Sem persistir sessão: este cliente é do servidor e não tem usuário.
    const client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return client.storage.from(bucket)
  }

  async upload({ scope, bytes, contentType, extension }: UploadImageInput): Promise<StoredImage> {
    // O nome é sorteado, e não derivado do arquivo enviado: nome de arquivo é
    // texto do usuário, e texto do usuário não vira caminho.
    const path = `${sanitizeScope(scope)}/${crypto.randomUUID()}.${extension}`
    const bucket = this.bucket()

    const { error } = await bucket.upload(path, bytes, {
      contentType,
      cacheControl: String(CACHE_SECONDS),
      // Caminho sorteado nunca colide; `upsert` só serviria para mascarar isso.
      upsert: false,
    })
    if (error) throw new Error(`Falha ao enviar a imagem: ${error.message}`)

    return { url: bucket.getPublicUrl(path).data.publicUrl }
  }

  async remove(url: string): Promise<void> {
    const path = this.pathOf(url)
    if (!path) return
    await this.bucket().remove([path])
  }

  /**
   * O caminho dentro do bucket, ou `null` para qualquer URL que não seja nossa.
   *
   * A coluna `image` pode guardar endereço de outra origem — foi assim antes de
   * existir upload —, e apagar o que não é nosso não é ignorar um caso: é
   * recusar apagar coisa alheia.
   */
  private pathOf(url: string): string | null {
    const { url: base, bucket } = config()
    if (!base) return null

    const prefix = `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`
    if (!url.startsWith(prefix)) return null

    const path = url.slice(prefix.length)
    return path.length > 0 ? decodeURIComponent(path) : null
  }
}

/** Só dígitos: o escopo é um id do nosso banco, não texto de tela. */
function sanitizeScope(scope: string): string {
  const clean = scope.replace(/[^0-9]/g, '')
  if (!clean) throw new Error('Escopo de upload inválido.')
  return clean
}
