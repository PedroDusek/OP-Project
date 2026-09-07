import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Heart, Layers, Package, TrendingUp } from 'lucide-react'
import { BrandWatermark } from '@/components/brand/watermark'
import { Logotype } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { currentViewer } from '@/server/http/viewer'

/**
 * A landing (tela 02).
 *
 * Seção 6 da especificação: proposta de valor — catálogo, coleção, storage,
 * wants e trocas, e valor da coleção. "Usar X, formas e elementos abstratos;
 * nenhuma arte de franquia", que é o que a marca d'água e os ícones fazem.
 *
 * Quem já tem sessão nunca vê esta tela: `/` leva direto ao início. Uma página
 * de apresentação para quem já é usuário só adiciona um passo entre a pessoa e
 * a coleção dela.
 */

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Catálogo completo',
    description: 'Explore todas as cartas, sets e variantes.',
  },
  {
    icon: Layers,
    title: 'Sua coleção',
    description: 'Organize, acompanhe e gerencie suas cartas.',
  },
  {
    icon: Package,
    title: 'Binders',
    description: 'Binders, caixas e decks. Tudo no seu lugar.',
  },
  {
    icon: Heart,
    title: 'Wants e trocas',
    description: 'Monte sua lista de desejos e encontre trocas.',
  },
  {
    icon: TrendingUp,
    title: 'Valor da sua coleção',
    description: 'Acompanhe a valorização ao longo do tempo.',
  },
]

export default async function LandingPage() {
  if (await currentViewer()) redirect('/inicio')

  return (
    <div className="relative flex min-h-dvh flex-col">
      <BrandWatermark />

      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Logotype className="h-5" />
        <Link
          href="/entrar"
          className="rounded-control px-3 py-2 text-sm font-medium text-accent-ink underline underline-offset-2"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 pb-8">
        <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-text">
          Sua coleção.
          <br />
          <span className="text-accent-ink">Do seu jeito.</span>
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          Organize, acompanhe e evolua sua coleção de cartas do One Piece Card Game.
        </p>

        <ul className="mt-8 flex flex-col gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5 pt-1">
                <span className="text-base font-semibold text-text">{title}</span>
                <span className="text-sm text-text-muted">{description}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3">
          <Button asChild size="lg" block>
            <Link href="/criar-conta">Começar agora</Link>
          </Button>
          <p className="text-center text-sm text-text-muted">
            Já tem uma conta?{' '}
            <Link
              href="/entrar"
              className="font-medium text-accent-ink underline underline-offset-2"
            >
              Entrar
            </Link>
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-lg px-4 pb-8">
        <p className="text-xs text-text-subtle">
          Dados de cartas do site oficial do One Piece Card Game, da Bandai. O ColeXa não tem
          vínculo, parceria ou endosso da Bandai.
        </p>
      </footer>
    </div>
  )
}
