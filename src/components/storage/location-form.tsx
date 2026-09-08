'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { BookOpen, Box, ImagePlus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Panel } from '@/components/ui/surface'
import { LocationArt } from './location-art'
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  STORAGE_PURPOSE_LABEL,
  STORAGE_TYPE_LABEL,
  requiresPurpose,
  type StoragePurpose,
  type StorageType,
} from '@/server/domain/storage/locations'
import { ACCEPT_ATTRIBUTE, MAX_IMAGE_BYTES } from '@/server/domain/storage/image'
import { prepareImage } from '@/lib/prepare-image'
import { LOCATION_IDLE, type LocationFormState } from '@/app/(app)/binders/state'
import { cn } from '@/lib/cn'

/**
 * Criar e editar um local (telas 24 e 22).
 *
 * É o mesmo formulário nos dois casos: os campos são os mesmos, e ter duas
 * telas faria a edição divergir da criação no dia em que um campo mudasse.
 *
 * ## Os campos são controlados
 *
 * O React reinicia o `<form action={...}>` quando a ação termina, **inclusive
 * em erro**. Com campos não controlados, um nome recusado por ser longo demais
 * some junto com a mensagem que explica por quê.
 *
 * ## A foto aparece antes de salvar
 *
 * Escolher a foto e não ver nada acontecer é indistinguível de a escolha não
 * ter funcionado — foi o primeiro relato de quem usou. O quadro aparece assim
 * que o arquivo é escolhido, com o mesmo recorte que o local vai ter.
 *
 * A foto também é encolhida aqui, no aparelho, antes de sair. Uma foto de
 * celular tem 3 a 5 MB e estourava o corpo da Server Action; e o iPhone entrega
 * HEIC em algumas situações, que o servidor recusa pelos bytes. Passar pelo
 * canvas resolve os dois. Ver `lib/prepare-image.ts`.
 *
 * O arquivo preparado volta para o próprio `<input type="file">`, e não para um
 * campo paralelo: assim o formulário continua sendo enviado pelo navegador, do
 * jeito de sempre, e nada precisa saber que houve conversão.
 *
 * ## A finalidade e o tipo andam juntos
 *
 * Deck não tem finalidade (`business-rules.md` 3.1). O campo fica desabilitado
 * em vez de sumir: sumir faria a tela pular de altura a cada troca de tipo, e a
 * frase ao lado explica a ausência melhor do que o espaço vazio.
 */

const TYPE_ICON: Record<StorageType, React.ElementType> = {
  BINDER: BookOpen,
  BOX: Box,
  DECK: Layers,
}

export interface LocationFormValues {
  id?: string
  name: string
  description: string
  type: StorageType
  purpose: StoragePurpose | null
  image: string | null
}

export interface LocationFormProps {
  action: (state: LocationFormState, data: FormData) => Promise<LocationFormState>
  initial?: Partial<LocationFormValues>
  submitLabel: string
  /** Sem provedor de imagens configurado, o campo de foto nem aparece. */
  imageUploadAvailable: boolean
}

