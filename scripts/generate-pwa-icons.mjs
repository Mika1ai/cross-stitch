import sharp from 'sharp'

/** Opaque dark bg — iOS fills transparent icons with black. Padding for home-screen mask. */
function iconSvg(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#161514"/>
  <g fill="#884bfd" transform="translate(256 256) scale(7.2) translate(-20 -20)">
    <path d="M20,23.06l-8,8q-0.64,0.64-1.53,0.64T8.94,31.06T8.31,29.53T8.94,28l8-8l-8-8q-0.64-0.64-0.64-1.53T8.94,8.94t1.53-0.64T12,8.94l8,8l8-8q0.64-0.64 1.53-0.64t1.53,0.64t0.64,1.53T31.06,12l-8,8l8,8q0.64,0.64 0.64,1.53t-0.64,1.53t-1.53,0.64T28,31.06l-8-8Z"/>
  </g>
</svg>`
}

const outs = [
  ['public/icons/apple-touch-180.png', 180],
  ['public/icons/pwa-192.png', 192],
  ['public/icons/pwa-512.png', 512],
]

for (const [path, size] of outs) {
  await sharp(Buffer.from(iconSvg(size))).png().toFile(path)
  console.log('wrote', path)
}
