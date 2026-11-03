import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const source = path.resolve('public/kopela-icon.svg')
const targetDir = path.resolve('assets')
fs.mkdirSync(targetDir, { recursive: true })

// Use the exact Kopela emerald-and-gold SVG mark as the master Android icon.
await sharp(source, { density: 300 })
  .resize(1024, 1024, { fit: 'contain' })
  .png()
  .toFile(path.join(targetDir, 'icon.png'))

console.log('Generated assets/icon.png from public/kopela-icon.svg')
