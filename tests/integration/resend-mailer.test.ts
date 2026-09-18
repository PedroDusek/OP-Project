import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResendMailer } from '@/server/infrastructure/email/resend-mailer'

/**
 * O provedor de e-mail contra um `fetch` de mentira (decisão 086).
 *
 * Nenhum teste toca a rede: o que se verifica é a forma da conversa com o Resend
 * — para onde vai, com qual chave, e o que se faz com a resposta.
 */

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_de_teste')
  vi.stubEnv('EMAIL_FROM', 'ColeXa <nao-responda@colexa.com.br>')
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const mensagem = { to: 'suporte@colexa.com.br', subject: 'DENUNCIA', text: 'Motivo.' }

describe('ResendMailer', () => {
  it('sem chave ou sem remetente, se declara indisponível e não envia', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(new ResendMailer().available).toBe(false)
    await expect(new ResendMailer().send(mensagem)).rejects.toThrow('RESEND_API_KEY')

    vi.stubEnv('RESEND_API_KEY', 're_de_teste')
    vi.stubEnv('EMAIL_FROM', ' ')
    expect(new ResendMailer().available).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia texto puro, do remetente configurado, com a chave no cabeçalho', async () => {
    const mailer = new ResendMailer()
    expect(mailer.available).toBe(true)
    await mailer.send(mensagem)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_de_teste' })
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'ColeXa <nao-responda@colexa.com.br>',
      to: ['suporte@colexa.com.br'],
      subject: 'DENUNCIA',
      text: 'Motivo.',
    })
  })

  it('resposta de erro vira exceção com a mensagem do Resend, sem a chave', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'The colexa.com.br domain is not verified.' }), { status: 403 }),
    )
    const falha = new ResendMailer().send(mensagem)
    await expect(falha).rejects.toThrow('403 The colexa.com.br domain is not verified.')
    await expect(falha).rejects.not.toThrow('re_de_teste')
  })
})

describe('resposta direta (decisão 096)', () => {
  it('com replyTo, manda reply_to; sem ele, não manda o campo', async () => {
    await new ResendMailer().send({ ...mensagem, replyTo: 'ana@example.test' })
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({
      reply_to: 'ana@example.test',
    })

    await new ResendMailer().send(mensagem)
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))).not.toHaveProperty('reply_to')
  })
})
