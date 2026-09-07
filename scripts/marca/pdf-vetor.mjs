// Extrai caminhos vetoriais de um content stream de PDF.
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function contentStream(file, objNum) {
  const buf = readFileSync(file)
  const s = buf.toString('latin1')
  const re = new RegExp(`(?:^|[^0-9])${objNum} 0 obj`)
  const i = s.search(re)
  const dictEnd = s.indexOf('stream', i)
  const dict = s.slice(i, dictEnd)
  const len = Number(/\/Length (\d+)/.exec(dict)[1])
  let p = dictEnd + 6
  while (s[p] === '\r' || s[p] === '\n') p++
  const data = buf.subarray(p, p + len)
  return /FlateDecode/.test(dict) ? inflateSync(data).toString('latin1') : data.toString('latin1')
}

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
]
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

const cmykToRgb = (c, m, y, k) => {
  const f = (v) => Math.round(255 * (1 - Math.min(1, v + k)))
  return [f(c), f(m), f(y)]
}
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/** Devolve subpaths em coordenadas de usuario ja transformadas pelo CTM. */
export function parsePaths(content) {
  const toks = content.match(/\/[^\s/<>[\]()]+|<<|>>|\[|\]|[-+]?[\d.]+|[A-Za-z*'"]+/g) ?? []
  const stack = []
  let ctm = [1, 0, 0, 1, 0, 0]
  let fill = [0, 0, 0]
  const args = []
  const out = []
  let sub = []
  let subs = []
  let cur = [0, 0]
  let start = [0, 0]

  const num = (i) => Number(args[args.length - i])
  const pt = (x, y) => apply(ctm, x, y)

  for (const t of toks) {
    if (/^[-+]?[\d.]+$/.test(t)) { args.push(t); continue }
    if (t.startsWith('/') || t === '[' || t === ']' || t === '<<' || t === '>>') { args.push(t); continue }
    switch (t) {
      case 'q': stack.push({ ctm, fill }); break
      case 'Q': { const s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill } break }
      case 'cm': ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], ctm); break
      case 'scn': case 'sc':
        if (args.length >= 4 && args.slice(-4).every((a) => /^[-+]?[\d.]+$/.test(a)))
          fill = cmykToRgb(num(4), num(3), num(2), num(1))
        else if (args.length >= 1 && /^[-+]?[\d.]+$/.test(args[args.length - 1]))
          fill = [0, 0, 0]
        break
      case 'g': { const v = Math.round(num(1) * 255); fill = [v, v, v]; break }
      case 'rg': fill = [num(3), num(2), num(1)].map((v) => Math.round(v * 255)); break
      case 'k': fill = cmykToRgb(num(4), num(3), num(2), num(1)); break
      case 'm': if (sub.length) subs.push(sub); cur = pt(num(2), num(1)); start = cur; sub = [['M', cur]]; break
      case 'l': cur = pt(num(2), num(1)); sub.push(['L', cur]); break
      case 'c': {
        const c1 = pt(num(6), num(5)); const c2 = pt(num(4), num(3)); const e = pt(num(2), num(1))
        sub.push(['C', c1, c2, e]); cur = e; break
      }
      case 'v': { const c2 = pt(num(4), num(3)); const e = pt(num(2), num(1)); sub.push(['C', cur, c2, e]); cur = e; break }
      case 'y': { const c1 = pt(num(4), num(3)); const e = pt(num(2), num(1)); sub.push(['C', c1, e, e]); cur = e; break }
      case 're': {
        if (sub.length) subs.push(sub)
        const x = num(4), y = num(3), w = num(2), h = num(1)
        subs.push([['M', pt(x, y)], ['L', pt(x + w, y)], ['L', pt(x + w, y + h)], ['L', pt(x, y + h)], ['Z']])
        sub = []; cur = pt(x, y); start = cur; break
      }
      case 'h': if (sub.length) { sub.push(['Z']); cur = start } break
      case 'f': case 'f*': case 'F': case 'b': case 'b*': case 'B': case 'B*': {
        if (sub.length) subs.push(sub)
        if (subs.length) out.push({ subs, fill: hex(fill), rule: t.includes('*') ? 'evenodd' : 'nonzero' })
        subs = []; sub = []; break
      }
      case 'n': case 'S': case 's': subs = []; sub = []; break
      default: break
    }
    args.length = 0
  }
  return out
}

export function pathData(subs, { scale = 1, dx = 0, dy = 0, flipY = 0, decimals = 2 }) {
  const f = (v) => String(Number(v.toFixed(decimals)))
  const T = ([x, y]) => `${f((x - dx) * scale)} ${f(((flipY ? flipY - y : y) - dy) * scale)}`
  let d = ''
  for (const sub of subs) {
    for (const seg of sub) {
      if (seg[0] === 'M') d += `M${T(seg[1])}`
      else if (seg[0] === 'L') d += `L${T(seg[1])}`
      else if (seg[0] === 'C') d += `C${T(seg[1])} ${T(seg[2])} ${T(seg[3])}`
      else d += 'Z'
    }
    if (!sub.some((s) => s[0] === 'Z')) d += 'Z'
  }
  return d
}

export function boundsOf(subs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const sub of subs) for (const seg of sub) for (let i = 1; i < seg.length; i++) {
    const [x, y] = seg[i]
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}
