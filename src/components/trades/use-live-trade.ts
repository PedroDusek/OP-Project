'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Mantém a negociação viva na tela: pergunta ao servidor, e redesenha quando muda.
 *
 * ## Perguntar, e não assinar
 *
 * Uma consulta a cada dois segundos, e não uma conexão aberta (decisão 065). São
 * **duas pessoas** numa troca, não uma multidão, e a conversa dura minutos. O
 * custo de perguntar é pequeno; o de manter conexão longa por pessoa não é, e
 * com mais de uma instância do servidor uma não saberia do que aconteceu na
 * outra — a mesma limitação que o limite de taxa já tem.
 *
 * Dois segundos é o atraso de quem está montando uma oferta e olhando para a
 * tela. Ninguém percebe, e ninguém precisa de menos.
 *
 * ## Pausa quando a aba some
 *
 * Perguntar a cada dois segundos numa aba em segundo plano é cota de leitura
 * gasta para desenhar o que ninguém está vendo (decisão 039). Ao voltar, a
 * primeira pergunta é imediata: quem volta para a aba quer ver o agora, não
 * esperar o próximo ciclo.
 *
 * ## Redesenha a página, não remonta a troca
 *
 * Quando algo muda, chama `router.refresh()`. Quem sabe montar a negociação é o
 * componente de servidor que já existe; montá-la aqui também daria dois lugares
 * capazes de discordar sobre a mesma troca.
 */

/** Dois segundos: o atraso que ninguém percebe montando uma oferta. */
const INTERVALO_MS = 2_000

export function useLiveTrade(tradeId: string, ativo: boolean): void {
  const router = useRouter()

  /*
   * A ultima resposta, guardada num ref e nao em estado: ela nao desenha nada.
   * Em estado, cada resposta igual causaria uma renderizacao a toa, duas vezes
   * por segundo, para nada mudar na tela.
   */
  const ultima = useRef<string | null>(null)

  useEffect(() => {
    if (!ativo) return

    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function perguntar() {
      if (cancelado) return

      try {
        const resposta = await fetch(`/api/trocas/${tradeId}/estado`, { cache: 'no-store' })
        if (!resposta.ok || cancelado) return

        const corpo = JSON.stringify(await resposta.json())

        /*
         * A primeira resposta so estabelece a referencia. Sem isto, abrir a tela
         * dispararia um `refresh` imediato — redesenhando a pagina que o servidor
         * acabou de mandar.
         */
        if (ultima.current !== null && corpo !== ultima.current) {
          ultima.current = corpo
          router.refresh()
          return
        }

        ultima.current = corpo
      } catch {
        // Rede instavel nao derruba a negociacao: a proxima pergunta tenta de
        // novo, e enquanto isso a tela mostra o que ja tinha.
      }
    }

    function agendar() {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await perguntar()
        agendar()
      }, INTERVALO_MS)
    }

    function aoVoltar() {
      // Quem volta para a aba quer ver o agora, e nao esperar o proximo ciclo.
      if (document.visibilityState === 'visible') void perguntar()
    }

    void perguntar()
    agendar()
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [tradeId, ativo, router])
}
