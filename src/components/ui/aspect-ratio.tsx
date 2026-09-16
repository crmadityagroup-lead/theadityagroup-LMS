"use client"

import * as React from "react"

type AspectRatioProps = React.HTMLAttributes<HTMLDivElement> & { ratio?: number }

function AspectRatio({ ratio = 1, style, ...props }: AspectRatioProps) {
  return <div data-slot="aspect-ratio" style={{ aspectRatio: ratio, ...style }} {...props} />
}

export { AspectRatio }
