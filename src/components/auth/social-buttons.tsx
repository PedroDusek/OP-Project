'use client'

import { useTransition } from 'react'
import { startOAuthAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import type { OAuthProviderId } from '@/server/http/auth-provider'

/**
 * Entrar com um provedor externo.
 *
 * Os botões só aparecem para os provedores que o Supabase **de fato** tem
 * ligados: a lista vem do provedor, não de uma constante nossa. Um botão
 * "Continuar com o Google" que leva a uma página de erro do Supabase é pior que
 * botão nenhum, e é o que aconteceria se a tela e o painel discordassem.
 *
 * Com nenhum provedor ligado, nem o separador "ou" aparece — não existe um "ou"
 * quando só há um caminho.
 */

const LABELS: Record<OAuthProviderId, string> = {
  google: 'Continuar com o Google',
  apple: 'Continuar com a Apple',
}

export function SocialButtons({
  providers,
  next,
}: {
  providers: OAuthProviderId[]
  next?: string
}) {
  const [pending, start] = useTransition()

  if (providers.length === 0) return null

  return (
    <>
      <Divider label="ou" className="my-5" />
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="secondary"
            size="lg"
            block
            disabled={pending}
            onClick={() => start(() => startOAuthAction(provider, next))}
          >
            {provider === 'google' ? <GoogleMark /> : <AppleMark />}
            {LABELS[provider]}
          </Button>
        ))}
      </div>
    </>
  )
}

/*
 * As marcas dos provedores são inline porque o `lucide` não traz logotipo de
 * terceiro. Não conflita com a seção 19 da especificação: ali o que se proíbe é
 * arte de franquia como decoração, e aqui a marca identifica o botão que a
 * pessoa precisa reconhecer para entrar — os dois provedores inclusive exigem a
 * própria identidade nesse botão.
 */

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 fill-current" aria-hidden focusable="false">
      <path d="M17.05 12.54c-.03-2.72 2.22-4.03 2.32-4.09-1.27-1.85-3.24-2.1-3.94-2.13-1.68-.17-3.28 1-4.13 1-.85 0-2.16-.98-3.55-.95-1.83.03-3.51 1.06-4.45 2.7-1.9 3.29-.49 8.17 1.36 10.84.9 1.31 1.98 2.78 3.4 2.72 1.36-.05 1.88-.88 3.53-.88 1.65 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.3-2.65 1.04-1.52 1.47-2.99 1.49-3.07-.03-.01-2.86-1.1-2.88-4.34zM14.4 4.6c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.62-.69.8-1.29 2.08-1.13 3.31 1.2.09 2.43-.61 3.17-1.5z" />
    </svg>
  )
}
