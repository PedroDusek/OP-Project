import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from '@/components/ui/password-input'
import { Divider } from '@/components/ui/divider'
import { Input } from '@/components/ui/field'
import { FieldError, FormAlert, SentToEmail } from '@/components/auth/form-parts'

vi.mock('@/app/(auth)/actions', () => ({
  startOAuthAction: vi.fn(),
  signOutAction: vi.fn(),
}))

describe('Checkbox', () => {
  it('o rótulo faz parte do alvo', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Checkbox
        id="termos"
        label="Concordo com os Termos de Uso"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    )

    await userEvent.click(screen.getByText('Concordo com os Termos de Uso'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('liga o erro à caixa e o anuncia', () => {
    render(
      <Checkbox
        id="termos"
        label="Concordo"
        error="É preciso aceitar os Termos de Uso."
      />,
    )

    const box = screen.getByRole('checkbox')
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAccessibleDescription(/aceitar os termos/i)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('envia o valor no formulário quando marcada', async () => {
    let sent: FormData | null = null

    function Harness() {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            sent = new FormData(event.currentTarget)
          }}
        >
          <Checkbox id="remember" name="remember" defaultChecked label="Lembrar de mim" />
          <button type="submit">Enviar</button>
        </form>
      )
    }

    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(sent!.get('remember')).not.toBeNull()
  })
})

describe('PasswordInput', () => {
  /**
   * Começa escondida: quem está num lugar público não deve precisar de nenhuma
   * ação para manter a senha fora da tela.
   */
  it('esconde a senha por padrão', () => {
    render(<PasswordInput id="password" placeholder="Senha" />)

    expect(screen.getByPlaceholderText('Senha')).toHaveAttribute('type', 'password')
  })

  it('alterna a visibilidade e anuncia a ação, não o estado', async () => {
    render(<PasswordInput id="password" placeholder="Senha" />)

    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle)

    expect(screen.getByPlaceholderText('Senha')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('preserva o que foi digitado ao alternar', async () => {
    render(<PasswordInput id="password" placeholder="Senha" />)

    const field = screen.getByPlaceholderText('Senha')
    await userEvent.type(field, 'minha-senha')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))

    expect(screen.getByPlaceholderText('Senha')).toHaveValue('minha-senha')
  })
})

describe('Input com ícone', () => {
  it('mantém o ícone fora da árvore de acessibilidade', () => {
    render(
      <>
        <label htmlFor="email">E-mail</label>
        <Input id="email" icon={<svg data-testid="icone" />} />
      </>,
    )

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByTestId('icone').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('Divider', () => {
  it('anuncia como separador com o rótulo', () => {
    render(<Divider label="ou" />)
    expect(screen.getByRole('separator')).toHaveTextContent('ou')
  })
})

describe('peças de formulário', () => {
  it('o erro geral anuncia sozinho', () => {
    render(<FormAlert message="E-mail ou senha incorretos." />)
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('sem mensagem, nada aparece', () => {
    render(<FormAlert />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('o erro de campo mostra apenas a primeira mensagem', () => {
    render(<FieldError id="email-error" messages={['Primeira.', 'Segunda.']} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Primeira.')
    expect(screen.queryByText('Segunda.')).not.toBeInTheDocument()
  })

  /**
   * Repetir o endereço de volta importa: errar uma letra no próprio e-mail é o
   * motivo mais comum de a mensagem "não chegar".
   */
  it('a confirmação repete o endereço', () => {
    render(
      <SentToEmail
        state={{ status: 'sent', email: 'pessoa@example.test' }}
        title="Confira seu e-mail"
        description="Enviamos um link."
      />,
    )

    expect(screen.getByText('pessoa@example.test')).toBeInTheDocument()
  })

  it('não aparece antes do envio', () => {
    render(
      <SentToEmail state={{ status: 'idle' }} title="Confira" description="Enviamos um link." />,
    )
    expect(screen.queryByText('Confira')).not.toBeInTheDocument()
  })
})

describe('SocialButtons', () => {
  it('não desenha nada, nem o separador, sem provedor ligado', async () => {
    const { SocialButtons } = await import('@/components/auth/social-buttons')
    render(<SocialButtons providers={[]} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('desenha um botão por provedor ligado', async () => {
    const { SocialButtons } = await import('@/components/auth/social-buttons')
    render(<SocialButtons providers={['google', 'apple']} />)

    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar com a Apple' })).toBeInTheDocument()
    expect(screen.getByRole('separator')).toHaveTextContent('ou')
  })

  it('chama o provedor pedido', async () => {
    const { SocialButtons } = await import('@/components/auth/social-buttons')
    const { startOAuthAction } = await import('@/app/(auth)/actions')

    render(<SocialButtons providers={['google']} next="/colecao" />)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar com o Google' }))

    expect(startOAuthAction).toHaveBeenCalledWith('google', '/colecao')
  })
})

/**
 * O formulário mantém o que foi digitado quando o envio falha. Sem isso, um erro
 * de senha apagaria o e-mail já preenchido, e o segundo erro seria de digitação.
 */
describe('campo não controlado', () => {
  it('mantém o valor entre renderizações do estado do formulário', async () => {
    function Harness() {
      const [erro, setErro] = useState<string | undefined>()
      return (
        <>
          <FormAlert message={erro} />
          <label htmlFor="email">E-mail</label>
          <Input id="email" name="email" defaultValue="" />
          <button type="button" onClick={() => setErro('E-mail ou senha incorretos.')}>
            Falhar
          </button>
        </>
      )
    }

    render(<Harness />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'pessoa@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Falhar' }))

    expect(screen.getByLabelText('E-mail')).toHaveValue('pessoa@example.test')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
