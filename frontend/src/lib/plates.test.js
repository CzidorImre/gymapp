import { describe, it, expect } from 'vitest'
import { platesFor, PLATES } from './plates.js'

describe('platesFor', () => {
  it('splits the load over both sides, heaviest plates first', () => {
    expect(platesFor(100, 20, PLATES.kg)).toEqual({ plates: [25, 15], rest: 0 })
    expect(platesFor(62.5, 20, PLATES.kg)).toEqual({ plates: [20, 1.25], rest: 0 })
    expect(platesFor(225, 45, PLATES.lb)).toEqual({ plates: [45, 45], rest: 0 })
  })
  it('an empty bar needs no plates; lighter than the bar is impossible', () => {
    expect(platesFor(20, 20, PLATES.kg)).toEqual({ plates: [], rest: 0 })
    expect(platesFor(15, 20, PLATES.kg)).toBe(null)
  })
  it('reports what the plates cannot make up', () => {
    expect(platesFor(101, 20, PLATES.kg)).toEqual({ plates: [25, 15], rest: 1 })
  })
})
