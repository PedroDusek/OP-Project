'use client'

import { useState, useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { signOutAction } from '@/app/(auth)/actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListRow } from '@/components/ui/surface'

/**
 * Sair da conta, com confirmação.
 *
 * Sair não destrói dado, mas a seção 17 pede confirmação em ação destrutiva e
 * esta é destrutiva do ponto de vista de quem toca: no celular, "Sair" fica a
 * um dedo de distância de "Sobre", e voltar custa digitar a senha de novo — ou
 * esperar um e-mail, para quem entrou por link.
 *
 * A linha é renderizada aqui, e não recebida como filho envolvido num `onClick`:
 * envolver deixaria o alvo numa `div`, que não recebe foco de teclado nem
 * responde a Enter. `ListRow` com `onClick` vira um `<button>` de verdade.
 *
 * Sair passa pelo servidor porque apagar o cookie de sessão é do servidor.
 */
export function SignOutButton() {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <>
      <ListRow
        title="Sair da conta"
        tone="danger"
        hideChevron
        leading={<LogOut className="size-5 text-danger" aria-hidden />}
        onClick={() => setOpen(true)}
      />

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sair da conta?"
        description="Sua coleção continua guardada. Você precisará entrar de novo para acessá-la."
        confirmLabel="Sair"
        loading={pending}
        onConfirm={() => start(() => signOutAction())}
      />
    </>
  )
}
