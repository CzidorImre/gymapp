import { create } from 'zustand'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder, loadMedia, syncMedia, autoBackup } from '../lib/mobile.js'

const KEY = 'gym_state_v1'
export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true,
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  // name: Home greeting. goalFrom: weight the current goal started from (goal progress bar).
  // exNotes: { exId: text }. measures: [{ d, t, waist, … }].
  // barW: plate-calculator bar weight, null = 20 kg / 45 lb.
  name: 'Imre', goalFrom: null, exNotes: {}, measures: [], barW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  reminder: { on: false, time: '08:00', tz: null }
}
const clone = o => JSON.parse(JSON.stringify(o))

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

export const useStore = create((set, get) => {
  let saveTm = null

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S); syncMedia(get().S) }, 800)
  }

  const persist = S => {
    S._ts = Date.now()
    registerCustom(S.customEx)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (MOBILE) nativePersist()
  }

  // A change made right before backgrounding must not get lost mid-debounce — backgrounding is
  // often the last thing before the OS kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !MOBILE || !saveTm) return
    clearTimeout(saveTm)
    saveTm = null
    nativeSave(get().S)
  })

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    ready: false,

    // Mutate a draft of S via producer fn, then persist.
    update(mut) {
      const S = clone(get().S)
      mut(S)
      persist(S)
    },
    replaceState(S) { persist(clone(S)) },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in the app bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      persist(Object.assign(clone(DEF), buildDemoState()))
    },

    async boot() {
      // Restore from the file mirror (the durable copy; localStorage may have been evicted
      // since the last run).
      if (MOBILE) {
        // saved animations are known before the first render that counts (ready below)
        const [saved] = await Promise.all([nativeLoad(), loadMedia()])
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(Object.assign(clone(DEF), saved))
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        syncReminder(get().S)
        syncMedia(get().S)
        if (hasData(get().S)) autoBackup(get().S)
      } else if (DEMO && !localStorage.getItem(DEMO_SEEDED)) {
        localStorage.setItem(DEMO_SEEDED, '1')
        await get().resetDemo()
      }
      set({ ready: true })
    }
  }
})

export { hasData }
