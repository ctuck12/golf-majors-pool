import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

// The icon never changes, so it's built once (also required for the iPhone app's static build).
export const dynamic = 'force-static'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const imageData = readFileSync(join(process.cwd(), 'public', 'golf-circle-icon.png'))
  const dataUrl = `data:image/png;base64,${imageData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          style={{
            width: '165%',
            height: '165%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    { ...size },
  )
}
