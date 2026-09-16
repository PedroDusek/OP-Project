import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ParallelMapper } from '@/components/prices/parallel-mapper'
import { EmptyState } from '@/components/ui/states'
import { mappingAvailable, readMapping } from '@/server/application/prices/parallel-mapping'

export const metadata: Metadata = {
  title: 'Mapeamento das paralelas',
  robots: { index: false, follow: false },
}

// Le arquivos do disco a cada visita: o levantamento muda quando o script roda, e
// o arquivo manual muda a cada gravacao. Nada aqui pode ser gerado no build.
export const dynamic = 'force-dynamic'

/**
 * A tela de mapeamento das paralelas (decisão 068).
 *
 * Só existe fora de produção: grava `data/vinculos-manuais.json`, um arquivo do
 * repositório, e o resultado chega a qualquer ambiente pelo PR que o leva. A
 * recusa está também no caso de uso, porque a ação pode ser chamada sem a
 * página.
 *
 * Não pede sessão, e fica fora do shell: não há dado de pessoa aqui, e ela não é
 * destino de navegação.
 */
export default function ParalelasPage() {
  if (!mappingAvailable()) notFound()

  const { candidates, answered, manual } = readMapping()

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Mapeamento das paralelas</h1>
        <p className="text-sm text-text-muted">
          Qual produto do TCGplayer é cada arte: as paralelas sem vínculo, as que a página da Liga
          aponta para outro produto e as normais sem preço. A resposta vai para{' '}
          <code>data/vinculos-manuais.json</code>; a importação de preço é quem a aplica.
        </p>
        {candidates ? (
          <p className="text-xs text-text-subtle">
            Levantamento de {formatarData(candidates.geradoEm)} · {candidates.cartas.length} cartas ·{' '}
            {answered} {answered === 1 ? 'resposta' : 'respostas'} no arquivo manual
          </p>
        ) : null}
      </header>

      {candidates ? (
        <ParallelMapper cartas={candidates.cartas} manual={manual} />
      ) : (
        <EmptyState
          title="O levantamento ainda não foi gerado"
          description="Rode npm run paralelas:candidatos e recarregue esta página. Levantamento de antes de 16/09 precisa ser gerado de novo."
        />
      )}
    </main>
  )
}

function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}
