import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { Captcha } from '@/components/auth/captcha'

/**
 * O CAPTCHA dos formulários de conta (decisão 088), contra um Turnstile falso.
 * O script da Cloudflare nunca carrega: o `next/script` falso chama `onReady`
 * depois de montar, como o de verdade — antes disso o contêiner não existe.
 */

/*
 * Como o de verdade: `onReady` uma vez por montagem do `<Script>`, mesmo que o
 * React refaça os efeitos. `scriptCarregado` falso imita o script ainda chegando.
 */
let scriptCarregado = true
/** O `onReady` que o evento de carregamento do script chamaria. */
let aoCarregar: (() => void) | undefined
vi.mock('next/script', async () => {
  const { useEffect, useRef } = await import('react')
  return {
    default: function ScriptFalso({ onReady }: { onReady?: () => void }) {
      const chamado = useRef(false)
      aoCarregar = onReady
      useEffect(() => {
        if (chamado.current || !scriptCarregado) return
        chamado.current = true
        onReady?.()
      }, [onReady])
      return null
    },
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete window.turnstile
  scriptCarregado = true
})

function turnstileFalso() {
  let callback: ((token: string) => void) | undefined
  const api = {
    render: vi.fn((_el: HTMLElement, options: { callback?: (token: string) => void }) => {
      callback = options.callback
      return 'w1'
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  window.turnstile = api
  return { api, resolver: (token: string) => act(() => callback?.(token)) }
}

const campo = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[name="captchaToken"]')

describe('Captcha', () => {
  it('sem chave pública, não desenha nada nem põe campo no formulário', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
    const { api } = turnstileFalso()
    const { container } = render(<Captcha resetKey={1} />)
    expect(campo(container)).toBeNull()
    expect(api.render).not.toHaveBeenCalled()
  })

  it('com chave, desenha em português e põe o token no campo', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'chave-publica')
    const { api, resolver } = turnstileFalso()
    const { container } = render(<Captcha resetKey={1} />)

    expect(api.render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'chave-publica', language: 'pt-br' }),
    )
    expect(campo(container)).toHaveValue('')
    await resolver('tok-1')
    expect(campo(container)).toHaveValue('tok-1')
  })

  /*
   * Relatado pelo dono do produto: sair da tela e voltar deixava o desafio sem
   * desenhar. Em desenvolvimento o React monta, desmonta e monta de novo, e o
   * `onReady` so vem uma vez — quem desenha de novo e o proprio componente.
   */
  it('voltar à tela com o script já carregado desenha de novo, mesmo com o React remontando', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'chave-publica')
    const { api } = turnstileFalso()

    const { unmount } = render(<Captcha resetKey={1} />, { wrapper: StrictMode })
    expect(api.remove).toHaveBeenCalledTimes(1)
    expect(api.render).toHaveBeenCalledTimes(2)
    unmount()

    render(<Captcha resetKey={1} />, { wrapper: StrictMode })
    expect(api.render).toHaveBeenCalledTimes(4)
    expect(api.remove).toHaveBeenCalledTimes(3)
  })

  it('no primeiro carregamento, desenha quando o script chega', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'chave-publica')
    scriptCarregado = false
    render(<Captcha resetKey={1} />)
    expect(window.turnstile).toBeUndefined()

    const { api } = turnstileFalso()
    act(() => aoCarregar?.())
    expect(api.render).toHaveBeenCalledTimes(1)
  })

  it('cada resposta da ação pede um desafio novo, e sair da tela remove o widget', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'chave-publica')
    const { api } = turnstileFalso()
    const { rerender, unmount } = render(<Captcha resetKey={{ status: 'idle' }} />)

    rerender(<Captcha resetKey={{ status: 'error', message: 'x' }} />)
    expect(api.reset).toHaveBeenCalledWith('w1')

    unmount()
    expect(api.remove).toHaveBeenCalledWith('w1')
  })
})
