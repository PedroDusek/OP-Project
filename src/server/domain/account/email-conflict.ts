/**
 * O mesmo e-mail entrando por outro caminho (decisão 097).
 *
 * Camada: domain. Só a mensagem: quem confere é o caso de uso.
 *
 * Definido pelo dono do produto em 18/09: **recusar com mensagem clara**, e não
 * juntar as contas. Juntar seria entregar a conta de alguém a quem provar só o
 * e-mail por outro provedor — o caminho clássico de tomada de conta quando algum
 * provedor aceita e-mail não verificado.
 */
export const EMAIL_IN_USE_MESSAGE =
  'Este e-mail já tem uma conta no ColeXa, criada com outra forma de entrar. ' +
  'Entre do mesmo jeito que da primeira vez — com e-mail e senha, ou com o Google.'
