import { expect, test } from '@playwright/test'

/**
 * Responsividade do shell.
 *
 * As tres larguras sao as de `architecture.md` 4.1: 360 e o celular pequeno que
 * o projeto toma como piso, 768 e a entrada do `md`, 1280 e o desktop.
 *
 * O que se verifica e a **exclusividade**: em cada largura existe exatamente uma
 * navegacao visivel. O erro que este teste pega e o par de barras aparecendo
 * junto, que nenhum teste em jsdom enxerga.
 */

const MOBILE = { width: 360, height: 740 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 800 }

test.describe('navegação responsiva', () => {
  test('no celular, apenas a barra inferior', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/inicio')

    // Uma so navegacao chega a arvore de acessibilidade. As duas existem no
    // HTML — e assim que um layout unico atende os tres tamanhos — mas a
    // escondida sai da arvore junto com o `display: none`, entao quem usa
    // leitor de tela nunca ouve os cinco destinos duas vezes.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1)

    // E ela e a de baixo: encostada no rodape e ocupando a largura toda.
    const box = await page.locator('nav:visible').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeGreaterThan(MOBILE.height - 80)
    expect(box!.width).toBe(MOBILE.width)
  })

  test('no tablet, apenas a coluna lateral', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/inicio')

    const visible = page.locator('nav:visible')
    await expect(visible).toHaveCount(1)

    const box = await visible.boundingBox()
    expect(box!.x).toBe(0)
    // No `md` a coluna e estreita, so com icones.
    expect(box!.width).toBeLessThan(100)
  })

  test('no desktop, coluna lateral com rótulos', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/inicio')

    const visible = page.locator('nav:visible')
    await expect(visible).toHaveCount(1)

    const box = await visible.boundingBox()
    expect(box!.width).toBeGreaterThan(150)
    await expect(visible.getByRole('link', { name: 'Catálogo' })).toBeVisible()
  })

  /**
   * Rolagem horizontal no celular e o defeito responsivo mais comum e o mais
   * facil de nao notar em emulador de desktop.
   */
  test('nenhuma página rola na horizontal a 360 px', async ({ page }) => {
    await page.setViewportSize(MOBILE)

    for (const path of ['/inicio', '/colecao', '/catalogo', '/trocas', '/mais', '/design-system']) {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} rola na horizontal`).toBeLessThanOrEqual(0)
    }
  })

  /**
   * A barra inferior e fixa, entao ela flutua sobre o conteudo. O `pb-20` do
   * shell e o que reserva a altura dela; sem esse respiro, o ultimo item de
   * qualquer lista fica coberto — e so da para ver isso rolando ate o fim.
   */
  test('o conteúdo não fica sob a barra inferior', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/mais')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    // A rolagem por inercia do navegador precisa assentar antes de medir.
    await page.waitForFunction(() => {
      const limite = document.documentElement.scrollHeight - window.innerHeight
      return Math.abs(window.scrollY - limite) < 2
    })

    const nav = await page.locator('nav:visible').boundingBox()
    const last = await page.getByText('Sua coleção. Do seu jeito.').boundingBox()

    expect(last!.y + last!.height).toBeLessThanOrEqual(nav!.y)
  })
})

test.describe('navegação entre seções', () => {
  test('percorre os cinco destinos e marca o ativo', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/inicio')

    for (const [label, path] of [
      ['Coleção', '/colecao'],
      ['Catálogo', '/catalogo'],
      ['Trocas', '/trocas'],
      ['Mais', '/mais'],
      ['Início', '/inicio'],
    ] as const) {
      await page.locator('nav:visible').getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(path)
      await expect(page.locator('nav:visible').getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
  })

  test('a raiz leva ao início', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/inicio')
  })
})

test.describe('tema', () => {
  /**
   * O ponto do script sincrono no `<head>` e nao piscar. Aqui isso vira uma
   * afirmacao verificavel: com a escolha ja guardada, o documento **ja chega**
   * pintado de escuro, sem passar pelo claro.
   */
  test('a escolha vale desde a primeira pintura', async ({ page }) => {
    await page.goto('/inicio')
    await page.evaluate(() => localStorage.setItem('colexa:theme', 'dark'))
    await page.reload()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).toBe('rgb(19, 18, 25)')

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--colexa-accent').trim(),
    )
    expect(accent).toBe('#504797')
  })

  test('a paleta oficial vale no tema claro', async ({ page }) => {
    await page.goto('/inicio')
    await page.evaluate(() => localStorage.setItem('colexa:theme', 'light'))
    await page.reload()

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).toBe('rgb(242, 242, 243)')

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--colexa-accent').trim(),
    )
    expect(accent).toBe('#38287b')
  })

  test('a escolha sobrevive à navegação', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/mais')

    await page.getByRole('radio', { name: 'Escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('link', { name: 'Catálogo' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('acessibilidade do shell', () => {
  test('o atalho de pular para o conteúdo aparece ao focar', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/inicio')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
  })

  test('cada página tem um h1', async ({ page }) => {
    for (const [path, title] of [
      ['/inicio', 'Início'],
      ['/colecao', 'Minha Coleção'],
      ['/catalogo', 'Catálogo'],
      ['/trocas', 'Trocas'],
      ['/mais', 'Mais'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    }
  })
})
