import { expect, test } from '@playwright/test'

/**
 * Responsividade do shell e do tema.
 *
 * As tres larguras sao as de `architecture.md` 4.1: 360 e o celular pequeno que
 * o projeto toma como piso, 768 e a entrada do `md`, 1280 e o desktop.
 *
 * O que se verifica e a **exclusividade**: em cada largura existe exatamente uma
 * navegacao. O erro que isto pega e o par de barras aparecendo junto, que
 * nenhum teste em jsdom enxerga — para o jsdom, `md:hidden` e so uma string.
 *
 * As medidas rodam em `/design-system`, a unica rota publica que desenha o
 * shell: as cinco secoes exigem sessao, e autenticar aqui pediria uma conta real
 * no provedor. O shell e o mesmo componente nos dois lugares.
 */

const MOBILE = { width: 360, height: 740 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 800 }

/** A rota publica que renderiza o shell. */
const SHELL = '/design-system'

/**
 * A navegacao principal, pelo nome.
 *
 * `nav:visible` sozinho e frouxo demais: a pagina tem outras — a paginacao do
 * catalogo tambem e um `<nav>`. Medir "a nav visivel" so funcionava enquanto
 * houvesse uma, e o teste quebrou no dia em que apareceu a segunda.
 */
const MAIN_NAV = 'nav[aria-label="Navegação principal"]:visible'

test.describe('navegação responsiva', () => {
  test('no celular, apenas a barra inferior', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto(SHELL)

    // Uma so navegacao chega a arvore de acessibilidade. As duas existem no
    // HTML — e assim que um layout unico atende os tres tamanhos — mas a
    // escondida sai da arvore junto com o `display: none`, entao quem usa
    // leitor de tela nunca ouve os cinco destinos duas vezes.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(1)

    const box = await page.locator(MAIN_NAV).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeGreaterThan(MOBILE.height - 80)
    expect(box!.width).toBe(MOBILE.width)
  })

  test('no tablet, apenas a coluna lateral', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto(SHELL)

    const visible = page.locator(MAIN_NAV)
    await expect(visible).toHaveCount(1)

    const box = await visible.boundingBox()
    expect(box!.x).toBe(0)
    // No `md` a coluna e estreita, so com icones.
    expect(box!.width).toBeLessThan(100)
  })

  test('no desktop, coluna lateral com rótulos', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SHELL)

    const visible = page.locator(MAIN_NAV)
    await expect(visible).toHaveCount(1)

    const box = await visible.boundingBox()
    expect(box!.width).toBeGreaterThan(150)
    await expect(visible.getByRole('link', { name: 'Catálogo' })).toBeVisible()
  })

  /**
   * Rolagem horizontal no celular e o defeito responsivo mais comum e o mais
   * facil de nao notar em emulador de desktop.
   */
  test('nenhuma página pública rola na horizontal a 360 px', async ({ page }) => {
    await page.setViewportSize(MOBILE)

    for (const path of ['/', '/entrar', '/criar-conta', '/recuperar-senha', '/termos', SHELL]) {
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
    await page.goto(SHELL)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForFunction(() => {
      const limite = document.documentElement.scrollHeight - window.innerHeight
      return Math.abs(window.scrollY - limite) < 2
    })

    const nav = await page.locator(MAIN_NAV).boundingBox()
    // O último bloco do guia de estilo. Ancorar num texto do fim é o que
    // torna a medida sensível ao respiro que a barra fixa exige.
    const last = await page.getByRole('heading', { name: 'Avatar' }).boundingBox()

    expect(last!.y + last!.height).toBeLessThanOrEqual(nav!.y)
  })
})

test.describe('tema', () => {
  /**
   * O ponto do script sincrono no `<head>` e nao piscar. Aqui isso vira uma
   * afirmacao verificavel: com a escolha ja guardada, o documento **ja chega**
   * pintado de escuro, sem passar pelo claro.
   */
  test('a escolha vale desde a primeira pintura', async ({ page }) => {
    await page.goto('/')
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
    await page.goto('/')
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
    await page.goto(SHELL)

    await page.getByRole('radio', { name: 'Escuro' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.goto('/entrar')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('acessibilidade do shell', () => {
  test('o atalho de pular para o conteúdo aparece ao focar', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SHELL)

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
  })

  test('cada página pública tem um h1', async ({ page }) => {
    for (const [path, title] of [
      ['/entrar', 'Bem-vindo de volta!'],
      ['/criar-conta', 'Criar sua conta'],
      ['/recuperar-senha', 'Esqueceu a senha?'],
      ['/termos', 'Termos de Uso'],
      ['/privacidade', 'Política de Privacidade'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    }
  })
})
