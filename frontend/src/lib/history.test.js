import { describe, it, expect } from 'vitest'
import { modeOf, isTimed, fmtSec, setLabel, defaultConfig, buildSets, exLine, workoutVolume, isBw, isPerSide, sideReps, repStep, goalProgress } from './history.js'
import { EXDB } from './exercises.js'

// Real ids out of the shipped catalogue, so the body-part fallback is exercised for real.
const CARDIO = EXDB.find(e => e.bp === 'cardio').id
// A *loaded* lift: the catalogue's first non-cardio entry is a sit-up, which since issue #32
// defaults to bodyweight and would quietly send every label test down the other path.
const LIFT = EXDB.find(e => e.bp !== 'cardio' && e.eq !== 'body weight').id
const BW = EXDB.find(e => e.eq === 'body weight').id

describe('modeOf', () => {
  it('falls back to the body part when a plan has no mode — every existing plan keeps working', () => {
    expect(modeOf({ id: CARDIO })).toBe('cardio')
    expect(modeOf({ id: LIFT })).toBe('reps')
    expect(modeOf({ id: 'no-such-exercise' })).toBe('reps')
    expect(modeOf({})).toBe('reps')
    expect(modeOf(null)).toBe('reps')
    expect(modeOf(undefined)).toBe('reps')
  })

  it('lets an explicit mode win over the body part', () => {
    expect(modeOf({ id: LIFT, mode: 'time' })).toBe('time')
    expect(modeOf({ id: CARDIO, mode: 'reps' })).toBe('reps')
    expect(modeOf({ id: CARDIO, mode: 'time' })).toBe('time')
  })

  it('ignores a mode it does not know rather than trusting a bad file', () => {
    expect(modeOf({ id: LIFT, mode: 'nonsense' })).toBe('reps')
    expect(modeOf({ id: CARDIO, mode: '' })).toBe('cardio')
  })

  it('exposes the timed check', () => {
    expect(isTimed({ id: LIFT, mode: 'time' })).toBe(true)
    expect(isTimed({ id: LIFT })).toBe(false)
  })
})

describe('fmtSec', () => {
  it('reads as a clock, not a pile of seconds', () => {
    expect(fmtSec(0)).toBe('0:00')
    expect(fmtSec(9)).toBe('0:09')
    expect(fmtSec(45)).toBe('0:45')
    expect(fmtSec(60)).toBe('1:00')
    expect(fmtSec(90)).toBe('1:30')
    expect(fmtSec(605)).toBe('10:05')
  })
  it('is defensive about junk input', () => {
    expect(fmtSec(-5)).toBe('0:00')
    expect(fmtSec(undefined)).toBe('0:00')
    expect(fmtSec(null)).toBe('0:00')
    expect(fmtSec(NaN)).toBe('0:00')
    expect(fmtSec(44.6)).toBe('0:45')
  })
})

describe('setLabel', () => {
  it('describes each mode in its own terms', () => {
    expect(setLabel(LIFT, { w: 60, r: 10 })).toBe('60×10')
    expect(setLabel(CARDIO, { min: 20, speed: 9 })).toBe('20 min @ 9 km/h')
    expect(setLabel(LIFT, { sec: 45, w: 0 }, { mode: 'time' })).toBe('0:45')
    expect(setLabel(LIFT, { sec: 90, w: 20 }, { mode: 'time' })).toBe('1:30 · 20')
  })

  it('reads a legacy set with no config exactly as before', () => {
    expect(setLabel(LIFT, { w: 0, r: 0 })).toBe('0×0')
    expect(setLabel(CARDIO, {})).toBe('0 min @ 0 km/h')
  })

})

