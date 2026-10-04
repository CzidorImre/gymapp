// The demo build (previews, store screenshots) has to show a believable history.
import { describe, it, expect } from 'vitest'
import { buildDemoState } from './demoSeed.js'

const S = buildDemoState()

describe('demo seed', () => {
  it('fills the stats: weeks of workouts, weigh-ins and a goal', () => {
    expect(S.workouts.length).toBeGreaterThan(25)
    expect(S.bodyweight.length).toBeGreaterThan(15)
    expect(S.targetW).toBeGreaterThan(0)
    S.workouts.forEach(w => expect(w.entries.length).toBeGreaterThan(0))
  })

  it('is deterministic — two builds produce the same sets', () => {
    const flat = st => st.workouts.map(w => w.entries.map(e => e.sets.map(s => `${s.w}x${s.r}`).join(',')).join('|')).join(';')
    expect(flat(buildDemoState())).toBe(flat(S))
  })
})
