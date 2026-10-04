// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). Every persist()
// therefore also lands in a JSON file in the app's private data directory, and boot()
// restores from it. The workout reminder uses native local notifications scheduled per
// planned weekday — no server involved, unlike Web Push in the self-hosted version.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it.
import { t } from './i18n.js'
import { localMedia, remoteMedia, planMedia } from './exercises.js'
import { todayISO } from './format.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'

const FILE = 'opengym-state.json'

export async function nativeLoad() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    return JSON.parse(r.data)
  } catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

export async function nativeSave(state) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: JSON.stringify(state), encoding: Encoding.UTF8 })
  } catch (e) { /* keep the localStorage copy */ }
}

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
export async function syncReminder(S, interactive = false) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: 100 + d })) }).catch(() => {})
    const r = S.reminder
    if (!r?.on) return true
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    const [hour, minute] = (r.time || '08:00').split(':').map(Number)
    const notifications = Object.entries(S.week || {})
      .filter(([, rid]) => rid && (S.routines || []).some(x => x.id === rid))
      .map(([day, rid]) => ({
        id: 100 + Number(day),
        title: t('Workout day'),
        body: t('{0} is on the plan today — let’s go!', S.routines.find(x => x.id === rid).name),
        // Capacitor weekdays are 1 (Sunday) … 7 (Saturday); S.week uses getDay() 0…6.
        schedule: { on: { weekday: Number(day) + 1, hour, minute }, allowWhileIdle: true },
      }))
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch (e) { return false }
}

// Offline animations: the GIF + still of every exercise in the plan are saved on the phone and
// served from there (exercises.js), so a gym without signal still shows them.
// ponytail: cache dir — Android may clear it when storage runs low; it refills next time online.
// Kept out of the data dir so it never bloats the Google backup of the training log.
const MEDIA = 'media'
let mediaRun = null, mediaNext = null

export async function loadMedia() {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Capacitor } = await import('@capacitor/core')
    const { files } = await Filesystem.readdir({ path: MEDIA, directory: Directory.Cache })
    files.forEach(f => { if (!f.name.endsWith('.part')) localMedia[f.name] = Capacitor.convertFileSrc(f.uri) })
  } catch (e) { /* nothing saved yet */ }
}

// Download whatever the plan needs and isn't saved yet. Runs one at a time; a call while it
// runs just queues the newest state.
export function syncMedia(S) {
  mediaNext = S
  if (!mediaRun) mediaRun = (async () => {
    while (mediaNext) { const s = mediaNext; mediaNext = null; await downloadMedia(s) }
    mediaRun = null
  })()
}

async function downloadMedia(S) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Capacitor } = await import('@capacitor/core')
  for (const name of planMedia(S).filter(n => !localMedia[n])) {
    try {
      const res = await fetch(remoteMedia(name))
      if (!res.ok) continue
      const blob = await res.blob()
      const data = await new Promise((ok, no) => {
        const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob)
      })
      // written under a temp name first, so an app killed mid-write never leaves a broken file
      const tmp = `${MEDIA}/${name}.part`, path = `${MEDIA}/${name}`
      await Filesystem.writeFile({ path: tmp, directory: Directory.Cache, data, recursive: true })
      await Filesystem.rename({ from: tmp, to: path, directory: Directory.Cache })
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
      localMedia[name] = Capacitor.convertFileSrc(uri)
    } catch (e) { return }   // offline — retried on the next change or launch
  }
}

// Weekly automatic backup to Documents/openGym on the phone — reachable from the Files app,
// and it survives uninstalling the app. The newest 5 are kept.
const BAK = 'openGym'
const BAK_RE = /^opengym-backup-(\d{4}-\d\d-\d\d)\.json$/
export async function autoBackup(S) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    let files = []
    try {
      files = (await Filesystem.readdir({ path: BAK, directory: Directory.Documents })).files
        .map(f => f.name).filter(n => BAK_RE.test(n)).sort()
    } catch (e) { /* no folder yet */ }
    const last = files.length ? files[files.length - 1].match(BAK_RE)[1] : null
    if (last && Date.now() - Date.parse(last) < 7 * 86400000) return
    await Filesystem.writeFile({
      path: `${BAK}/opengym-backup-${todayISO()}.json`, directory: Directory.Documents,
      data: JSON.stringify(S, null, 2), encoding: Encoding.UTF8, recursive: true
    })
    for (const old of files.slice(0, -4)) await Filesystem.deleteFile({ path: `${BAK}/${old}`, directory: Directory.Documents })
  } catch (e) { /* storage unavailable — the next launch tries again */ }
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}
