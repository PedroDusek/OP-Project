import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Field, Input } from '@/components/ui/field'

describe('Field', () => {
  /**
   * Secao 18: campos com labels acessiveis. O teste que prova isso e achar o
   * campo **pelo rotulo** — se a associacao quebrar, `getByLabelText` nao
   * encontra, mesmo com o texto visivel na tela.
   */
  it('liga o rotulo ao campo', async () => {
    render(<Field label="Nome do local">{(props) => <Input {...props} />}</Field>)

    const input = screen.getByLabelText('Nome do local')
    await userEvent.type(input, 'Binder Principal')

    expect(input).toHaveValue('Binder Principal')
  })

  it('liga o erro ao campo e o marca como invalido', () => {
    render(
      <Field label="E-mail" error="Informe um e-mail válido.">
        {(props) => <Input {...props} />}
      </Field>,
    )

    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/informe um e-mail válido/i)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
  })

  it('descreve pelo texto de ajuda quando nao ha erro', () => {
    render(
      <Field label="Descrição" hint="Opcional.">
        {(props) => <Input {...props} />}
      </Field>,
    )

    expect(screen.getByLabelText('Descrição')).toHaveAccessibleDescription('Opcional.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mantem o rotulo acessivel mesmo escondido', () => {
    render(
      <Field label="Buscar" hideLabel>
        {(props) => <Input {...props} />}
      </Field>,
    )

    expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
  })
})
