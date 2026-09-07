'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Input, type InputProps } from './field'

/**
 * Campo de senha com o olho de mostrar.
 *
 * Mostrar a senha reduz erro de digitação de forma expressiva no celular, onde
 * o teclado é pequeno e o retorno é uma bolinha. É por isso que o botão existe,
 * e é por isso que ele começa desligado: quem está num lugar público não deve
 * precisar de nenhuma ação para manter a senha escondida.
 *
 * O botão anuncia a **ação**, não o estado, e o `aria-pressed` carrega o estado.
 * Um botão chamado "Senha visível" faria o leitor de tela dizer o oposto do que
 * o toque vai causar.
 */
export function PasswordInput({ ...props }: Omit<InputProps, 'type' | 'icon' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      icon={<Lock className="size-4" />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="inline-flex size-11 items-center justify-center rounded-control text-text-subtle transition-colors hover:text-text"
        >
          <Icon className="size-4" aria-hidden />
        </button>
      }
    />
  )
}
