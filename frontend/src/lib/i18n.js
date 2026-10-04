// The UI is English. t() fills the {0},{1}… placeholders in a string, and is the one place
// a translation would hook in again (the upstream language packs were removed).
export function t(s, ...args) {
  for (let i = 0; i < args.length; i++) s = s.replaceAll('{' + i + '}', args[i])
  return s
}

export const dateLocale = () => 'en-GB'
