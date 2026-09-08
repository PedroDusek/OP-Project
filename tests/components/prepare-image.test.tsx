import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { prepareImage } from '@/lib/prepare-image'
import { LocationForm } from '@/components/storage/location-form'

/**
 * A foto escolhida no aparelho.
 *
 * Dois defeitos relatados no primeiro uso real, e os dois estão aqui: escolher
 * a foto e não ver nada acontecer, e salvar dando "Body exceeded 1 MB limit" —
 * foto de celular tem de 3 a 5 MB.
 *
 * O jsdom não decodifica imagem nem desenha em canvas, então o que se verifica
 * é o que ele alcança: o caminho de segurança do preparo, e o que a tela mostra
 * depois da escolha.
 */

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'foto.png', {
    type: 'image/png',
  })

beforeEach(() => {
  // O jsdom nao implementa nenhum dos dois, e o preparo usa os dois.
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:previa'),
    revokeObjectURL: vi.fn(),
  })
  vi.stubGlobal(
    'DataTransfer',
    class {
      items = { add: vi.fn() }
      files = [] as unknown as FileList
    },
  )
  /*
   * O jsdom nao carrega imagem e nao dispara evento nenhum, entao o preparo
   * ficaria pendurado ate o tempo limite. Este dublê recusa na hora, que e o
   * caminho de um navegador incapaz de decodificar o arquivo.
   */
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 0
      height = 0
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preparar a imagem', () => {
  /**
   * O jsdom nao carrega imagem: `onerror` dispara e o preparo devolve o
   * original. E o mesmo caminho de um navegador que nao consegue decodificar o
   * arquivo — e nele a foto **nao pode sumir**. Quem decide o que entra
   * continua sendo o servidor, que confere os bytes.
   */
  it('devolve o arquivo original quando nao consegue decodificar', async () => {
    const original = png()

    await expect(prepareImage(original)).resolves.toBe(original)
  })
})

describe('a foto na tela de local', () => {
  const noop = async () => ({ status: 'idle' as const })

  const abrir = () =>
    render(<LocationForm action={noop} submitLabel="Criar local" imageUploadAvailable />)

  const campo = () => document.querySelector<HTMLInputElement>('input[type="file"]')!

  /**
   * Escolher a foto e nao ver nada acontecer e indistinguivel de a escolha nao
   * ter funcionado. Foi o primeiro relato de quem usou.
   */
  it('mostra a foto escolhida antes de salvar', async () => {
    abrir()

    await userEvent.upload(campo(), png())

    expect(await screen.findByText(/Foto escolhida/)).toBeInTheDocument()
    expect(document.querySelector('img[src="blob:previa"]')).not.toBeNull()
  })

  it('deixa trocar a foto escolhida', async () => {
    abrir()
    await userEvent.upload(campo(), png())
    await screen.findByText(/Foto escolhida/)

    await userEvent.click(screen.getByRole('button', { name: 'Trocar' }))

    expect(screen.queryByText(/Foto escolhida/)).not.toBeInTheDocument()
    expect(screen.getByText('Adicionar foto')).toBeInTheDocument()
  })

  it('o rotulo do campo passa a oferecer outra foto', async () => {
    abrir()

    await userEvent.upload(campo(), png())

    expect(await screen.findByText('Escolher outra foto')).toBeInTheDocument()
  })
})
