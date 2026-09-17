import { expect, test } from '@playwright/test'

/**
 * As proteções que só aparecem numa resposta de verdade (decisão 092).
 *
 * Roda contra o build de produção, como os testes de responsividade: cabeçalho
 * e página de erro dependem da configuração e do servidor, e não do React.
 */

test.describe('cabeçalhos de segurança', () => {
  test('ninguém embute o ColeXa, e a pilha não é anunciada', async ({ page }) => {
    const resposta = await page.goto('/entrar')
    const headers = resposta!.headers()

    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('fora do domínio oficial, pede para não indexar', async ({ page }) => {
    const resposta = await page.goto('/entrar')
    // O teste roda em localhost, que não é o domínio oficial.
    expect(resposta!.headers()['x-robots-tag']).toBe('noindex, nofollow')
  })
})

test.describe('endereço que não existe', () => {
  test('responde 404 e explica em português, com caminho de volta', async ({ page }) => {
    const resposta = await page.goto('/pagina-que-nao-existe')

    expect(resposta!.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Não encontramos esta página' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir para o início' })).toBeVisible()
  })
})
