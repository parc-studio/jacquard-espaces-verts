/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react'
import { Switch, RadioGroup } from '@headlessui/react'

// ============================================================
//  Types
// ============================================================
type LogoDef = {
  id: string
  label: string
  file: string
  baseline: boolean
  baselineCount: number
  monogram: boolean
  monogramCount: number
}

const LOGO_DEFS: LogoDef[] = [
  {
    id: 'monogram',
    label: 'Monogramme',
    file: '/identite-visuelle/logo-baseline.svg',
    baseline: true,
    baselineCount: 2,
    monogram: false,
    monogramCount: 0,
  },
  {
    id: 'lockup',
    label: 'Lockup horizontal',
    file: '/identite-visuelle/lockup.svg',
    baseline: true,
    baselineCount: 2,
    monogram: true,
    monogramCount: 5,
  },
]

const COLOR_PRESETS = [
  { value: '#325928', label: 'RAL 6002' },
  { value: '#F2F1E2', label: 'RAL 9012' },
  { value: '#FFFFFF', label: 'Blanc' },
  { value: '#000000', label: 'Noir' },
]

const FONT = 'Helvetica, Arial, sans-serif'

// ============================================================
//  Signature generator helpers
// ============================================================
const SIG_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="WIDTH" viewBox="0 0 99 19" fill="none"><path d="M1.86902 11.6584C1.86902 12.7 2.52867 13.3374 3.42392 13.3374C4.33486 13.3374 4.97882 12.7 4.97882 11.6584V4.88032H3.07838V3.23242H8.54408V4.88032H6.87924V11.7206C6.87924 13.8194 5.40287 15.1719 3.42392 15.1719C1.46067 15.1719 0 13.8194 0 11.7206V9.96391H1.86902L1.86902 11.6584Z" fill="#41693A"/><path d="M18.9344 6.68367V8.33156H17.4266V13.2752H18.9344V14.9232H15.6518V13.7416H15.6204C15.1335 14.55 14.1754 15.1253 12.9346 15.1253C10.7829 15.1253 8.94531 13.3374 8.94531 10.8034C8.94531 8.26938 10.7829 6.48157 12.9346 6.48157C14.1754 6.48157 15.1649 7.08787 15.6204 7.83408H15.6518V6.68367L18.9344 6.68367ZM13.2331 13.4307C14.6152 13.4307 15.6675 12.3114 15.6675 10.8034C15.6675 9.29543 14.6309 8.1761 13.2331 8.1761C11.8509 8.1761 10.7986 9.29542 10.7986 10.8034C10.7986 12.3114 11.8353 13.4307 13.2331 13.4307Z" fill="#41693A"/><path d="M19.9297 10.8034C19.9297 8.34712 21.7988 6.43494 24.1704 6.43494C26.2435 6.43494 27.9084 7.89628 28.3011 9.90173H26.4163C26.1022 8.86013 25.2541 8.1761 24.1704 8.1761C22.8197 8.1761 21.783 9.26434 21.783 10.8034C21.783 12.3425 22.8197 13.4307 24.1704 13.4307C25.2541 13.4307 26.1022 12.7467 26.4163 11.7051H28.3011C27.9084 13.695 26.2435 15.1719 24.1704 15.1719C21.7988 15.1719 19.9297 13.2597 19.9297 10.8034Z" fill="#41693A"/><path d="M39.45 6.68367V8.33156H37.9423V16.6021H39.45V18.25H34.534V16.6021H36.1517V13.7572H36.1203C35.6806 14.5345 34.6911 15.1253 33.4817 15.1253C31.3299 15.1253 29.4609 13.3374 29.4609 10.8034C29.4609 8.26938 31.3299 6.48157 33.4817 6.48157C34.7067 6.48157 35.6806 7.05678 36.1361 7.84963H36.1675V6.68367H39.45ZM33.7488 13.4307C35.1308 13.4307 36.1831 12.3114 36.1831 10.8034C36.1831 9.29543 35.1466 8.16056 33.7488 8.16056C32.3666 8.16056 31.3143 9.29542 31.3143 10.8034C31.3143 12.3114 32.3666 13.4307 33.7488 13.4307Z" fill="#41693A"/><path d="M47.0263 14.9231V13.9126H46.9949C46.6651 14.5655 45.9897 15.1252 44.7646 15.1252C42.9428 15.1252 41.9061 13.8504 41.9061 11.9382V8.33149H40.3984V6.68359H43.6967V11.5651C43.6967 12.7932 44.2306 13.4928 45.2515 13.4928C46.3352 13.4928 46.9635 12.6689 46.9635 11.4718V8.33149H45.4557V6.68359H48.7539V13.2752H50.2775V14.9231H47.0263Z" fill="#41693A"/><path d="M61.114 6.68367V8.33156H59.6062V13.2752H61.114V14.9232H57.8314V13.7416H57.8C57.3132 14.55 56.3552 15.1253 55.1143 15.1253C52.9626 15.1253 51.125 13.3374 51.125 10.8034C51.125 8.26938 52.9626 6.48157 55.1143 6.48157C56.3552 6.48157 57.3446 7.08787 57.8 7.83408H57.8314V6.68367L61.114 6.68367ZM55.4127 13.4307C56.7949 13.4307 57.8472 12.3114 57.8472 10.8034C57.8472 9.29543 56.8106 8.1761 55.4127 8.1761C54.0306 8.1761 52.9784 9.29542 52.9784 10.8034C52.9784 12.3114 54.0149 13.4307 55.4127 13.4307Z" fill="#41693A"/><path d="M65.2515 6.67335V13.2649H66.9791V14.9129H61.9375V13.2649H63.4611V8.32125H61.9375V6.67335H65.2515ZM68.6441 7.94814C68.6441 8.72544 68.0315 9.30066 67.2933 9.30066C66.5708 9.30066 65.9426 8.72545 65.9426 7.94814C65.9426 7.15529 66.5708 6.58008 67.2933 6.58008C68.0315 6.58008 68.6441 7.15529 68.6441 7.94814Z" fill="#41693A"/><path d="M77.9186 3.23242V13.2752H79.442V14.9232H76.1752V13.7416H76.1438C75.704 14.55 74.6988 15.1253 73.4737 15.1253C71.322 15.1253 69.4688 13.3374 69.4688 10.8034C69.4688 8.26938 71.322 6.48157 73.4581 6.48157C74.6517 6.48157 75.6412 7.02569 76.0966 7.7719H76.128V4.88032H74.5104V3.23242H77.9186ZM73.7565 13.4152C75.1385 13.4152 76.191 12.3114 76.191 10.8034C76.191 9.29543 75.1543 8.19165 73.7565 8.19165C72.3744 8.19165 71.322 9.29542 71.322 10.8034C71.322 12.3114 72.3744 13.4152 73.7565 13.4152Z" fill="#41693A"/><path d="M96.9141 3.53157C95.3463 5.37295 93.0099 6.54294 90.4072 6.54294C87.8026 6.54294 85.4662 5.37295 83.8984 3.53157C84.2206 3.00418 84.6058 2.51998 85.0432 2.08618C86.278 3.70077 88.2238 4.74295 90.4072 4.74295C92.5906 4.74295 94.5363 3.70077 95.7693 2.08618C96.2067 2.51818 96.5919 3.00418 96.9141 3.53157Z" fill="#41693A"/><path d="M93.5559 0.559879C92.9908 0.302515 92.3879 0.113509 91.7597 0.000131405V0.68299H91.759C91.759 0.685825 91.7596 0.688439 91.7596 0.691274C91.7596 1.46886 91.1476 2.04306 90.4096 2.04306C89.686 2.04306 89.0578 1.46886 89.0578 0.691274C89.0578 0.688439 89.0583 0.685825 89.0584 0.68299L89.0583 0C89.0581 4.31995e-05 89.0579 6.6601e-05 89.0578 8.82008e-05C88.4296 0.113487 87.8266 0.302472 87.2614 0.55988C87.2578 0.603078 87.2578 0.648078 87.2578 0.691275C87.2578 2.42826 88.6708 3.84304 90.4096 3.84304C92.1466 3.84304 93.5595 2.42826 93.5595 0.691275C93.5595 0.648078 93.5595 0.603076 93.5559 0.559879Z" fill="#41693A"/><path d="M98.0187 7.15501C95.8281 8.58959 93.2109 9.42298 90.4048 9.42298C87.5968 9.42298 84.9796 8.58959 82.7891 7.15501C82.8179 6.47642 82.9385 5.82302 83.1347 5.20203C85.1632 6.72301 87.6796 7.623 90.4048 7.623C93.1281 7.623 95.6463 6.72121 97.6749 5.20203C97.8693 5.82302 97.9899 6.47642 98.0187 7.15501Z" fill="#41693A"/><path d="M89.4637 14.913H87.3811C88.0327 13.9716 88.2883 13.0788 88.0741 12.438C87.8995 11.9142 87.4585 11.718 87.1201 11.646C86.3731 11.4876 85.3561 11.6082 84.2329 11.9772C83.8765 11.4858 83.5759 10.9512 83.3438 10.3806C84.5101 9.96304 86.0869 9.58684 87.4945 9.88564C88.6051 10.1214 89.4403 10.8432 89.7823 11.8674C89.9803 12.4632 90.1243 13.5198 89.4637 14.913Z" fill="#41693A"/><path d="M97.4637 10.3806C97.2315 10.9512 96.9309 11.4858 96.5745 11.9772C95.4513 11.6082 94.4343 11.4876 93.6874 11.646C93.349 11.718 92.908 11.9142 92.7334 12.438C92.5192 13.0788 92.7748 13.9716 93.4282 14.913H91.3438C90.6832 13.5198 90.8272 12.4632 91.027 11.8674C91.369 10.8432 92.2024 10.1214 93.313 9.88564C94.7205 9.58684 96.2973 9.96304 97.4637 10.3806Z" fill="#41693A"/></svg>`

const PEOPLE = [
  { name: 'Antoine JACQUARD', title: 'Président', email: 'ajacquard@jacquardespacesverts.fr' },
  {
    name: 'Joris GUILLERMIN',
    title: 'Aide conducteur de travaux',
    email: 'jguillermin@jacquardespacesverts.fr',
  },
  {
    name: 'Victoria HEWLETT',
    title: 'Adjointe de secteur',
    email: 'vhewlett@jacquardespacesverts.fr',
  },
  {
    name: 'Magalie HARDER',
    title: 'Secrétaire administrative',
    email: 'mharder@jacquardespacesverts.fr',
  },
  {
    name: 'Axel ZINS',
    title: 'Responsable secteur création',
    email: 'azins@jacquardespacesverts.fr',
  },
  { name: 'Manon BARDET', title: '', email: 'mbardet@jacquardespacesverts.fr' },
  {
    name: 'Vincent MAISONNEUVE',
    title: 'Responsable secteur entretien',
    email: 'vmaisonneuve@jacquardespacesverts.fr',
  },
  {
    name: 'Rémi LABROSSE',
    title: 'Responsable bureau d\u2019étude',
    email: 'rlabrosse@jacquardespacesverts.fr',
  },
  { name: 'Patrick CHAPUIS', title: 'Mécanicien', email: 'pchapuis@jacquardespacesverts.fr' },
  {
    name: 'Françoise ROCHE',
    title: 'Administratrice des ventes',
    email: 'froche@jacquardespacesverts.fr',
  },
  {
    name: 'Jonas BLANCHARD',
    title: 'Conducteur de travaux',
    email: 'jblanchard@jacquardespacesverts.fr',
  },
  {
    name: 'Guillaume CONVERT',
    title: 'Conducteur de travaux',
    email: 'gconvert@jacquardespacesverts.fr',
  },
  {
    name: 'Oksana NICOLET',
    title: 'Apprentie aide conduite de chantier',
    email: 'onicolet@jacquardespacesverts.fr',
  },
]

let _measCtx: CanvasRenderingContext2D | null = null
function meas() {
  if (!_measCtx) _measCtx = document.createElement('canvas').getContext('2d')!
  return _measCtx
}
function textWidth(t: string, weight: string, size: number) {
  const ctx = meas()
  ctx.font = `${weight} ${size}px ${FONT}`
  return ctx.measureText(t).width
}
function fitSize(t: string, weight: string, W: number, max = 200) {
  let lo = 4,
    hi = max
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2
    if (textWidth(t, weight, m) <= W) lo = m
    else hi = m
  }
  return lo
}
function escapeHTML(s: string) {
  return (s || '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
  )
}
function formatName(n: string) {
  const parts = (n || '').trim().split(/\s+/)
  if (parts.length < 2) return n
  return parts[0] + ' ' + parts.slice(1).join(' ').toUpperCase()
}
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildSigInnerHTML(fields: { name: string; title: string; email: string; phone: string }) {
  const W = 320
  const f = {
    name: formatName(fields.name) || ' ',
    title: fields.title || ' ',
    email: fields.email,
    phone: fields.phone,
  }
  const nameSize = Math.min(fitSize(f.name, 'bold', W), 28)
  const nameW = textWidth(f.name, 'bold', nameSize)
  const emailUnit = f.email ? textWidth(f.email, '300', 1) : 0
  const minTitleForEmail = f.email ? nameW / (1.6 + emailUnit) : 0
  const titleSize = Math.max(12, Math.round(nameSize * 0.6), Math.ceil(minTitleForEmail))
  const cSize = titleSize
  const emailLineW = f.email
    ? Math.ceil(1.6 * cSize + textWidth(f.email, '300', cSize))
    : Math.ceil(nameW)
  const g1 = 9,
    g2 = 16,
    g3 = 10
  return {
    width: emailLineW,
    html: `
      <div class="logo-row">${SIG_LOGO_SVG.replace('WIDTH', String(emailLineW))}</div>
      <hr style="margin:${g1}px 0 ${g2}px;width:${emailLineW}px;margin-left:0;border:0;border-top:1px solid #41693A">
      <div class="name" style="font-size:${nameSize}px">${escapeHTML(f.name)}</div>
      <div class="title" style="font-size:${titleSize}px">${escapeHTML(f.title)}</div>
      <div style="margin-top:${g3}px;font-size:${cSize}px;color:#41693A;font-family:${FONT};line-height:1.2">
        ${f.phone ? `<div style="white-space:nowrap;font-weight:300"><a href="tel:${f.phone.replace(/\s/g, '')}" style="color:#41693A;text-decoration:none;font-weight:300"><span style="display:inline-block;width:1.6em">T:</span>${escapeHTML(f.phone)}</a></div>` : ''}
        ${f.email ? `<div style="white-space:nowrap;font-weight:300"><a href="mailto:${f.email}" style="color:#41693A;text-decoration:none;font-weight:300"><span style="display:inline-block;width:1.6em">M:</span>${escapeHTML(f.email)}</a></div>` : ''}
      </div>
    `,
  }
}

async function downloadSigPNG(node: HTMLElement, filename: string) {
  const padX = 16,
    padY = 18
  const w = Math.ceil(Math.max(node.scrollWidth, node.offsetWidth))
  const h = Math.ceil(Math.max(node.scrollHeight, node.offsetHeight))
  const totalW = w + padX * 2,
    totalH = h + padY * 2
  const clone = node.cloneNode(true) as HTMLElement
  const styleBlock = `<style>
    .sig,.sig *{font-family:Helvetica,Arial,sans-serif;color:#41693A;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
    .sig .name{font-weight:700;line-height:1.15;white-space:nowrap}
    .sig .title{font-weight:300;line-height:1.2}
    .sig hr{border:0;border-top:1px solid #41693A}
    a{color:#41693A;text-decoration:none}
  </style>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <foreignObject x="${padX}" y="${padY}" width="${w}" height="${h + padY}">
      <div xmlns="http://www.w3.org/1999/xhtml">${styleBlock}${new XMLSerializer().serializeToString(clone)}</div>
    </foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
  })
  const scale = 4
  const c = document.createElement('canvas')
  c.width = totalW * scale
  c.height = totalH * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function copyAppleMail(fields: {
  name: string
  title: string
  email: string
  phone: string
}) {
  const f = {
    name: formatName(fields.name) || ' ',
    title: fields.title || ' ',
    email: fields.email,
    phone: fields.phone,
  }
  const sigW = 120
  const nameSize = Math.min(fitSize(f.name, 'bold', sigW), 14)
  const nameW = textWidth(f.name, 'bold', nameSize)
  const emailUnit = f.email ? textWidth(f.email, '300', 1) : 0
  const minTitleForEmail = f.email ? nameW / (1.6 + emailUnit) : 0
  const titleSize = Math.max(9, Math.round(nameSize * 0.7), Math.ceil(minTitleForEmail))
  const cSize = titleSize
  const emailLineW = f.email
    ? Math.ceil(1.6 * cSize + textWidth(f.email, '300', cSize))
    : Math.ceil(nameW)
  const finalW = Math.min(emailLineW, 300)
  const logoDisplayW = finalW
  const logoDisplayH = Math.round((logoDisplayW * 19) / 99)
  const logoUrl = 'https://jacquard-espaces-verts.parc.studio/logo.png'
  const html = `<table cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="#ffffff" style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;color:#41693A;background-color:#ffffff;color-scheme:light only;-webkit-color-scheme:light only">
    <tr><td bgcolor="#ffffff" style="padding:8px;width:${finalW}px;max-width:100%;background-color:#ffffff">
      <a href="mailto:${f.email}" style="text-decoration:none;display:block;line-height:0">
        <img src="${logoUrl}" alt="Jacquard" width="${logoDisplayW}" height="${logoDisplayH}" style="display:block;border:0;width:${logoDisplayW}px;height:${logoDisplayH}px;max-width:100%">
      </a>
      <div style="border-top:1px solid #41693A;margin:6px 0 8px;width:${finalW}px;max-width:100%;font-size:0;line-height:0">&nbsp;</div>
      <div style="font-weight:bold;font-size:${nameSize}px;line-height:1.15;color:#41693A">${escapeHTML(f.name)}</div>
      <div style="font-weight:300;font-size:${titleSize}px;line-height:1.2;color:#41693A;word-wrap:break-word">${escapeHTML(f.title)}</div>
      <div style="margin-top:6px;font-size:${cSize}px;line-height:1.4;color:#41693A;font-weight:300">
        ${f.phone ? `<div style="margin:0;font-weight:300"><a href="tel:${f.phone.replace(/\s/g, '')}" style="color:#41693A;text-decoration:none;font-weight:300"><span style="display:inline-block;width:1.6em">T:</span>${escapeHTML(f.phone)}</a></div>` : ''}
        ${f.email ? `<div style="margin:0;font-weight:300"><a href="mailto:${f.email}" style="color:#41693A;text-decoration:none;font-weight:300"><span style="display:inline-block;width:1.6em">M:</span>${escapeHTML(f.email)}</a></div>` : ''}
      </div>
    </td></tr>
  </table>`
  const holder = document.createElement('div')
  holder.setAttribute('contenteditable', 'true')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;background:#ffffff;'
  holder.innerHTML = html
  document.body.appendChild(holder)
  const range = document.createRange()
  range.selectNodeContents(holder)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    // ignore
  }
  sel.removeAllRanges()
  document.body.removeChild(holder)
  return ok
}

