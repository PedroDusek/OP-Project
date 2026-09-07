import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SupabaseImageStorage,
  provisionImageBucket,
} from '@/server/infrastructure/storage/supabase-image-storage'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/server/domain/storage/image'

/**
 * O provedor de imagens contra um `fetch` de mentira.
 *
 * Nenhum teste toca a rede: o que se verifica e a **forma** da conversa — para
 * onde vai, com quais cabecalhos, e o que se faz com cada resposta.
 *
 * Este arquivo existe por causa de uma falha real. A primeira versao usava
 * `createClient` do `@supabase/supabase-js`, que monta um cliente de Realtime
 * junto e exige um `WebSocket` global — inexistente no Node 20. O construtor
 * lancava antes de qualquer chamada, e nada disso aparecia em teste porque nao
 * havia teste que instanciasse o provedor.
 */

const BASE = 'https://projeto.supabase.co'
const BUCKET = 'colexa-imagens'
const OBJECT = `${BASE}/storage/v1/object`

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

const original = { ...process.env }
let fetchMock: ReturnType<typeof vi.fn>

/** Uma resposta pronta, no formato que o `fetch` global devolve. */
function reply(status: number, body: unknown = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_de_teste'
  process.env.SUPABASE_STORAGE_BUCKET = BUCKET

  fetchMock = vi.fn(async () => reply(200))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...original }
})

const call = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url, init, headers: init?.headers as Record<string, string> }
}

describe('disponibilidade', () => {
  /**
   * Instanciar nao pode falhar, e nao pode exigir rede: a pagina de criar local
   * pergunta isto a cada render para decidir se mostra o campo de foto.
   */
  it('se declara disponivel com a configuracao completa', () => {
    expect(new SupabaseImageStorage().available).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('se declara indisponivel sem a chave secreta, sem explodir', () => {
    delete process.env.SUPABASE_SECRET_KEY

    expect(() => new SupabaseImageStorage()).not.toThrow()
    expect(new SupabaseImageStorage().available).toBe(false)
  })

  it('sem configuracao, enviar falha com uma mensagem clara', async () => {
    delete process.env.SUPABASE_SECRET_KEY

    await expect(
      new SupabaseImageStorage().upload({
        scope: '7',
        bytes: PNG,
        contentType: 'image/png',
        extension: 'png',
      }),
    ).rejects.toThrow(/SUPABASE_SECRET_KEY/)
  })
})

describe('enviar', () => {
  const upload = (scope = '42') =>
    new SupabaseImageStorage().upload({
      scope,
      bytes: PNG,
      contentType: 'image/png',
      extension: 'png',
    })

  it('grava sob o prefixo do dono, com nome sorteado', async () => {
    const { url } = await upload('42')

    expect(call().url).toMatch(
      new RegExp(`^${OBJECT}/${BUCKET}/42/[0-9a-f-]{36}\\.png$`),
    )
    expect(url).toMatch(new RegExp(`^${OBJECT}/public/${BUCKET}/42/[0-9a-f-]{36}\\.png$`))
  })

  /**
   * O escopo e um id do nosso banco, e o caminho e montado no servidor. Filtrar
   * para digitos e o que impede um valor estranho virar outro diretorio.
   */
  it('descarta o que nao for digito no escopo', async () => {
    await upload('../42')

    expect(call().url).toContain(`/${BUCKET}/42/`)
    expect(call().url).not.toContain('..')
  })

  it('recusa escopo sem nenhum digito', async () => {
    await expect(upload('../../etc')).rejects.toThrow(/Escopo/)
  })

  /**
   * `apikey` e `Authorization` juntos: o gateway encaminha pela primeira e o
   * storage autoriza pela segunda. Faltando uma, a resposta e 401 sem dizer qual.
   */
  it('manda as duas formas de credencial', async () => {
    await upload()

    expect(call().headers).toMatchObject({
      apikey: 'sb_secret_de_teste',
      Authorization: 'Bearer sb_secret_de_teste',
      'Content-Type': 'image/png',
    })
  })

  /** Caminho sorteado nunca colide; `upsert` so mascararia isso. */
  it('nao sobrescreve', async () => {
    await upload()

    expect(call().headers['x-upsert']).toBe('false')
  })

  it('devolve a mensagem do servico quando o envio falha', async () => {
    fetchMock.mockResolvedValueOnce(reply(413, { message: 'Payload too large' }))

    await expect(upload()).rejects.toThrow(/Payload too large/)
  })
})

describe('apagar', () => {
  const nossa = `${OBJECT}/public/${BUCKET}/42/abc.png`

  it('apaga o objeto pelo caminho, e nao pela URL publica', async () => {
    await new SupabaseImageStorage().remove(nossa)

    expect(call().url).toBe(`${OBJECT}/${BUCKET}/42/abc.png`)
    expect(call().init.method).toBe('DELETE')
  })

  /**
   * A coluna `image` pode guardar endereco de outra origem — foi assim antes de
   * existir upload. Ignorar nao e deixar um caso passar: e recusar apagar coisa
   * alheia.
   */
  it('ignora URL que nao e nossa', async () => {
    await new SupabaseImageStorage().remove('https://outra.test/foto.png')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignora o bucket de outro projeto', async () => {
    await new SupabaseImageStorage().remove(`${OBJECT}/public/outro-bucket/42/abc.png`)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  /** Ja nao existir e o estado desejado. */
  it('nao reclama de arquivo inexistente', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { message: 'Object not found' }))

    await expect(new SupabaseImageStorage().remove(nossa)).resolves.toBeUndefined()
  })

  it('reclama de falha de verdade', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { message: 'boom' }))

    await expect(new SupabaseImageStorage().remove(nossa)).rejects.toThrow(/boom/)
  })
})

describe('preparar o bucket', () => {
  /**
   * Os limites saem da mesma constante que o servidor usa para recusar. E a
   * segunda tranca, do lado do Supabase; saindo da mesma origem, nao ha como as
   * duas divergirem.
   */
  it('cria publico, com os limites do dominio', async () => {
    const result = await provisionImageBucket()

    expect(result).toMatchObject({ outcome: 'created', bucket: BUCKET })
    expect(call().url).toBe(`${BASE}/storage/v1/bucket`)
    expect(JSON.parse(String(call().init.body))).toEqual({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_IMAGE_BYTES,
      allowed_mime_types: [...ACCEPTED_IMAGE_TYPES],
    })
  })

  /** Rodar de novo e seguro: ja existir e o caso normal. */
  it('confere os limites quando o bucket ja existe', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(409, { message: 'The resource already exists' }))
      .mockResolvedValueOnce(reply(200, { id: BUCKET }))
      .mockResolvedValueOnce(reply(200, { message: 'Successfully updated' }))

    const result = await provisionImageBucket()

    expect(result.outcome).toBe('confirmed')
    expect(call(2).init.method).toBe('PUT')
    expect(JSON.parse(String(call(2).init.body))).toMatchObject({ public: true })
  })

  /** Falhou ao criar e o bucket nao existe: e erro, e o erro e o da criacao. */
  it('propaga a falha de criacao quando o bucket nao existe', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { message: 'Invalid credentials' }))
      .mockResolvedValueOnce(reply(404, { message: 'Bucket not found' }))

    await expect(provisionImageBucket()).rejects.toThrow(/Invalid credentials/)
  })
})
