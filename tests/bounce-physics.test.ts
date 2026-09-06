import { describe, it, expect } from 'vitest'
import { createInitialVelocity, deflectVelocity, stepBall, BALL_SPEED } from '../electron/bounce-physics'

const BOUNDS = { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
const NEUTRAL = () => 0.5 // delta = 0，偏转角度为 0

describe('createInitialVelocity', () => {
  it('速度大小恒为 100px/s', () => {
    for (let i = 0; i < 100; i++) {
      const { vx, vy } = createInitialVelocity(() => i / 100)
      expect(Math.hypot(vx, vy)).toBeCloseTo(BALL_SPEED, 5)
    }
  })
})

describe('deflectVelocity', () => {
  it('保持速度大小不变', () => {
    const { vx, vy } = deflectVelocity(60, 80, () => 0.3)
    expect(Math.hypot(vx, vy)).toBeCloseTo(100, 5)
  })

  it('random=0.5 时角度不变（偏转 0）', () => {
    const { vx, vy } = deflectVelocity(100, 0, NEUTRAL)
    expect(vx).toBeCloseTo(100, 5)
    expect(vy).toBeCloseTo(0, 5)
  })

  it('random=0 时偏转 -30°', () => {
    const { vx, vy } = deflectVelocity(100, 0, () => 0)
    expect(vx).toBeCloseTo(100 * Math.cos(-Math.PI / 6), 5)
    expect(vy).toBeCloseTo(100 * Math.sin(-Math.PI / 6), 5)
  })

  it('random=1 时偏转 +30°', () => {
    const { vx, vy } = deflectVelocity(100, 0, () => 1)
    expect(vx).toBeCloseTo(100 * Math.cos(Math.PI / 6), 5)
    expect(vy).toBeCloseTo(100 * Math.sin(Math.PI / 6), 5)
  })
})

describe('stepBall', () => {
  it('未越界时按速度推进位置', () => {
    const state = { x: 100, y: 100, vx: 100, vy: 0 }
    const next = stepBall(state, BOUNDS, 0.5, NEUTRAL)
    expect(next.x).toBeCloseTo(150, 5)
    expect(next.y).toBeCloseTo(100, 5)
    expect(next.vx).toBeCloseTo(100, 5)
  })

  it('碰右边界时 vx 反转为负', () => {
    const state = { x: 900, y: 100, vx: 100, vy: 0 }
    const next = stepBall(state, BOUNDS, 2, NEUTRAL)
    expect(next.x).toBe(1000)
    expect(next.vx).toBeLessThan(0)
  })

  it('碰左边界时 vx 反转为正', () => {
    const state = { x: 100, y: 100, vx: -100, vy: 0 }
    const next = stepBall(state, BOUNDS, 2, NEUTRAL)
    expect(next.x).toBe(0)
    expect(next.vx).toBeGreaterThan(0)
  })

  it('碰下边界时 vy 反转为负', () => {
    const state = { x: 100, y: 700, vx: 0, vy: 100 }
    const next = stepBall(state, BOUNDS, 2, NEUTRAL)
    expect(next.y).toBe(800)
    expect(next.vy).toBeLessThan(0)
  })

  it('碰上边界时 vy 反转为正', () => {
    const state = { x: 100, y: 100, vx: 0, vy: -100 }
    const next = stepBall(state, BOUNDS, 2, NEUTRAL)
    expect(next.y).toBe(0)
    expect(next.vy).toBeGreaterThan(0)
  })

  it('长时间随机运动后位置始终在边界内', () => {
    let state = { x: 500, y: 400, vx: 70, vy: -70 }
    for (let i = 0; i < 5000; i++) {
      state = stepBall(state, BOUNDS, 0.016)
      expect(state.x).toBeGreaterThanOrEqual(0)
      expect(state.x).toBeLessThanOrEqual(1000)
      expect(state.y).toBeGreaterThanOrEqual(0)
      expect(state.y).toBeLessThanOrEqual(800)
    }
  })
})