// ============================================================
//  SVG helpers
// ============================================================
function buildLogoSVG(
  def: LogoDef,
  raw: string,
  fg: string,
  withBaseline: boolean,
  withMonogram: boolean
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'image/svg+xml')
  const svg = doc.documentElement
  if (def.baseline && !withBaseline && def.baselineCount > 0) {
    const paths = Array.from(svg.querySelectorAll('path'))
    for (let i = 0; i < def.baselineCount && paths.length; i++) paths.pop()!.remove()
  }
  if (def.monogram && !withMonogram && def.monogramCount > 0) {
    const paths = Array.from(svg.querySelectorAll('path'))
    for (let i = 0; i < def.monogramCount && paths.length; i++) paths.shift()!.remove()
    svg.setAttribute('viewBox', '0 0 408 95')
  }
  svg.querySelectorAll('[fill]').forEach((el) => el.setAttribute('fill', fg))
  return new XMLSerializer().serializeToString(svg)
}

async function downloadLogo(
  def: LogoDef,
  raw: string,
  format: 'svg' | 'png',
  fg: string,
  bg: string,
  withBaseline: boolean,
  withMonogram: boolean
) {
  const inner = buildLogoSVG(def, raw, fg, withBaseline, withMonogram)
  const parser = new DOMParser()
  const doc = parser.parseFromString(inner, 'image/svg+xml')
  const inSvg = doc.documentElement
  const vbAttr = inSvg.getAttribute('viewBox')
  let W = 400,
    H = 200,
    vbX = 0,
    vbY = 0
  if (vbAttr) {
    const vb = vbAttr.split(/\s+/).map(Number)
    vbX = vb[0]
    vbY = vb[1]
    W = vb[2]
    H = vb[3]
  }
  const padX = Math.round(W * 0.12)
  const padY = Math.round(H * 0.18)
  const totalW = W + padX * 2
  const totalH = H + padY * 2
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}"><rect width="100%" height="100%" fill="${bg}"/><g transform="translate(${padX - vbX} ${padY - vbY})">${new XMLSerializer().serializeToString(inSvg)}</g></svg>`
  const baseName = `jacquard-${def.id}${def.baseline ? (withBaseline ? '-baseline' : '-no-baseline') : ''}`

  if (format === 'svg') {
    const blob = new Blob([wrapped], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = baseName + '.svg'
    a.click()
    URL.revokeObjectURL(a.href)
    return
  }
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(wrapped)
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
  })
  const scale = Math.max(2, Math.round(2000 / totalW))
  const c = document.createElement('canvas')
  c.width = totalW * scale
  c.height = totalH * scale
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = baseName + '.png'
  a.click()
}