export function LocationForm({
  action,
  initial,
  submitLabel,
  imageUploadAvailable,
}: LocationFormProps) {
  const [state, submit, pending] = useActionState(action, LOCATION_IDLE)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<StorageType>(initial?.type ?? 'BINDER')
  const [purpose, setPurpose] = useState<StoragePurpose>(initial?.purpose ?? 'COLLECTION')
  const [removeImage, setRemoveImage] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const fileId = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  /**
   * Prepara o arquivo escolhido e o devolve ao próprio campo.
   *
   * `DataTransfer` é o jeito de trocar o conteúdo de um `<input type="file">`:
   * sem isso, o formulário enviaria o original de 5 MB que acabou de ser
   * descartado.
   */
  const chooseFile = async (input: HTMLInputElement) => {
    const chosen = input.files?.[0]
    if (!chosen) return

    setPreparing(true)
    try {
      const prepared = await prepareImage(chosen)

      try {
        const transfer = new DataTransfer()
        transfer.items.add(prepared)
        input.files = transfer.files
      } catch {
        // Navegador que nao deixa trocar o conteudo do campo: segue o original,
        // e quem decide se ele serve continua sendo o servidor.
      }

      setPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(prepared)
      })
      setRemoveImage(false)
    } finally {
      setPreparing(false)
    }
  }

  const clearFile = () => {
    if (fileInput.current) fileInput.current.value = ''
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }

  const fields = state.status === 'error' ? state.fields : {}
  const withPurpose = requiresPurpose(type)

  return (
    <form action={submit} className="flex flex-col gap-5">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="Nome" required error={fields.name?.[0]}>
        {(props) => (
          <Input
            {...props}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Ex: Binder Principal"
            autoComplete="off"
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">Tipo</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STORAGE_TYPE_LABEL) as StorageType[]).map((option) => {
            const Icon = TYPE_ICON[option]
            const selected = option === type
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-control border p-3',
                  'transition-colors has-[:focus-visible]:border-accent-ink',
                  selected
                    ? 'border-accent-ink/40 bg-accent-soft text-accent-ink'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={selected}
                  onChange={() => setType(option)}
                  className="sr-only"
                />
                <Icon className="size-5" aria-hidden />
                <span className="text-sm font-medium">{STORAGE_TYPE_LABEL[option]}</span>
              </label>
            )
          })}
        </div>
        {fields.type?.[0] ? (
          <p role="alert" className="text-sm text-danger">
            {fields.type[0]}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">Finalidade</legend>
        <div className="flex flex-col gap-1">
          {(Object.keys(STORAGE_PURPOSE_LABEL) as StoragePurpose[]).map((option) => (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2.5 text-sm',
                withPurpose ? 'text-text' : 'cursor-not-allowed text-text-subtle',
              )}
            >
              <input
                type="radio"
                name="purpose"
                value={option}
                checked={withPurpose && option === purpose}
                disabled={!withPurpose}
                onChange={() => setPurpose(option)}
                className="size-4 accent-accent"
              />
              {STORAGE_PURPOSE_LABEL[option]}
            </label>
          ))}
        </div>
        <p className="text-sm text-text-muted">
          {withPurpose
            ? 'Locais de troca abastecem o seu Trade Binder.'
            : 'A finalidade não se aplica a Decks.'}
        </p>
        {fields.purpose?.[0] ? (
          <p role="alert" className="text-sm text-danger">
            {fields.purpose[0]}
          </p>
        ) : null}
      </fieldset>

      {imageUploadAvailable ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text">Foto (opcional)</p>

          {preview ? (
            <Panel className="flex items-center gap-3 p-3">
              {/*
                A foto escolhida, no mesmo recorte que o local vai ter. Não passa
                por `next/image`: é um arquivo local que ainda não subiu.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt=""
                className="size-14 shrink-0 rounded-control border border-border object-cover"
              />
              <p className="min-w-0 flex-1 text-sm text-text-muted">
                Foto escolhida. Ela entra quando você salvar.
              </p>
              <Button type="button" variant="ghost" onClick={clearFile}>
                Trocar
              </Button>
            </Panel>
          ) : initial?.image && !removeImage ? (
            <Panel className="flex items-center gap-3 p-3">
              <LocationArt image={initial.image} type={type} className="w-14" />
              <p className="min-w-0 flex-1 text-sm text-text-muted">Foto atual</p>
              <Button type="button" variant="ghost" onClick={() => setRemoveImage(true)}>
                Remover
              </Button>
            </Panel>
          ) : null}

          {removeImage ? <input type="hidden" name="removeImage" value="on" /> : null}

          <label
            htmlFor={fileId}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-1.5',
              'rounded-control border border-dashed border-border bg-surface p-6 text-center',
              'transition-colors hover:bg-surface-muted has-[:focus-visible]:border-accent-ink',
            )}
          >
            <ImagePlus className="size-5 text-text-muted" aria-hidden />
            <span className="text-sm font-medium text-text">
              {preparing ? 'Preparando a foto...' : preview ? 'Escolher outra foto' : 'Adicionar foto'}
            </span>
            <span className="text-xs text-text-subtle">
              PNG ou JPG, até {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB
            </span>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              name="image"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(event) => void chooseFile(event.currentTarget)}
            />
          </label>

          {fields.image?.[0] ? (
            <p role="alert" className="text-sm text-danger">
              {fields.image[0]}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field label="Descrição (opcional)" error={fields.description?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Ex: Binder onde guardo as cartas principais..."
          />
        )}
      </Field>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block loading={pending} disabled={preparing}>
        {submitLabel}
      </Button>
    </form>
  )
}
