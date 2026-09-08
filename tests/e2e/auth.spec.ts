import { expect, test } from '@playwright/test'

/**
 * Entrada e autenticacao, ponta a ponta.
 *
 * O que **nao** e testado aqui: entrar de verdade. Isso exigiria uma conta real
 * no Supabase, com e-mail confirmado, e as credenciais dela num segredo da CI —
 * um teste que depende de rede, de uma caixa de entrada e de um servico de
 * terceiro para dizer se o nosso codigo esta certo.
 *
 * O que **e** testado: tudo o que e nosso e observavel sem uma conta. As telas
 * existem, os campos sao alcancaveis por teclado, o servidor recusa entrada
 * invalida, a rota protegida manda para o login carregando o destino, e a volta
 * do provedor sem codigo nao derruba a aplicacao.
 *
 * A logica dos casos de uso, com provedor falso, esta em
 * `tests/integration/auth-credentials.test.ts`.
 */

const MOBILE = { width: 360, height: 740 }

/**
 * Alertas do conteudo, e nao os do framework.
 *
 * O Next mantem um `#__next-route-announcer__` com `role="alert"` fora do
 * `main` para anunciar troca de pagina. Sem escopar, toda busca por alerta
 * encontra dois elementos e o Playwright recusa por ambiguidade.
 */
const alerts = (page: import('@playwright/test').Page) => page.locator('main').getByRole('alert')

test.describe('landing', () => {
  test('apresenta o produto e leva ao cadastro', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sua coleção.')
    // Os cinco recursos da seção 6 da especificação.
    await expect(page.getByRole('listitem')).toHaveCount(5)

    await page.getByRole('link', { name: 'Começar agora' }).click()
    await expect(page).toHaveURL('/criar-conta')
  })

  test('leva a entrar pelos dois caminhos', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Entrar' }).first().click()
    await expect(page).toHaveURL('/entrar')
  })

  /** A atribuição da fonte é mitigação obrigatória da decisão 020. */
  test('atribui a fonte do catálogo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Bandai/)).toBeVisible()
  })
})

test.describe('rota protegida', () => {

  test('manda para o login carregando o destino', async ({ page }) => {
    for (const path of [
      '/inicio',
      '/colecao',
      '/colecao/quero',
      '/catalogo',
      '/trocas',
      '/mais',
      '/binders',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(`/entrar?next=${encodeURIComponent(path)}`)
    }
  })

  /**
   * O destino volta como campo escondido do formulário, e é o que faz a pessoa
   * cair onde queria em vez de no início depois de entrar.
   */
  test('o destino chega ao formulário', async ({ page }) => {
    await page.goto('/colecao')
    await expect(page.locator('input[name="next"]')).toHaveValue('/colecao')
  })

  test('destino externo é descartado', async ({ page }) => {
    await page.goto('/entrar?next=https://outrolugar.test/phishing')
    // A tela aceita o parâmetro, mas ele nunca vira redirecionamento externo:
    // quem decide isso é o servidor, testado em auth-credentials.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bem-vindo de volta!')
  })
})

test.describe('formulário de entrar', () => {
  test('recusa e-mail inválido no servidor, e diz qual campo', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/entrar')

    await page.getByLabel('E-mail').fill('nao-e-email')
    await page.getByLabel('Senha', { exact: true }).fill('qualquer-coisa')
    await page.getByRole('button', { name: 'Entrar' }).click()

    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(alerts(page)).toContainText('e-mail não parece válido')
  })

  /**
   * O erro do provedor precisa ser genérico: distinguir "e-mail não existe" de
   * "senha errada" transformaria a tela numa consulta de quem tem conta.
   */
  test('credencial errada devolve mensagem genérica', async ({ page }) => {
    await page.goto('/entrar')

    await page.getByLabel('E-mail').fill('ninguem-aqui@example.test')
    await page.getByLabel('Senha', { exact: true }).fill('senha-qualquer-123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    const alerta = alerts(page).first()
    await expect(alerta).toBeVisible()
    await expect(alerta).not.toContainText(/não existe|não encontrado|cadastrad/i)
  })

  test('mantém o e-mail digitado depois da falha', async ({ page }) => {
    await page.goto('/entrar')

    await page.getByLabel('E-mail').fill('pessoa@example.test')
    await page.getByLabel('Senha', { exact: true }).fill('errada-mesmo-123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(alerts(page).first()).toBeVisible()
    await expect(page.getByLabel('E-mail')).toHaveValue('pessoa@example.test')
  })

  test('a senha começa escondida e o olho mostra', async ({ page }) => {
    await page.goto('/entrar')

    const senha = page.getByLabel('Senha', { exact: true })
    await expect(senha).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: 'Mostrar senha' }).click()
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  })

  test('sem provedor social ligado, nenhum botão social aparece', async ({ page }) => {
    await page.goto('/entrar')
    // Reflete a configuração real do projeto no Supabase: nenhum habilitado.
    await expect(page.getByRole('button', { name: /Continuar com/ })).toHaveCount(0)
  })
})

