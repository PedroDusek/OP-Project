import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkAdd } from '@/components/storage/bulk-add'
import { ToastProvider } from '@/components/ui/toast'
import { chaveDaLeva, lerRascunho } from '@/lib/leva-rascunho'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'

/**
 * O rascunho da leva (20/09).
 *
 * Marcar oitenta cartas leva tempo de gente. A escolha vivia só na memória da
 * aba: recarregar apagava tudo, e foi o que aconteceu com um testador depois
 * que a leva de 131 cartas falhou.
 *
 * O que se protege aqui: a escolha é gravada a cada toque, a retomada **depende
 * de um gesto** da pessoa, e confirmar limpa o rascunho.
 */

/*
 * `CatalogFilters` — reusado pela adição em massa — fala com o roteador. Aqui
 * ele não navega, mas os ganchos precisam existir.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/binders/9/adicionar',
  useSearchParams: () => new URLSearchParams(),
}))

/* `vi.mock` sobe para o topo do arquivo: o dublê precisa existir antes dele. */
const { adicionar } = vi.hoisted(() => ({
  adicionar: vi.fn(async () => ({ status: 'idle' as const })),
}))
vi.mock('@/app/(app)/binders/actions', () => ({ bulkAddAction: adicionar }))

const VOCABULARY: CatalogVocabulary = {
  types: ['Character'],
  colors: ['Red'],
  rarities: ['C'],
  variantTypes: ['Normal'],
  attributes: [],
  mechanics: [],
  traits: [],
  sets: [],
  costRange: { min: 0, max: 10 },
  powerRange: { min: 0, max: 12000 },
}

const CARDS = [
  { variantId: '1', cardCode: 'OP01-001', cardName: 'Zoro', rarity: 'C', variantType: 'Normal', imageUrl: null },
  { variantId: '2', cardCode: 'OP01-002', cardName: 'Nami', rarity: 'C', variantType: 'Normal', imageUrl: null },
]

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>)

const CHAVE = chaveDaLeva('9')

const montar = async () => {
  withToast(
    <BulkAdd
      storageLocationId="9"
      locationName="Binder Principal"
      vocabulary={VOCABULARY}
      initialCards={CARDS}
      initialTotal={CARDS.length}
      maxCards={200}
    />,
  )
  await screen.findByRole('button', { name: 'Acrescentar uma cópia de OP01-001' })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], total: 2, pageSize: 24 }))))
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('o rascunho da leva', () => {
  it('grava a escolha a cada toque, antes de confirmar', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-002' }))

    expect(lerRascunho(CHAVE)).toEqual({ '1': 2, '2': 1 })
  })

  it('tirar a última carta apaga o rascunho, em vez de guardar vazio', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar uma cópia de OP01-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tirar uma cópia de OP01-001' }))

    expect(lerRascunho(CHAVE)).toBeNull()
  })

  /*
   * A retomada é oferecida, e não automática: restaurar calado faria a escolha
   * de ontem aparecer no meio da leva de hoje.
   */
  it('oferece retomar o que ficou, e só restaura ao toque', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ '1': 3 }))
    await montar()

    expect(screen.getByText(/1 carta marcada/)).toBeInTheDocument()
    // Antes do toque, nada foi escolhido: não há barra de confirmação.
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retomar' }))

    expect(screen.getByText('3 cópias')).toBeInTheDocument()
    expect(screen.queryByText(/não chegou a confirmar/)).not.toBeInTheDocument()
  })

  it('descartar joga fora o que ficou', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ '1': 3 }))
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(lerRascunho(CHAVE)).toBeNull()
    expect(screen.queryByText(/não chegou a confirmar/)).not.toBeInTheDocument()
  })

  /* Rascunho de outro destino não aparece aqui: a chave é por binder. */
  it('não oferece o rascunho de outro binder', async () => {
    localStorage.setItem(chaveDaLeva('77'), JSON.stringify({ '1': 3 }))
    await montar()

    expect(screen.queryByText(/não chegou a confirmar/)).not.toBeInTheDocument()
  })

  /* O que está no navegador pode ter sido editado à mão. */
  it('ignora rascunho com conteúdo inválido', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ '1': -2, abc: 4 }))
    await montar()

    expect(screen.queryByText(/não chegou a confirmar/)).not.toBeInTheDocument()
  })
})
