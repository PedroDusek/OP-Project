import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { ThemeControl } from '@/components/theme/theme-control'
import { applyTheme, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from '@/lib/theme'

describe('theme', () => {
  it('sistema significa nenhum atributo no documento', () => {
    applyTheme('dark', document.documentElement)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    applyTheme('system', document.documentElement)
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('guarda a escolha e devolve sistema quando nao ha nada', () => {
    expect(readStoredTheme()).toBe('system')

    storeTheme('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(readStoredTheme()).toBe('light')

    // Voltar para sistema apaga a chave em vez de gravar "system": e o padrao,
    // e uma chave a menos e uma migracao a menos no futuro.
    storeTheme('system')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('ignora valor invalido guardado', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'roxo')
    expect(readStoredTheme()).toBe('system')
  })
})

describe('ThemeControl', () => {
  it('aplica e persiste a escolha', async () => {
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true')
  })

  /**
   * Quem usa o sistema no escuro precisa conseguir pedir claro. E o caso que um
   * interruptor de duas posicoes erra, e o motivo de existirem tres opcoes.
   */
  it('permite escolher claro por cima do sistema', async () => {
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('volta a seguir o sistema', async () => {
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema' }))

    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('parte da escolha ja guardada', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )

    expect(screen.getByRole('radio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true')
  })
})
