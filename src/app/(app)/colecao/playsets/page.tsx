import { redirect } from 'next/navigation'

/**
 * A tela 19 mudou de endereço (decisão 114).
 *
 * Playsets saiu de dentro da coleção e virou destino próprio, com o universo do
 * catálogo e o `0/4`. Este arquivo existe para o endereço antigo continuar
 * levando a algum lugar: ele esteve em painel na coleção, e um 404 numa rota que
 * a pessoa pode ter guardado nos favoritos ensina a não guardar nenhuma.
 *
 * **Temporário (307), e não permanente.** A rota não volta, então o 308 seria o
 * semanticamente certo — mas o navegador guarda um 308 e passa a nem pedir o
 * endereço, e desfazer isso depois não está nas nossas mãos. É uma rota
 * autenticada, sem indexação (decisão 105): o 308 não traria ganho nenhum para
 * pagar esse risco.
 */
export default function PlaysetsAntigoPage() {
  redirect('/playsets')
}
