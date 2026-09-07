'use client'

import { useState } from 'react'
import { BookOpen, Coins, Layers, Star, TrendingUp } from 'lucide-react'
import { Logotype, Symbol } from '@/components/brand/logo'
import { PageHeader } from '@/components/layout/app-shell'
import { ThemeControl } from '@/components/theme/theme-control'
import { Badge, StatusBadge, type TradeStatus } from '@/components/ui/badge'
import { Button, type ButtonVariant } from '@/components/ui/button'
import { Chip, ChipBar } from '@/components/ui/chip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { FilterSection, FilterSheet } from '@/components/ui/filter-sheet'
import { IconButton } from '@/components/ui/icon-button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { ListRow, Panel, PanelList } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { Avatar } from '@/components/ui/avatar'
import { CardGrid, CardTile } from '@/components/catalog/card-tile'
import { SetHeader } from '@/components/catalog/set-header'
import { SetList } from '@/components/catalog/set-list'
import { Pagination } from '@/components/ui/pagination'
import { StatTile } from '@/components/collection/stat-tile'
import { StorageCard } from '@/components/storage/storage-card'
import { TradeItem } from '@/components/trade/trade-item'

/**
 * Os exemplos usam dados obviamente ficticios e **nenhuma imagem de carta**: a
 * secao 19 proibe arte de franquia como decoracao, e um guia de estilo e
 * decoracao por definicao. Os quadros mostram o espaco reservado, que e o que
 * importa aqui — a proporcao 5/7 e o alinhamento da grade.
 */

