// Genera el set completo de íconos PWA a partir de un SVG de la "I" amarilla.
// Ejecutar: npm run gen:icons
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const iconsDir = resolve(root, 'public/icons')

// SVG base: "I" industrial condensada amarilla sobre fondo blanco.
function svgIcon({ size = 512, padding = 0, bg = '#FFFFFF', radius = 0 }) {
  // El glifo se dibuja en una caja de 512 y se escala con padding.
  const inner = 512 - padding * 2
  const scale = inner / 512
  const tx = padding
  const ty = padding
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${tx},${ty}) scale(${scale})" fill="#FFC107">
    <rect x="146" y="96" width="220" height="64" rx="6"/>
    <rect x="216" y="96" width="80" height="320" rx="6"/>
    <rect x="146" y="352" width="220" height="64" rx="6"/>
  </g>
</svg>`
}

async function render(svg, size, outPath) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(outPath, buf)
  console.log('  ✓', outPath.replace(root + '/', ''))
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  // Íconos estándar "any"
  await render(svgIcon({ size: 192 }), 192, resolve(iconsDir, 'icon-192.png'))
  await render(svgIcon({ size: 512 }), 512, resolve(iconsDir, 'icon-512.png'))

  // Maskable: glifo con safe-zone (padding ~12%) y fondo completo
  await render(
    svgIcon({ size: 512, padding: 64 }),
    512,
    resolve(iconsDir, 'maskable-512.png')
  )

  // apple-touch-icon 180x180
  await render(svgIcon({ size: 180 }), 180, resolve(root, 'public/apple-touch-icon.png'))

  // favicon.ico (multi-size png embebido vía sharp -> usamos 48px png renombrado a ico funciona en navegadores modernos;
  // generamos un ico real de 32/48)
  const favPng = await sharp(Buffer.from(svgIcon({ size: 48 }))).resize(48, 48).png().toBuffer()
  await writeFile(resolve(root, 'public/favicon.ico'), favPng)
  console.log('  ✓ public/favicon.ico')

  console.log('\nÍconos generados correctamente.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
