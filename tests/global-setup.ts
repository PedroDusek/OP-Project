import 'dotenv/config'
import { execSync } from 'node:child_process'

/**
 * Prepara o banco de teste antes da suite.
 *
 * Usa `migrate deploy`, e nao `migrate dev`, por dois motivos: nao precisa de
 * shadow database (logo nao exige CREATEDB no papel da aplicacao) e e o mesmo
 * comando que a CI e o deploy executam, entao o que os testes validam e o que
 * vai para produção.
 */
export default function setup(): void {
  const testUrl = process.env.TEST_DATABASE_URL
  const devUrl = process.env.DATABASE_URL

  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL nao esta definida. Copie .env.example para .env e preencha.',
    )
  }

  // Salvaguarda: a suite trunca todas as tabelas entre os testes. Apontar para o
  // banco de desenvolvimento apagaria dados reais.
  if (testUrl === devUrl) {
    throw new Error(
      'TEST_DATABASE_URL e igual a DATABASE_URL. A suite apaga dados e nunca pode rodar no banco de desenvolvimento.',
    )
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  })
}
