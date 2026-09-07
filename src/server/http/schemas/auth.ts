import { z } from 'zod'

/**
 * Entrada dos formularios de conta.
 *
 * Camada: http. Valida forma, nunca regra de negocio.
 *
 * A validacao acontece **no servidor**, na Server Action, e nao apenas no
 * navegador: um formulario e um endpoint, e HTML `required` e conveniencia de
 * quem digita, nao garantia de quem recebe.
 */

const email = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail.')
  .email('Esse e-mail não parece válido.')
  // Guarda em minusculas: a unicidade no nosso banco e por indice simples, e
  // enderecos que diferem so na caixa sao a mesma conta.
  .transform((value) => value.toLowerCase())

/**
 * Oito caracteres, sem exigir maiuscula, numero e simbolo.
 *
 * Regra de composicao empurra as pessoas para "Senha1!" e para reusar a mesma
 * senha em todo lugar. Comprimento e o que de fato dificulta adivinhacao, e e a
 * recomendacao atual do NIST. O minimo do proprio Supabase e 6; pedimos mais.
 */
const password = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha.'),
  remember: z.boolean().default(false),
})

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Informe seu nome.')
      .max(120, 'Nome muito longo.'),
    email,
    password,
    passwordConfirmation: z.string(),
    acceptedTerms: z.literal(true, {
      message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.',
    }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não coincidem.',
  })

export const passwordResetSchema = z.object({ email })

export const newPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não coincidem.',
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
