'use client'

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { applyTheme, readStoredTheme, storeTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

/**
 * O tema escolhido, lido de onde ele realmente mora.
 *
 * `localStorage` e um estado **externo** ao React, e o jeito certo de ler estado
 * externo e `useSyncExternalStore`. A alternativa obvia — um `useState` que um
 * `useEffect` corrige depois de montar — funciona e tem dois defeitos: gera uma
 * renderizacao em cascata a cada montagem, e nao percebe mudanca vinda de fora.
 *
 * A mudanca de fora aqui e concreta: com o app aberto em duas abas, trocar o
 * tema numa delas dispara o evento `storage` na outra. Assinando esse evento, a
 * segunda aba acompanha sozinha; com `useEffect`, ela ficaria no tema antigo
 * ate ser recarregada.
 *
 * No servidor a resposta e sempre `system`, que e o que o HTML renderizado
 * assume. Quem evita o flash e o script sincrono do `<head>`, nao este estado.
 */

const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  // Disparado por **outras** abas da mesma origem. A propria aba avisa por
  // `notify`, ja que o navegador nao emite `storage` para quem escreveu.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
    // Escrever o atributo aqui, e nao so avisar o React: o valor que o CSS le
    // e o atributo do `<html>`, e nele o React nao encosta. Sem esta linha, a
    // outra aba saberia do tema novo e continuaria pintada com o antigo.
    applyTheme(readStoredTheme(), document.documentElement)
    onStoreChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

interface ThemeContextValue {
  /** O que a pessoa escolheu, incluindo `system`. Nao e o tema em vigor. */
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => 'system' as const)

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next)
    applyTheme(next, document.documentElement)
    notify()
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme precisa de um <ThemeProvider> acima.')
  return context
}
