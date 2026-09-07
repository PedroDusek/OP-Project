import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

/**
 * Secao 3.3: sans-serif moderna, geometrica ou neo-grotesca, com fallback
 * seguro. A Geist e neo-grotesca e vem com o Next; o fallback do sistema esta
 * em `--font-sans`, em `globals.css`.
 */
const sans = Geist({
  variable: '--font-colexa-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ColeXa',
    template: '%s · ColeXa',
  },
  description:
    'Organize, acompanhe e evolua sua coleção do One Piece Card Game: catálogo, coleção, armazenamento, wants e trocas.',
  applicationName: 'ColeXa',
  // Nenhum dado de catalogo aqui: o produto e uma ferramenta de colecao, e a
  // decisao 020 nos obriga a nunca reexpor o catalogo da fonte.
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  // A barra do navegador acompanha o tema, nos dois casos.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F3' },
    { media: '(prefers-color-scheme: dark)', color: '#131219' },
  ],
  // `viewport-fit=cover` e o que faz `env(safe-area-inset-*)` valer alguma
  // coisa no iPhone; sem ele a barra inferior nao encosta no gesto de casa.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${sans.variable} h-full`} suppressHydrationWarning>
      <head>
        {/*
          Roda antes da primeira pintura para aplicar o tema escolhido. Sem ele,
          quem escolheu escuro num sistema claro ve a pagina branca ate o React
          hidratar. Ver `src/lib/theme.ts`.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
