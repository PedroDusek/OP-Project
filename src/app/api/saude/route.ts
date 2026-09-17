import { NextResponse } from 'next/server'

/**
 * A checagem de saúde da Fly.io (decisão 089).
 *
 * Camada: `app`. Diz só que o servidor está de pé, e não toca o banco nem o
 * Supabase: a Fly pergunta a cada 30 segundos, e uma checagem que dependesse do
 * banco reiniciaria a máquina por uma instabilidade de fora — sem resolver nada,
 * e tirando do ar o que ainda funcionava.
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
