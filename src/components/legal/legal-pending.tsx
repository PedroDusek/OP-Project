import Link from 'next/link'
import { Logotype } from '@/components/brand/logo'
import { Panel } from '@/components/ui/surface'

/**
 * Página legal ainda sem texto.
 *
 * Existe em vez de um link quebrado porque a tela de cadastro exige aceitar os
 * dois documentos, e um aceite que aponta para lugar nenhum é pior do que um
 * aceite que aponta para uma página honesta.
 *
 * O que ela **não** faz é inventar cláusula. Termos de Uso e Política de
 * Privacidade dizem o que o produto pode fazer com o dado de outra pessoa, e
 * isso é decisão do dono do produto, não do desenvolvimento.
 *
 * **É bloqueio de lançamento.** O produto não pode receber cadastro de gente
 * real com estas páginas assim. Está registrado na decisão 030 e no handoff.
 */
export function LegalPending({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4">
      <header className="flex h-14 shrink-0 items-center">
        <Link href="/" aria-label="ColeXa">
          <Logotype className="h-5" label={null} />
        </Link>
      </header>

      <main className="flex-1 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        <Panel className="mt-6 p-4">
          <p className="text-sm text-text">{description}</p>
          <p className="mt-3 text-sm text-text-muted">
            Enquanto isso, o ColeXa não está aberto ao público. Se você chegou aqui por engano,
            volte ao{' '}
            <Link href="/" className="text-accent-ink underline underline-offset-2">
              início
            </Link>
            .
          </p>
        </Panel>
      </main>
    </div>
  )
}