describe('defaultConfig', () => {
  it('gives each mode a sensible starting point', () => {
    expect(defaultConfig(LIFT)).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps' })
    expect(defaultConfig(CARDIO)).toEqual({ sets: 1, min: 20, speed: 8 })
    expect(defaultConfig(LIFT, 'time')).toEqual({ sets: 3, sec: 45, weight: 0, mode: 'time' })
  })
  it('seeds the bodyweight flag from the catalogue, and only when it is true', () => {
    expect(defaultConfig(BW)).toEqual({ sets: 3, reps: 10, weight: 0, mode: 'reps', bodyweight: true })
    expect(defaultConfig(BW, 'time')).toEqual({ sets: 3, sec: 45, weight: 0, mode: 'time', bodyweight: true })
    expect('bodyweight' in defaultConfig(LIFT)).toBe(false)
  })
})

/* ---------- bodyweight and per side (issues #31/#32/#33) ---------- */

describe('isBw', () => {
  it('defaults from the catalogue so an existing plan needs no flag', () => {
    expect(isBw({ id: BW })).toBe(true)
    expect(isBw({ id: LIFT })).toBe(false)
  })
  it('lets the config win in both directions — a belt on a dip, a flag on a machine', () => {
    expect(isBw({ id: BW, bodyweight: false })).toBe(false)
    expect(isBw({ id: LIFT, bodyweight: true })).toBe(true)
  })
})

describe('sideReps', () => {
  it('halves the logged total, because the total is what was logged', () => {
    expect(sideReps(16)).toBe(8)
    expect(sideReps(0)).toBe(0)
  })
  it('shows an odd total as it falls rather than rounding the imbalance away', () => {
    expect(sideReps(17)).toBe(8.5)
  })
})

describe('exLine — per side never reaches a timed hold', () => {
  it('ignores a stale side flag on a hold, which has no reps to split', () => {
    expect(exLine({ id: LIFT, sets: 3, sec: 45, mode: 'time', side: true }, 'kg')).toBe('3 × 0:45')
  })
})

describe('repStep', () => {
  it('steps unilateral work in twos so the total stays splittable', () => {
    expect(repStep({ side: true })).toBe(2)
    expect(repStep({})).toBe(1)
    expect(repStep(null)).toBe(1)
  })
})

describe('setLabel — bodyweight', () => {
  it('reads as reps alone, because "0×12" describes nothing', () => {
    expect(setLabel(BW, { w: 0, r: 12 }, { id: BW })).toBe('12')
  })
  it('spells out a belt as an addition', () => {
    expect(setLabel(BW, { w: 10, r: 8 }, { id: BW })).toBe('+10 × 8')
  })
  it('logs a per-side set as the plain total, like every other set in the app', () => {
    expect(setLabel(BW, { w: 0, r: 16 }, { id: BW, side: true })).toBe('16')
    expect(setLabel(LIFT, { w: 20, r: 16 }, { id: LIFT, side: true })).toBe('20×16')
  })
})

describe('exLine', () => {
  it('shows the split where there is room for it, next to the total you log', () => {
    expect(exLine({ id: LIFT, sets: 3, reps: 16, side: true }, 'kg')).toBe('3 × 16 · 8/side')
  })
  it('marks added weight as added', () => {
    expect(exLine({ id: BW, sets: 3, reps: 8, weight: 10 }, 'kg')).toBe('3 × 8 · +10 kg')
  })
  it('summarises a planned exercise per mode', () => {
    expect(exLine({ id: LIFT, sets: 3, reps: 10 }, 'kg')).toBe('3 × 10')
    expect(exLine({ id: LIFT, sets: 3, reps: 10, weight: 60 }, 'kg')).toBe('3 × 10 · 60 kg')
    expect(exLine({ id: LIFT, sets: 3, sec: 45, mode: 'time' }, 'kg')).toBe('3 × 0:45')
    expect(exLine({ id: LIFT, sets: 2, sec: 90, weight: 20, mode: 'time' }, 'kg')).toBe('2 × 1:30 · 20 kg')
    expect(exLine({ id: CARDIO, sets: 1, min: 20, speed: 8 }, 'kg')).toBe('1 × 20 min @ 8 km/h')
  })
})

