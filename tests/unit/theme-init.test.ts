import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ThemeInit } from '@/components/theme/theme-init'
import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * O script de tema, na renderizacao do servidor.
 *
 * Este teste roda no ambiente `node`, sem `window` — que e exatamente a
 * condicao do servidor. A outra metade do contrato, "no navegador nao renderiza
 * nada", esta em `tests/components/theme-init.test.tsx`.
 *
 * Sem escrito com JSX de proposito: o projeto `server` do Vitest so recolhe
 * `.test.ts`, e `createElement` diz a mesma coisa.
 */

describe('renderizacao no servidor', () => {
  /**
   * A tag precisa sair **inline** no HTML. Se um dia alguem trocar por
   * `next/script`, o codigo para de vir no documento e passa a ser empilhado em
   * `self.__next_s`, processado depois de o pacote carregar — tarde demais, e o
   * flash de tema volta sem nada quebrar visivelmente em teste.
   */
  it('emite o script com o codigo dentro', () => {
    const html = renderToStaticMarkup(createElement(ThemeInit))

    expect(html).toContain('<script>')
    expect(html).toContain(THEME_STORAGE_KEY)
    expect(html).toContain('data-theme')
  })

  /** Sem `src`: um arquivo externo nao roda antes da primeira pintura. */
  it('nao aponta para arquivo externo', () => {
    expect(renderToStaticMarkup(createElement(ThemeInit))).not.toContain('src=')
  })

  /**
   * Ele le `localStorage`, que pode estourar em navegador com dados de site
   * bloqueados. Sem o `try`, a excecao aqui derrubaria a pagina inteira antes
   * de qualquer coisa aparecer.
   */
  it('protege a leitura do armazenamento', () => {
    const html = renderToStaticMarkup(createElement(ThemeInit))

    expect(html).toContain('try{')
    expect(html).toContain('catch')
  })
})
