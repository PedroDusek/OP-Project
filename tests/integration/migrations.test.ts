import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { disconnect, testPrisma } from '../helpers'

/**
 * Garantias sobre as migrations.
 *
 * O Prisma nao gera migrations de descida. "Rollback" aqui significa duas
 * coisas verificaveis: uma migration que falha nao deixa estado parcial, e o
 * banco produzido pelas migrations corresponde exatamente ao schema.
 * Ver docs/development.md.
 */

afterAll(async () => {
  await disconnect()
})

function prismaCli(args: string[]): string {
  return execFileSync('npx', ['prisma', ...args], {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    encoding: 'utf8',
    shell: true,
  })
}

describe('migrations', () => {
  it('produzem um banco sem drift em relacao ao schema', async () => {
    // Se algo tiver sido criado em SQL bruto que o Prisma tambem gerencia, ele
    // aparece aqui como um DROP ou CREATE pendente e este teste falha.
    const output = prismaCli([
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ])
    expect(output).toContain('This is an empty migration.')
  })

  it('registram como aplicada toda migration presente no repositorio', async () => {
    // Compara com o diretorio em vez de uma lista fixa: uma lista fixa
    // quebraria a cada migration nova sem apontar nenhum defeito real.
    const onDisk = readdirSync(
      fileURLToPath(new URL('../../prisma/migrations', import.meta.url)),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    const rows = await testPrisma().$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >(
      `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
       ORDER BY migration_name`,
    )

    expect(onDisk.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.migration_name)).toEqual(onDisk)
    for (const row of rows) {
      expect(row.finished_at, `${row.migration_name} nao terminou`).not.toBeNull()
      expect(row.rolled_back_at, `${row.migration_name} sofreu rollback`).toBeNull()
    }
  })

  it('aplicam DDL de forma transacional, entao uma falha nao deixa estado parcial', async () => {
    // E isto que torna uma migration interrompida segura no PostgreSQL: o DDL
    // participa da transacao e some inteiro no rollback.
    const db = testPrisma()

    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('CREATE TABLE "_rollback_probe" (id INT)')
        await tx.$executeRawUnsafe('ALTER TABLE "_rollback_probe" ADD COLUMN nome TEXT')
        throw new Error('falha proposital no meio da migration')
      }),
    ).rejects.toThrow('falha proposital')

    const leftovers = await db.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_rollback_probe'`,
    )
    expect(leftovers).toEqual([])
  })
})
