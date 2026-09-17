import { ACCOUNT_DELETION_GRACE_DAYS } from './deletion'

/**
 * O e-mail que confirma o pedido de exclusão (decisão 091).
 *
 * Camada: domain. Puro: monta o texto, não envia.
 *
 * Diz a data e como desistir. É o único lugar onde a pessoa lê isso depois de
 * sair da tela, e trinta dias é tempo de esquecer que o prazo existe.
 */

const dia = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' })

export function deletionRequestEmail(input: { to: string; name: string; dueAt: Date; appUrl: string }) {
  const entrar = `${input.appUrl.replace(/\/+$/, '')}/entrar`
  const text = [
    `Olá, ${input.name}.`,
    '',
    'Recebemos o pedido para excluir a sua conta no ColeXa.',
    '',
    `Ela está suspensa e será excluída em ${dia.format(input.dueAt)}. Até lá, se mudar de ideia, basta entrar de novo na sua conta: o pedido é cancelado na hora.`,
    '',
    `Entrar: ${entrar}`,
    '',
    `Depois desse prazo de ${ACCOUNT_DELETION_GRACE_DAYS} dias, seu nome, seu e-mail, sua coleção, seus binders e sua want list são apagados, e não há como recuperar. Trocas concluídas e mensagens enviadas continuam para a outra pessoa, com o nome "Conta excluída".`,
    '',
    'Se não foi você quem pediu, entre na sua conta agora e troque a senha.',
  ].join('\n')

  return { to: input.to, subject: 'Pedido de exclusão da sua conta no ColeXa', text }
}
