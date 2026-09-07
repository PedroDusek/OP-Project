import Image from 'next/image'
import { BookOpen, Box, Layers } from 'lucide-react'
import { Symbol } from '@/components/brand/logo'
import type { StorageType } from '@/server/domain/storage/locations'
import { cn } from '@/lib/cn'

/**
 * A miniatura de um local de armazenamento.
 *
 * Com foto, mostra a foto. Sem foto — que é o caso de todo local até alguém
 * enviar uma —, mostra o ícone do tipo sobre a cor da marca, no mesmo arranjo
 * do selo dos sets: a marca de fundo esmaecida e o símbolo por cima.
 *
 * O ícone diz o tipo antes de qualquer texto: numa lista de sete locais, a
 * diferença entre um binder e um deck é o que a pessoa procura primeiro.
 *
 * `aria-hidden` sempre: o nome e o tipo aparecem escritos ao lado, e repeti-los
 * na imagem faria o leitor de tela ler cada linha duas vezes.
 */

const TYPE_ICON: Record<StorageType, React.ElementType> = {
  BINDER: BookOpen,
  BOX: Box,
  DECK: Layers,
}

export interface LocationArtProps {
  image: string | null
  type: StorageType
  /** Largura renderizada, para o `sizes` do otimizador. */
  sizes?: string
  className?: string
  priority?: boolean
}

export function LocationArt({
  image,
  type,
  sizes = '48px',
  className,
  priority = false,
}: LocationArtProps) {
  const Icon = TYPE_ICON[type]

  return (
    <span
      aria-hidden
      className={cn(
        'relative flex aspect-square w-12 shrink-0 items-center justify-center overflow-hidden',
        'rounded-control border border-accent/20 bg-accent-soft',
        className,
      )}
    >
      {image ? (
        <Image src={image} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <>
          <Symbol
            label={null}
            className="absolute -right-1.5 -bottom-1 h-6 w-auto opacity-20 [&_path]:fill-accent-ink"
          />
          <Icon className="relative size-5 text-accent-ink" />
        </>
      )}
    </span>
  )
}