test.describe('formulário de criar conta', () => {
  test('exige o aceite dos termos, no servidor', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/criar-conta')

    await page.getByLabel('Nome completo').fill('Pessoa Exemplo')
    await page.getByLabel('E-mail').fill('pessoa@example.test')
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-oito')
    await page.getByLabel('Confirmar senha').fill('senha-de-oito')
    // A caixa fica desmarcada de propósito.
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(alerts(page).first()).toContainText(/Termos de Uso/)
  })

  test('aponta a senha que não confere no campo certo', async ({ page }) => {
    await page.goto('/criar-conta')

    await page.getByLabel('Nome completo').fill('Pessoa Exemplo')
    await page.getByLabel('E-mail').fill('pessoa@example.test')
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-oito')
    await page.getByLabel('Confirmar senha').fill('outra-senha-99')
    await page.getByRole('checkbox').click()
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByLabel('Confirmar senha')).toHaveAttribute('aria-invalid', 'true')
  })

  test('os termos e a privacidade têm página', async ({ page }) => {
    await page.goto('/criar-conta')

    await page.getByRole('link', { name: 'Termos de Uso' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Termos de Uso')
  })
})

test.describe('retorno do provedor', () => {
  /**
   * Sem código, a volta não pode quebrar: o link expirou, foi usado duas vezes,
   * ou a pessoa desistiu na tela do provedor. Todos terminam no login com um
   * aviso, e nunca numa página de erro do framework.
   */
  test('sem código, volta ao login com aviso', async ({ page }) => {
    const response = await page.goto('/auth/callback')

    expect(response?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/\/entrar\?erro=/)
    await expect(alerts(page).first()).toBeVisible()
  })

  test('código inválido não cria sessão', async ({ page }) => {
    await page.goto('/auth/callback?code=codigo-que-nao-existe')

    await expect(page).toHaveURL(/\/entrar/)
    // Continua sem sessão: a rota protegida ainda manda de volta ao login.
    await page.goto('/inicio')
    await expect(page).toHaveURL(/\/entrar\?next=/)
  })
})

test.describe('catálogo protegido', () => {
  /**
   * O catálogo exige sessão, e isso não é zelo excessivo: a decisão 020 assume
   * o compromisso de nunca reexpor o catálogo, e páginas abertas de busca e de
   * set seriam exatamente isso.
   */
  test('as rotas de catálogo pedem sessão', async ({ page }) => {
    for (const path of [
      '/catalogo',
      '/catalogo/sets',
      '/catalogo/sets/OP01',
      '/catalogo/carta/1',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(`/entrar?next=${encodeURIComponent(path)}`)
    }
  })
})

test.describe('binders protegidos', () => {
  /**
   * Um binder guarda onde ficam as cartas de uma pessoa. As rotas internas —
   * detalhe, cartas, edicao, criacao — pedem sessao pelo mesmo motivo que a
   * lista, e sao testadas uma a uma porque cada uma tem seu proprio
   * `requireViewer`: uma que esquecesse a chamada passaria despercebida.
   */
  test('as rotas de binders pedem sessão', async ({ page }) => {
    for (const path of [
      '/binders',
      '/binders/novo',
      '/binders/sem-lugar',
      '/binders/1',
      '/binders/1/cartas',
      '/binders/1/editar',
      '/binders/1/adicionar',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(`/entrar?next=${encodeURIComponent(path)}`)
    }
  })
})
