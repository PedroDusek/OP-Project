import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Junta classes condicionais e resolve conflitos do Tailwind.
 *
 * O `twMerge` existe por um motivo especifico: todo componente daqui aceita
 * `className` de fora, e sem ele `cn('px-4', 'px-6')` deixaria as duas no
 * atributo. Qual vence passaria a depender da ordem em que o Tailwind gerou o
 * CSS, e nao da ordem em que foram escritas — que e o que quem chama espera.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
