interface HeroRect {
  left: number
  top: number
  width: number
  height: number
}

export interface HeroMotion {
  lightX: number
  lightY: number
  offsetX: number
  offsetY: number
}

const CENTERED_MOTION: HeroMotion = {
  lightX: 50,
  lightY: 50,
  offsetX: 0,
  offsetY: 0,
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const round = (value: number) => Math.round(value * 100) / 100

export function getHeroMotion(clientX: number, clientY: number, rect: HeroRect): HeroMotion {
  if (rect.width <= 0 || rect.height <= 0) return CENTERED_MOTION

  const x = clamp((clientX - rect.left) / rect.width)
  const y = clamp((clientY - rect.top) / rect.height)

  return {
    lightX: round(x * 100),
    lightY: round(y * 100),
    offsetX: round((x - 0.5) * 36),
    offsetY: round((y - 0.5) * 24),
  }
}
