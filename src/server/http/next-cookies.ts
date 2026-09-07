import { cookies } from 'next/headers'
import type { CookieStore } from './auth-provider'

/**
 * Adapta o armazenamento de cookie do Next ao contrato do provedor.
 *
 * Camada: http, que e onde a adaptacao ao framework pertence. `application` e
 * `infrastructure` recebem um `CookieStore` e nunca importam `next/headers`, o
 * que e o que mantem os casos de uso testaveis sem um servidor.
 */

export async function requestCookies({ remember = true } = {}): Promise<CookieStore> {
  const store = await cookies()

  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    set: (name, value, options) => {
      /*
       * "Lembrar de mim" desmarcado vira cookie de sessao: sem `maxAge` e sem
       * `expires`, o navegador descarta ao fechar.
       *
       * O token continua tendo o mesmo prazo do lado do Supabase — isto nao
       * encurta a sessao no servidor, so evita que ela sobreviva no aparelho.
       * Que e exatamente o que a caixa promete a quem esta num computador
       * emprestado.
       */
      const persisted = remember ? options : { ...options, maxAge: undefined, expires: undefined }

      try {
        store.set(name, value, persisted)
      } catch {
        /*
         * Componente de servidor nao pode escrever cookie, e o provedor tenta
         * ao renovar durante uma leitura. Ignorar e o certo: quem renova de
         * verdade e o middleware, que roda antes e consegue responder com
         * `Set-Cookie`. Ver `architecture.md` 3.4.
         */
      }
    },
  }
}
