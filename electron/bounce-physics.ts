/** 弹球移动的纯物理逻辑，无 electron 依赖，便于单元测试 */

export interface BallBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface BallState {
  x: number
  y: number
  vx: number
  vy: number
}

export const BALL_SPEED = 100 // px/s

/** 随机初始速度方向（全角度均匀分布） */
export function createInitialVelocity(random: () => number = Math.random): { vx: number; vy: number } {
  const angle = random() * Math.PI * 2
  return {
    vx: Math.cos(angle) * BALL_SPEED,
    vy: Math.sin(angle) * BALL_SPEED
  }
}

/** 反弹后速度方向随机偏转 ±30°，保持速度大小不变 */
export function deflectVelocity(vx: number, vy: number, random: () => number = Math.random): { vx: number; vy: number } {
  const angle = Math.atan2(vy, vx)
  const delta = (random() * 2 - 1) * (Math.PI / 6)
  const next = angle + delta
  const speed = Math.hypot(vx, vy)
  return {
    vx: Math.cos(next) * speed,
    vy: Math.sin(next) * speed
  }
}

/** 单步推进：按速度移动 dt 秒，越界时贴边反弹并随机偏转 ±30° */
export function stepBall(state: BallState, bounds: BallBounds, dt: number, random: () => number = Math.random): BallState {
  let { x, y, vx, vy } = state
  x += vx * dt
  y += vy * dt

  let bounced = false
  if (x <= bounds.minX) {
    x = bounds.minX
    vx = Math.abs(vx)
    bounced = true
  } else if (x >= bounds.maxX) {
    x = bounds.maxX
    vx = -Math.abs(vx)
    bounced = true
  }

  if (y <= bounds.minY) {
    y = bounds.minY
    vy = Math.abs(vy)
    bounced = true
  } else if (y >= bounds.maxY) {
    y = bounds.maxY
    vy = -Math.abs(vy)
    bounced = true
  }

  if (bounced) {
    const deflected = deflectVelocity(vx, vy, random)
    vx = deflected.vx
    vy = deflected.vy
  }

  return { x, y, vx, vy }
}
