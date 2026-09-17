'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBar } from '@/components/ui/search-bar'
import { NETWORK_QUERY_MIN } from '@/server/domain/social/network'

/**
 * Buscar quem tem uma carta (regra 6.1.3), pelo código ou pelo nome.
 *
 * Busca ao enviar, e não a cada letra: a busca tem cota mais apertada que a
 * listagem (decisão 060), e consultar enquanto a pessoa digita gastaria a cota
 * dela em buscas que ela nem quis fazer.
 */
export function NetworkSearch({ initial }: { initial: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState(initial)

  const buscar = (valor: string) => {
    const q = valor.trim()
    router.push(q.length >= NETWORK_QUERY_MIN ? `/social?q=${encodeURIComponent(q)}` : '/social')
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        buscar(texto)
      }}
    >
      <SearchBar
        label="Buscar quem tem uma carta"
        placeholder="Código ou nome da carta — OP01-001, Zoro"
        value={texto}
        onValueChange={setTexto}
        onClear={() => {
          setTexto('')
          buscar('')
        }}
        enterKeyHint="search"
      />
    </form>
  )
}
