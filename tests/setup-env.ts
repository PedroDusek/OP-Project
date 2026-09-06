import 'dotenv/config'

/**
 * Roda antes de qualquer arquivo de teste, em cada worker.
 *
 * As rotas importam o cliente Prisma da aplicacao, que le DATABASE_URL no
 * momento em que o modulo carrega. Apontar DATABASE_URL para o banco de teste
 * aqui e o que faz o codigo de producao ser exercitado contra o banco de teste,
 * em vez de precisarmos injetar o cliente em cada rota so por causa do teste.
 */
const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL nao esta definida.')
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL e igual a DATABASE_URL. A suite apaga dados e nunca pode rodar no banco de desenvolvimento.',
  )
}
process.env.DATABASE_URL = testUrl
