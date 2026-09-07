import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandWatermark } from '@/components/brand/watermark'
import { Logotype } from '@/components/brand/logo'

/**
 * Moldura das telas de conta.
 *
 * Sem o shell do app: quem ainda nao entrou nao tem coleção, catálogo nem
 * trocas, e uma barra de navegação com cinco destinos que exigem sessão só
 * ofereceria caminhos que terminam de volta aqui.
 *
 * Uma coluna estreita e centrada nos três tamanhos. Formulário de conta não
 * ganha nada em ficar largo no desktop: linha comprida atrapalha a leitura, e o
 * conteúdo é o mesmo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <BrandWatermark />

      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <Link
          href="/"
          aria-label="Voltar ao início"
          className="-ml-2 inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <span className="flex-1" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-10">
        <div className="flex w-full max-w-sm flex-1 flex-col">
          <Link href="/" className="mx-auto mt-2 mb-8 inline-flex" aria-label="ColeXa">
            <Logotype className="h-6" label={null} />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}