const emptyS = { workouts: [], exWeights: {} }

describe('buildSets', () => {
  it('builds reps sets from the plan when there is no history', () => {
    expect(buildSets(emptyS, { id: LIFT, sets: 3, reps: 8, weight: 50 }))
      .toEqual([{ w: 50, r: 8, done: false }, { w: 50, r: 8, done: false }, { w: 50, r: 8, done: false }])
  })

  it('builds timed sets, carrying the planned duration and load', () => {
    expect(buildSets(emptyS, { id: LIFT, mode: 'time', sets: 2, sec: 60, weight: 20 }))
      .toEqual([{ sec: 60, w: 20, done: false }, { sec: 60, w: 20, done: false }])
  })

  it('builds cardio sets unchanged', () => {
    expect(buildSets(emptyS, { id: CARDIO, sets: 1, min: 25, speed: 9 }))
      .toEqual([{ min: 25, speed: 9, done: false }])
  })

  it('carries last time\'s numbers forward within the same mode', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, target: { mode: 'time' }, sets: [{ sec: 70, w: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'time', sets: 2, sec: 45, weight: 0 }))
      .toEqual([{ sec: 70, w: 10, done: false }, { sec: 70, w: 10, done: false }])
  })

  it('does not seed a duration from a rep count when an exercise switches to time', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, sets: [{ w: 60, r: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'time', sets: 1, sec: 45, weight: 0 }))
      .toEqual([{ sec: 45, w: 0, done: false }])
  })

  it('does not seed reps from a timed set when an exercise switches back', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, target: { mode: 'time' }, sets: [{ sec: 70, w: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'reps', sets: 1, reps: 8, weight: 40 }))
      .toEqual([{ w: 40, r: 8, done: false }])
  })

  it('still prefers the confirmed working weight for reps sets', () => {
    const S = { exWeights: { [LIFT]: { w: 75 } }, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, sets: [{ w: 60, r: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, sets: 1, reps: 8, weight: 50 })).toEqual([{ w: 75, r: 10, done: false }])
  })
})

describe('workoutVolume', () => {
  it('counts reps work and leaves timed/cardio sets out — there is no weight × reps for a hold', () => {
    const w = { entries: [
      { id: LIFT, sets: [{ w: 60, r: 10, done: true }, { w: 60, r: 10, done: false }] },
      { id: LIFT, target: { mode: 'time' }, sets: [{ sec: 60, w: 20, done: true }] },
      { id: CARDIO, sets: [{ min: 20, speed: 9, done: true }] }
    ] }
    expect(workoutVolume(w)).toBe(600)
  })

  it('needs no per-side case — the logged reps are already both sides (issue #31)', () => {
    const w = { entries: [{ id: LIFT, target: { side: true }, sets: [{ w: 20, r: 16, done: true }] }] }
    expect(workoutVolume(w)).toBe(320)
  })

  it('leaves an unloaded bodyweight set at zero volume rather than inventing a number', () => {
    const w = { entries: [{ id: BW, target: { bodyweight: true }, sets: [{ w: 0, r: 20, done: true }] }] }
    expect(workoutVolume(w)).toBe(0)
  })
})

describe('goalProgress', () => {
  it('measures the way covered toward the goal, in either direction', () => {
    expect(goalProgress(90, 85, 80)).toBe(0.5)     // cutting
    expect(goalProgress(70, 72.5, 75)).toBe(0.5)   // bulking
  })
  it('clamps: moving away is 0, overshooting is done', () => {
    expect(goalProgress(90, 92, 80)).toBe(0)
    expect(goalProgress(90, 78, 80)).toBe(1)
  })
  it('is null when there is nothing to measure', () => {
    expect(goalProgress(80, 80, 80)).toBe(null)
    expect(goalProgress(null, 80, 75)).toBe(null)
  })
})
