import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Ambiente dos testes de componente.
 *
 * `cleanup` explicito porque `globals` esta desligado: sem ele, o React deixa
 * cada arvore montada no `document`, e o segundo `getByRole` do arquivo acha
 * dois elementos e falha por ambiguidade — um erro que parece do componente e
 * e do teste anterior.
 */
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

/**
 * O jsdom nao implementa nada disto, e o Radix usa os tres para posicionar
 * painel, prender foco e animar. Sem os stubs, qualquer teste que abra um
 * `Sheet` ou um `Select` quebra dentro da biblioteca, longe do que se queria
 * testar.
 */
beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false) as never
    Element.prototype.setPointerCapture = vi.fn() as never
    Element.prototype.releasePointerCapture = vi.fn() as never
  }
})
