'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'

/**
 * O CAPTCHA dos formulários de conta: Cloudflare Turnstile (decisão 088).
 *
 * Quem confere o token é o Supabase, ligado no painel com a chave secreta. Aqui
 * só se desenha o desafio e se põe o token no formulário, no campo
 * `captchaToken`, que a Server Action repassa.
 *
 * ## Sem chave, nada
 *
 * Sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` o componente não desenha nada, e o
 * formulário funciona como antes — com o CAPTCHA **desligado** no painel. A
 * ordem de ligar importa: a chave pública no ambiente primeiro, o painel depois.
 * Ao contrário, entrar e cadastrar param de funcionar.
 *
 * ## O token vale uma vez
 *
 * Cada envio gasta o token, dê certo ou não. `resetKey` muda a cada resposta da
 * ação (o próprio estado do formulário), e isso pede um desafio novo. O token
 * fica em estado, e não no campo escondido que o Turnstile cria sozinho: o React
 * reseta o `<form action>` ao fim da ação, e o valor controlado sobrevive.
 *
 * ## Desenha ao montar, e não só no `onReady`
 *
 * Relatado pelo dono do produto: o desafio aparecia ao recarregar a página, e
 * sumia ao sair e voltar para ela. Com o script já carregado, o `next/script`
 * chama `onReady` uma vez só por montagem do `<Script>` — e em desenvolvimento o
 * React monta, desmonta e monta de novo. A desmontagem removia o widget, e a
 * segunda montagem não recebia outro `onReady` para desenhá-lo. Por isso o
 * componente desenha no próprio efeito, quando o script já existe, e o `onReady`
 * fica para o primeiro carregamento.
 */

interface TurnstileOptions {
  sitekey: string
  language?: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'flexible' | 'compact'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function Captcha({ resetKey }: { resetKey: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState('')

  const desenhar = useCallback(() => {
    if (!siteKey || !container.current || widget.current || !window.turnstile) return
    widget.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      language: 'pt-br',
      theme: 'auto',
      size: 'flexible',
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
    })
  }, [siteKey])

  useEffect(() => {
    desenhar()
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [desenhar])

  // Resposta da ação: o token já foi gasto, e o desafio recomeça.
  useEffect(() => {
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!siteKey) return null

  return (
    <>
      {/* `onReady` roda também quando o script já estava carregado por outra tela. */}
      <Script src={SCRIPT} strategy="afterInteractive" onReady={desenhar} />
      {/*
       * Os 65 px são a altura do widget, reservada para o botão de enviar não
       * pular quando ele aparece — e ele aparece depois do `load`, vindo da rede
       * da Cloudflare. O `leading-[0]` é o que faz a reserva valer: o iframe do
       * Turnstile é inline dentro de um shadow root, e com a altura de linha
       * herdada (24 px) a linha ganhava o vão da linha de base, 7 px a mais.
       * O botão descia 7 px na hora em que se clica nele, e o teste ponta a
       * ponta do cadastro chegou a clicar dentro do iframe em vez do botão.
       */}
      <div ref={container} className="min-h-[65px] leading-[0]" />
      <input type="hidden" name="captchaToken" value={token} />
    </>
  )
}
