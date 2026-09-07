'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SearchBar } from '@/components/ui/search-bar'
import { buildCatalogHref, PARAM } from '@/lib/catalog-params'

/**
 * A busca do catálogo.
 *
 * Escreve na URL, com atraso. O atraso existe porque cada mudança de endereço é
 * uma consulta ao servidor: sem ele, digitar "Luffy" dispara cinco buscas e
 * quatro delas já nascem obsoletas.
 *
 * 350 ms é o intervalo em que a pessoa ainda percebe a resposta como imediata e
 * uma digitação normal já terminou.
 *
 * O campo guarda o próprio texto em estado, e não lê a URL a cada tecla: caso
 * contrário o cursor saltaria para o fim a cada navegação concluída.
 */
export function CatalogSearch({ placeholder = 'Buscar por código ou nome...' }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const fromUrl = params.get(PARAM.busca) ?? ''
  const [text, setText] = useState(fromUrl)
  const [lastFromUrl, setLastFromUrl] = useState(fromUrl)

  /*
   * A URL pode mudar sem passar por aqui — ao limpar os filtros, ou pelo botão
   * de voltar do navegador. Nesses casos o campo precisa acompanhar.
   *
   * O ajuste acontece **durante a renderizacao**, e nao num efeito. Num efeito,
   * a tela chegaria a ser pintada com o texto antigo antes da correcao, e o
   * lint do React reclama disso com razao. Comparar com o valor anterior e o
   * padrao documentado para derivar estado de uma propriedade que muda.
   */
  if (fromUrl !== lastFromUrl) {
    setLastFromUrl(fromUrl)
    setText(fromUrl)
  }

  useEffect(() => {
    if (text === fromUrl) return

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(buildCatalogHref(pathname, params, { [PARAM.busca]: text || undefined }), {
          scroll: false,
        })
      })
    }, 350)

    return () => clearTimeout(timer)
  }, [text, fromUrl, pathname, params, router])

  return (
    <SearchBar
      label="Buscar no catálogo"
      value={text}
      onValueChange={setText}
      placeholder={placeholder}
      aria-busy={pending || undefined}
    />
  )
}
