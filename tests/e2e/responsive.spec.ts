import { expect, test } from '@playwright/test'

/**
 * Responsividade do shell e do tema.
 *
 * As tres larguras sao as de `architecture.md` 4.1: 360 e o celular pequeno que
 * o projeto toma como piso, 768 e a entrada do `md`, 1280 e o desktop.
 *
 * O que se verifica e a **exclusividade**: em cada largura existe exatamente uma
 * navegacao alcancavel. O erro que isto pega e a coluna e a gaveta aparecendo
 * juntas, que nenhum teste em jsdom enxerga — para o jsdom, `md:hidden` e so
 * uma string.
 *
 * Desde a decisao 061 o celular usa uma **gaveta**, e nao uma barra: fechada,
 * ela nao poe navegacao nenhuma na tela, e o botao que a abre e o que precisa
 * existir.
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
  test('no celular, nenhuma navegação ocupa a tela até alguém pedir', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto(SHELL)

    // A coluna lateral existe no HTML — e assim que um layout unico atende os
    // tres tamanhos — mas sai da arvore de acessibilidade junto com o
    // `display: none`. Fechada, a gaveta tambem nao poe nada la.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Abrir o menu' })).toBeVisible()
  })

  test('no celular, a gaveta abre com todos os destinos', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto(SHELL)
    await page.getByRole('button', { name: 'Abrir o menu' }).click()

    const nav = page.locator(MAIN_NAV)
    await expect(nav).toHaveCount(1)
    // O teto de cinco era da barra; a gaveta cabe o produto inteiro.
    await expect(nav.getByRole('link', { name: 'Catálogo' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Social' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Minha conta' })).toBeVisible()
  })

  test('no tablet, a coluna lateral já vem com rótulos', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto(SHELL)

    const visible = page.locator(MAIN_NAV)
    await expect(visible).toHaveCount(1)

    const box = await visible.boundingBox()
    expect(box!.x).toBe(0)
    // Antes a coluna era so de icones ate o `lg`. O dono do produto pediu para
    // abrir de vez: no computador ha espaco, e icone sem palavra e enigma.
    expect(box!.width).toBeGreaterThan(150)
    await expect(visible.getByRole('link', { name: 'Catálogo' })).toBeVisible()

    // E o botao da gaveta some: duas navegacoes ao mesmo tempo seriam dois
    // jeitos de ir ao mesmo lugar, e um deles esconderia o outro.
    await expect(page.getByRole('button', { name: 'Abrir o menu' })).toBeHidden()
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
   * A gaveta substituiu a barra fixa, e com ela foi embora a reserva de altura
   * que o conteudo precisava embaixo. Este teste virou o oposto do que era:
   * antes media o respiro, agora confere que **nao ha** navegacao cobrindo o
   * fim da pagina.
   */
  test('o conteúdo chega até o fim da tela no celular', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto(SHELL)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForFunction(() => {
      const limite = document.documentElement.scrollHeight - window.innerHeight
      return Math.abs(window.scrollY - limite) < 2
    })

    // O último bloco do guia de estilo. Ancorar num texto do fim é o que torna
    // a medida sensível a qualquer coisa flutuando por cima.
    const last = await page.getByRole('heading', { name: 'Avatar' }).boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(MOBILE.height)

    await expect(page.locator(MAIN_NAV)).toHaveCount(0)
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

/**
 * Hidratacao sem divergencia.
 *
 * Divergencia de hidratacao nao e aviso: o React joga fora o HTML do servidor e
 * refaz a arvore no cliente. Recupera, mas paga o preco inteiro de renderizar
 * de novo — e num aparelho lento isso aparece.
 *
 * O caso guardado aqui e o do tema, que e o candidato natural: o valor vem do
 * `localStorage`, que so existe no cliente. Hoje ele esta correto — quem
 * resolve e o `getServerSnapshot` do `useSyncExternalStore`, que o React usa
 * durante a hidratacao —, e o teste existe para continuar assim.
 *
 * Isso nao aparece em teste de componente: o jsdom nao renderiza no servidor,
 * entao nao ha o que divergir. So um navegador de verdade, com SSR de verdade,
 * pega.
 */
test.describe('hidratacao', () => {
  const erros = (page: import('@playwright/test').Page) => {
    const encontrados: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') encontrados.push(message.text())
    })
    page.on('pageerror', (error) => encontrados.push(error.message))
    return encontrados
  }

  test('nao diverge com o tema padrao', async ({ page }) => {
    const encontrados = erros(page)

    await page.goto(SHELL)
    await expect(page.getByRole('radio', { name: 'Sistema' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    expect(encontrados.filter((e) => /hydrat/i.test(e))).toEqual([])
  })

  /** O caso que quebrava: tema guardado antes de a pagina carregar. */
  test('nao diverge com um tema ja escolhido', async ({ page }) => {
    await page.goto(SHELL)
    await page.evaluate(() => window.localStorage.setItem('colexa:theme', 'dark'))

    const encontrados = erros(page)
    await page.reload()

    await expect(page.getByRole('radio', { name: 'Escuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(encontrados.filter((e) => /hydrat/i.test(e))).toEqual([])
  })
})