// ============================================================
//  UI primitives (Headless UI)
// ============================================================
function ToggleSwitch({
  label,
  help,
  enabled,
  onChange,
}: {
  label: string
  help: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="toggle-group">
      <div className="label-row">
        <span>{label}</span>
        <Switch
          checked={enabled}
          onChange={onChange}
          className={`hu-switch ${enabled ? 'on' : 'off'}`}
        >
          <span className="hu-switch__thumb" />
          <span className="hu-switch__label">{enabled ? 'Avec' : 'Sans'}</span>
        </Switch>
      </div>
      <div className="help" dangerouslySetInnerHTML={{ __html: help }} />
    </div>
  )
}

function ColorRadio({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="ctl-label">{label}</div>
      <RadioGroup value={value} onChange={onChange} className="swatch-row">
        {COLOR_PRESETS.map((p) => (
          <RadioGroup.Option key={p.value} value={p.value} title={p.label}>
            {({ checked }) => (
              <button
                type="button"
                className={`color-pill ${checked ? 'checked' : ''}`}
                style={{ background: p.value }}
                aria-label={p.label}
              />
            )}
          </RadioGroup.Option>
        ))}
      </RadioGroup>
    </div>
  )
}

// ============================================================
//  Main component
// ============================================================
export default function IdentiteVisuelle() {
  const [fg, setFg] = useState('#325928')
  const [bg, setBg] = useState('#F2F1E2')
  const [withBaseline, setWithBaseline] = useState(true)
  const [withMonogram, setWithMonogram] = useState(true)
  const [rawMap, setRawMap] = useState<Record<string, string>>({})
  const sigRef = useRef<HTMLDivElement>(null)
  const [sigName, setSigName] = useState('Antoine JACQUARD')
  const [sigTitle, setSigTitle] = useState('Président')
  const [sigEmail, setSigEmail] = useState('ajacquard@jacquardespacesverts.fr')
  const [sigPhone, setSigPhone] = useState('06 19 36 15 58')
  const [sigStatus, setSigStatus] = useState('')

  useEffect(() => {
    Promise.all(
      LOGO_DEFS.map((d) =>
        fetch(d.file)
          .then((r) => r.text())
          .then((t) => [d.id, t] as const)
      )
    ).then((pairs) => setRawMap(Object.fromEntries(pairs)))
  }, [])

  const dlAll = async () => {
    for (const def of LOGO_DEFS) {
      const raw = rawMap[def.id]
      if (!raw) continue
      await downloadLogo(def, raw, 'png', fg, bg, withBaseline, withMonogram)
      await downloadLogo(def, raw, 'svg', fg, bg, withBaseline, withMonogram)
    }
  }

  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(txt)
      setTimeout(() => setCopied((c) => (c === txt ? null : c)), 1000)
    } catch {
      // ignore
    }
  }

  // Render signature preview
  useEffect(() => {
    if (!sigRef.current) return
    const fields = { name: sigName, title: sigTitle, email: sigEmail, phone: sigPhone }
    const { width, html } = buildSigInnerHTML(fields)
    sigRef.current.style.width = width + 'px'
    sigRef.current.innerHTML = html
  }, [sigName, sigTitle, sigEmail, sigPhone])

  const onCopySig = async () => {
    const ok = await copyAppleMail({
      name: sigName,
      title: sigTitle,
      email: sigEmail,
      phone: sigPhone,
    })
    setSigStatus(ok ? 'Copié ✓ — colle dans la signature Mail (Cmd+V).' : 'Erreur copie.')
  }
  const onDownloadSig = async () => {
    if (!sigRef.current) return
    await downloadSigPNG(sigRef.current, 'signature.png')
    setSigStatus('PNG téléchargé.')
  }
  const onBatch = async () => {
    if (!sigRef.current) return
    if (document.fonts && document.fonts.ready) await document.fonts.ready
    for (let i = 0; i < PEOPLE.length; i++) {
      const p = PEOPLE[i]
      setSigName(p.name)
      setSigTitle(p.title)
      setSigEmail(p.email)
      setSigPhone('')
      // attendre un tick pour que le useEffect re-render
      await new Promise((r) => setTimeout(r, 100))
      setSigStatus(`Batch ${i + 1}/${PEOPLE.length} — ${p.name}`)
      await downloadSigPNG(sigRef.current, `signature-${slugify(p.name)}.png`)
      await new Promise((r) => setTimeout(r, 250))
    }
    setSigStatus('Batch terminé ✓')
  }

  const SECTIONS = [
    { id: 'logos', label: 'Logos' },
    { id: 'colors', label: 'Couleurs de la charte' },
    { id: 'signature', label: 'Signature de mail' },
  ]
  const EXTERNAL = [
    {
      href: 'https://drive.google.com/open?id=1IjxCuGf4IZugIDzzKZ1YabLnsS8_HowK&usp=drive_fs',
      label: 'Drive',
    },
    {
      href: 'https://www.figma.com/proto/C9GiDsZTNDboWoyD8mSFpu/Jacquard-Espaces-Verts-V1?page-id=3308%3A2836&node-id=3308-3498&viewport=-5901%2C172%2C0.08&t=D5S9hLlc9u0HRzGc-1&scaling=scale-down&content-scaling=fixed',
      label: 'Présentation Figma',
    },
  ]

  return (
    <div className="layout">
      <aside className="sidenav">
        <div className="sidenav__title">Sections</div>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.label}</a>
            </li>
          ))}
        </ul>
        <div className="sidenav__title" style={{ marginTop: 22 }}>
          Liens externes
        </div>
        <ul>
          {EXTERNAL.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div className="page">
        <section id="logos">
          <h2>Logos</h2>

          <div className="logo-block" style={{ marginBottom: 22 }}>
            <h3>Réglages communs</h3>
            <div
              className="controls"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}
            >
              <ColorRadio label="Logo" value={fg} onChange={setFg} />
              <ColorRadio label="Fond" value={bg} onChange={setBg} />
              <ToggleSwitch
                label="Monogramme"
                help="Le <b>monogramme</b> est le pictogramme (l'arbre) à côté du nom."
                enabled={withMonogram}
                onChange={setWithMonogram}
              />
              <ToggleSwitch
                label="Baseline"
                help="La <b>baseline</b> est la mention textuelle qui accompagne le logo (téléphone, site web)."
                enabled={withBaseline}
                onChange={setWithBaseline}
              />
            </div>
          </div>

          <div className="logos-grid">
            {LOGO_DEFS.map((def) => {
              const raw = rawMap[def.id]
              const svg = raw ? buildLogoSVG(def, raw, fg, withBaseline, withMonogram) : ''
              return (
                <div key={def.id} className="logo-block">
                  <h3>{def.label}</h3>
                  <div className="row">
                    <div
                      className="frame"
                      style={{ background: bg }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                    <div className="actions">
                      <button
                        onClick={() =>
                          downloadLogo(def, raw, 'svg', fg, bg, withBaseline, withMonogram)
                        }
                      >
                        SVG
                      </button>
                      <button
                        className="alt"
                        onClick={() =>
                          downloadLogo(def, raw, 'png', fg, bg, withBaseline, withMonogram)
                        }
                      >
                        PNG
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={dlAll}>Télécharger les deux logos (SVG + PNG)</button>
          </div>

          <div
            id="colors"
            style={{
              marginTop: 28,
              paddingTop: 22,
              borderTop: '1px solid #eee',
              scrollMarginTop: 24,
            }}
          >
            <div className="ctl-label" style={{ marginBottom: 12 }}>
              Couleurs de la charte
            </div>
            <div className="swatches" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { hex: '#325928', name: 'RAL 6002', cmjn: 'CMJN 50 0 57 65', dark: true },
                { hex: '#F2F1E2', name: 'RAL 9012', cmjn: 'CMJN 0 2 9 3', dark: false },
              ].map((c) => (
                <div key={c.hex} className={`color-card sm ${c.dark ? 'dark' : 'light'}`}>
                  <div
                    className="color-card_color"
                    style={{ background: c.hex, cursor: 'pointer' }}
                    onClick={() => copy(c.hex)}
                  >
                    <span>{copied === c.hex ? 'copié ✓' : c.hex.replace('#', '')}</span>
                  </div>
                  <div className="color-card_info">
                    <a className="color-card_name">{c.name}</a>
                    <div className="color-card_meta">
                      <span className="copy" onClick={() => copy(c.hex)}>
                        {copied === c.hex ? 'copié ✓' : c.hex}
                      </span>
                      <br />
                      <span className="copy" onClick={() => copy(c.cmjn)}>
                        {copied === c.cmjn ? 'copié ✓' : c.cmjn}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signature">
          <h2>Signature de mail</h2>
          <div className="sig-wrap">
            <div className="sig-card">
              <label className="field">Nom complet</label>
              <input value={sigName} onChange={(e) => setSigName(e.target.value)} />
              <label className="field">Intitulé</label>
              <input value={sigTitle} onChange={(e) => setSigTitle(e.target.value)} />
              <label className="field">Email</label>
              <input type="email" value={sigEmail} onChange={(e) => setSigEmail(e.target.value)} />
              <label className="field">Téléphone</label>
              <input value={sigPhone} onChange={(e) => setSigPhone(e.target.value)} />
              <div className="sig-buttons">
                <button onClick={onCopySig}>Copier la signature</button>
                <button className="alt" onClick={onDownloadSig}>
                  Exporter en PNG
                </button>
                <button className="alt" style={{ gridColumn: '1 / -1' }} onClick={onBatch}>
                  Batch — toutes les signatures en PNG
                </button>
              </div>
              <small style={{ minHeight: 14, display: 'block', color: '#888', marginTop: 8 }}>
                {sigStatus}
              </small>

              <details style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#325928' }}>
                  📧 Apple Mail (macOS)
                </summary>
                <ol style={{ fontSize: 12, color: '#555', lineHeight: 1.5, paddingLeft: 20 }}>
                  <li>
                    Clique <b>Copier la signature</b>
                  </li>
                  <li>
                    Mail → <b>Réglages</b> → <b>Signatures</b>
                  </li>
                  <li>
                    Sélectionne ton compte, clique <b>+</b> pour créer une nouvelle signature
                  </li>
                  <li>
                    <b>Décoche</b> « Toujours utiliser la police par défaut »
                  </li>
                  <li>
                    Clique dans la zone d'édition à droite et fais <b>Cmd+V</b>
                  </li>
                  <li>Renomme la signature, ferme les Réglages</li>
                </ol>
              </details>

              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#325928' }}>
                  📨 Gmail (web)
                </summary>
                <ol style={{ fontSize: 12, color: '#555', lineHeight: 1.5, paddingLeft: 20 }}>
                  <li>
                    Clique <b>Copier la signature</b>
                  </li>
                  <li>
                    Gmail → <b>⚙️ Paramètres</b> → <b>Voir tous les paramètres</b>
                  </li>
                  <li>
                    Onglet <b>Général</b>, descend jusqu'à <b>Signature</b>
                  </li>
                  <li>
                    Clique <b>+ Créer</b>, donne un nom
                  </li>
                  <li>
                    Clique dans la zone et fais <b>Cmd+V</b> (ou Ctrl+V)
                  </li>
                  <li>Sélectionne la signature comme défaut, sauvegarde en bas</li>
                </ol>
              </details>

              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#325928' }}>
                  📩 Outlook (web / desktop)
                </summary>
                <ol style={{ fontSize: 12, color: '#555', lineHeight: 1.5, paddingLeft: 20 }}>
                  <li>
                    Clique <b>Copier la signature</b>
                  </li>
                  <li>
                    <b>Web :</b> ⚙️ → Voir tous les paramètres → Courrier →{' '}
                    <b>Composer et répondre</b>
                  </li>
                  <li>
                    <b>Desktop :</b> Outlook → Réglages → <b>Signatures</b>
                  </li>
                  <li>
                    Crée une nouvelle signature, clique dans la zone et <b>Cmd+V</b> / Ctrl+V
                  </li>
                  <li>
                    Sauvegarde, puis dans « Sélectionner les signatures par défaut » choisis-la
                  </li>
                </ol>
              </details>
            </div>
            <div className="sig-card">
              <div className="sig-preview">
                <div ref={sigRef} className="sig" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