const TOKENS: { name: string; className: string; note: string }[] = [
  { name: 'background', className: 'bg-background', note: 'Fundo da página · oficial' },
  { name: 'surface', className: 'bg-surface', note: 'Cards, barras, sheets' },
  { name: 'surface-muted', className: 'bg-surface-muted', note: 'Preenchimento discreto' },
  { name: 'accent', className: 'bg-accent', note: 'Ênfase e ações · oficial' },
  { name: 'accent-soft', className: 'bg-accent-soft', note: 'Estado selecionado' },
  { name: 'success', className: 'bg-success', note: 'Playset completo' },
  { name: 'danger', className: 'bg-danger', note: 'Remover, excluir' },
  { name: 'warning', className: 'bg-warning', note: 'Atenção' },
]

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'soft', 'ghost', 'danger']
const STATUSES: TradeStatus[] = [
  'DRAFT',
  'PROPOSED',
  'NEGOTIATING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}

export function Guide() {
  const { toast } = useToast()
  const [quantity, setQuantity] = useState(3)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('todas')
  const [chips, setChips] = useState<string[]>(['possuo'])
  const [storage, setStorage] = useState('binder')
  const [available, setAvailable] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [filters, setFilters] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const toggleChip = (value: string) =>
    setChips((current) =>
      current.includes(value) ? current.filter((c) => c !== value) : [...current, value],
    )

  return (
    <div className="w-full max-w-4xl">
      <PageHeader
        title="Guia de estilo"
        description="Todos os componentes do design system em uma tela, para revisão nos dois temas."
      />

      <div className="flex flex-col gap-6">
        <Panel className="p-3">
          <ThemeControl />
        </Panel>

        <Section title="Marca">
          <Panel className="flex flex-wrap items-center gap-6 p-5">
            <Logotype className="h-8" />
            <Symbol className="h-10" />
            <Symbol className="h-6" />
            <Symbol className="h-4" />
          </Panel>
          <p className="text-xs text-text-muted">
            Curvas do arquivo mestre da identidade. O X usa o roxo de ênfase, as letras seguem a
            cor do texto — por isso a marca acompanha o tema sem um segundo arquivo.
          </p>
        </Section>

        <Section title="Cores">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOKENS.map((token) => (
              <div key={token.name} className="flex flex-col gap-1.5">
                <div
                  className={`h-14 rounded-card border border-border ${token.className}`}
                  aria-hidden
                />
                <span className="text-xs font-medium text-text">{token.name}</span>
                <span className="text-xs text-text-subtle">{token.note}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Texto">
          <Panel className="flex flex-col gap-2 p-4">
            <p className="text-2xl font-bold text-text">Título de página</p>
            <p className="text-lg font-semibold text-text">Título de seção</p>
            <p className="text-base text-text">Corpo do texto, no tamanho padrão de leitura.</p>
            <p className="text-sm text-text-muted">Texto de apoio, secundário.</p>
            <p className="text-xs text-text-subtle">Legenda e metadado.</p>
          </Panel>
        </Section>

        <Section title="Botões">
          <div className="flex flex-wrap items-center gap-2">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
            <Button loading>Salvando</Button>
            <Button disabled>Desativado</Button>
            <IconButton label="Favoritar">
              <Star className="size-5" aria-hidden />
            </IconButton>
          </div>
          <Button block onClick={() => toast({ title: 'Salvo', tone: 'success' })}>
            Ação principal, largura total
          </Button>
        </Section>

        <Section title="Entrada">
          <div className="flex flex-col gap-4">
            <SearchBar label="Buscar" value={search} onValueChange={setSearch} placeholder="Buscar cartas, sets, personagens..." />
            <Field label="Nome do local" hint="Como você chama esse binder no dia a dia.">
              {(props) => <Input placeholder="Ex: Binder Principal" {...props} />}
            </Field>
            <Field label="E-mail" error="Informe um e-mail válido." required>
              {(props) => <Input type="email" defaultValue="pedro@" {...props} />}
            </Field>
            <Field label="Descrição">
              {(props) => <Textarea placeholder="Opcional" {...props} />}
            </Field>
            <Field label="Local de armazenamento">
              {(props) => (
                <Select
                  {...props}
                  value={storage}
                  onValueChange={setStorage}
                  label="Local de armazenamento"
                  options={[
                    { value: 'binder', label: 'Binder Principal' },
                    { value: 'caixa', label: 'Caixa Coleção 01' },
                    { value: 'deck', label: 'Deck Sabo' },
                  ]}
                />
              )}
            </Field>
            <Panel className="p-3">
              <Switch
                checked={available}
                onCheckedChange={setAvailable}
                label="Definir como disponível para troca"
                description="Move as cópias para um local com finalidade de troca."
              />
            </Panel>
            <QuantitySelector value={quantity} onValueChange={setQuantity} label="Quantidade" />
          </div>
        </Section>

        <Section title="Filtros e abas">
          <Segmented
            label="Filtro da coleção"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: 'todas', label: 'Todas', count: 1284 },
              { value: 'playsets', label: 'Playsets', count: 186 },
              { value: 'faltam', label: 'Faltam' },
            ]}
          />
          <ChipBar label="Raridade">
            {['possuo', 'sr', 'sec', 'alt-art', 'manga'].map((value) => (
              <Chip
                key={value}
                selected={chips.includes(value)}
                showCheck
                onClick={() => toggleChip(value)}
              >
                {value}
              </Chip>
            ))}
          </ChipBar>
        </Section>

        <Section title="Etiquetas e progresso">
          <div className="flex flex-wrap gap-2">
            <Badge>SR</Badge>
            <Badge tone="accent">Alternate Art</Badge>
            <Badge tone="success">Playset completo</Badge>
            <Badge tone="warning">Faltam 2</Badge>
            <Badge tone="danger">Indisponível</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
          <Panel className="flex flex-col gap-4 p-4">
            <ProgressBar label="Progresso de OP01" value={124} total={125} showNumbers />
            <ProgressBar label="Progresso de OP12" value={60} total={125} showNumbers />
            <ProgressBar label="Progresso de OP11" value={126} total={126} showNumbers />
          </Panel>
        </Section>

        <Section title="Superfícies">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value="1.284" label="Cartas" icon={<BookOpen className="size-4" />} />
            <StatTile value="742" label="Variantes" icon={<Layers className="size-4" />} />
            <StatTile value="186" label="Playsets" icon={<Star className="size-4" />} />
            <StatTile value="R$ 8.421" label="Valor estimado" icon={<TrendingUp className="size-4" />} />
          </div>
          <PanelList>
            <ListRow
              leading={<Coins className="size-5 text-text-muted" aria-hidden />}
              title="Assinatura Premium"
              description="7 dias grátis restantes"
              onClick={() => toast('Exemplo de linha de lista')}
            />
            <ListRow title="Meus TCGs" description="One Piece (ativo)" onClick={() => {}} />
            <ListRow title="Sair da conta" tone="danger" hideChevron onClick={() => setConfirm(true)} />
          </PanelList>
          <div className="grid gap-3 sm:grid-cols-2">
            <StorageCard name="Binder Principal" type="BINDER" purpose="COLLECTION" cardCount={48} href="#" />
            <StorageCard name="Caixa Troca" type="BOX" purpose="TRADE" cardCount={74} href="#" />
            <StorageCard name="Deck Sabo" type="DECK" cardCount={50} href="#" />
          </div>
        </Section>

        <Section title="Cartas">
          <CardGrid>
            {[
              { code: 'OP01-001', name: 'Exemplo', quantity: 4, labels: ['SR'] },
              { code: 'OP01-002', name: 'Exemplo', quantity: 1 },
              { code: 'OP01-003', name: 'Exemplo', quantity: 0 },
              { code: 'OP01-004', name: 'Exemplo', quantity: 2, labels: ['Alt Art'] },
              { code: 'OP01-005', name: 'Exemplo', quantity: 3 },
              { code: 'OP01-006', name: 'Exemplo', quantity: 4 },
            ].map((card) => (
              <CardTile key={card.code} {...card} imageUrl={null} />
            ))}
          </CardGrid>
          <p className="text-xs text-text-muted">
            Sem imagem de carta neste guia, por causa da diretriz de propriedade intelectual. O
            quadro cinza é o espaço reservado, na proporção 5/7 da carta física.
          </p>
          <Panel className="px-3">
            <TradeItem code="OP01-001" name="Exemplo" imageUrl={null} variantLabel="Normal" quantity={2} marketValue="R$ 80" onRemove={() => {}} />
            <TradeItem code="OP03-013" name="Exemplo" imageUrl={null} variantLabel="Alt Art" quantity={1} marketValue="R$ 180" onRemove={() => {}} />
          </Panel>
        </Section>

        <Section title="Catálogo">
          <SetHeader
            set={{
              code: 'OP01',
              name: '-ROMANCE DAWN-',
              displayName: 'ROMANCE DAWN',
              variantCount: 154,
            }}
          />
          <p className="text-xs text-text-muted">
            O cabeçalho do set usa forma e cor próprias. A tela de referência abre com arte de
            mangá, que a diretriz de propriedade intelectual não permite como decoração — e o
            modelo de dados não guarda capa de set.
          </p>

          <SetList
            sets={[
              { code: 'OP01', name: '-ROMANCE DAWN-', displayName: 'ROMANCE DAWN', variantCount: 154 },
              { code: 'OP-13', name: '-CARRYING ON HIS WILL-', displayName: 'CARRYING ON HIS WILL', variantCount: 175 },
              { code: 'ST-01', name: '-Straw Hat Crew-', displayName: 'Straw Hat Crew', variantCount: 17 },
              { code: 'PROMO', name: 'One Piece Promotion Cards', displayName: 'One Piece Promotion Cards', variantCount: 537 },
            ]}
          />

          <Pagination page={3} totalPages={12} hrefFor={(page) => `#pagina-${page}`} />
        </Section>

        <Section title="Sobreposições">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Bottom sheet
            </Button>
            <Button variant="secondary" onClick={() => setFilters(true)}>
              Painel de filtros
            </Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Confirmação destrutiva
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: 'Coleção atualizada', description: '12 cartas alteradas.', tone: 'success' })}>
              Toast
            </Button>
          </div>
        </Section>

        <Section title="Estados">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="mt-4">
              <CardGridSkeleton count={6} />
            </div>
          </Panel>
          <Panel>
            <EmptyState
              title="Nenhuma carta ainda"
              description="Tudo o que você adicionar aparece aqui."
              action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
            />
          </Panel>
          <Panel>
            <ErrorState description="Verifique sua conexão e tente de novo." onRetry={() => {}} />
          </Panel>
        </Section>

        <Section title="Avatar">
          <div className="flex items-center gap-3">
            <Avatar name="Pedro Dusek" size="sm" />
            <Avatar name="Pedro Dusek" />
            <Avatar name="Pedro Dusek" size="lg" />
          </div>
        </Section>
      </div>

      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        title="Adicionar à coleção"
        description="OP01-001 · Exemplo"
        footer={
          <Button block onClick={() => setSheet(false)}>
            Adicionar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <QuantitySelector value={quantity} onValueChange={setQuantity} label="Quantidade" size="lg" />
          <Field label="Local de armazenamento">
            {(props) => (
              <Select
                {...props}
                value={storage}
                onValueChange={setStorage}
                label="Local de armazenamento"
                options={[
                  { value: 'binder', label: 'Binder Principal' },
                  { value: 'caixa', label: 'Caixa Coleção 01' },
                ]}
              />
            )}
          </Field>
          <Switch
            checked={available}
            onCheckedChange={setAvailable}
            label="Definir como disponível para troca"
          />
        </div>
      </Sheet>

      <FilterSheet
        open={filters}
        onOpenChange={setFilters}
        onApply={() => setFilters(false)}
        onClear={() => setChips([])}
        activeCount={chips.length}
      >
        <FilterSection title="Raridade">
          <div className="flex flex-wrap gap-2">
            {['C', 'UC', 'R', 'SR', 'SEC'].map((value) => (
              <Chip
                key={value}
                selected={chips.includes(value)}
                onClick={() => toggleChip(value)}
              >
                {value}
              </Chip>
            ))}
          </div>
        </FilterSection>
        <FilterSection title="Variante">
          <div className="flex flex-wrap gap-2">
            {['Normal', 'Alt Art', 'Manga', 'Promo'].map((value) => (
              <Chip
                key={value}
                selected={chips.includes(value)}
                onClick={() => toggleChip(value)}
              >
                {value}
              </Chip>
            ))}
          </div>
        </FilterSection>
      </FilterSheet>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Excluir o Binder Principal?"
        description="As 48 cartas continuam na sua coleção, mas deixam de ter localização registrada. Não dá para desfazer."
        confirmLabel="Excluir local"
        onConfirm={() => {
          setConfirm(false)
          toast({ title: 'Local excluído', tone: 'success' })
        }}
      />
    </div>
  )
}
