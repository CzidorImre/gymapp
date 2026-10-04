// Plate calculator: what goes on each side of the bar for a total load (bar included).
// Greedy from the heaviest plate — exact for these sets, since each is built on its smallest plate.
export const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] }
export const DEFAULT_BAR = { kg: 20, lb: 45 }
export const BAR_EQ = ['barbell', 'olympic barbell']

// null when the load is lighter than the bar; `rest` is total load the plates can't make up.
export function platesFor(total, bar, plates) {
  let side = (total - bar) / 2
  if (!(side >= 0)) return null
  const out = []
  for (const p of plates) while (side >= p - 1e-9) { out.push(p); side -= p }
  return { plates: out, rest: Math.round(side * 2 * 100) / 100 }
}
