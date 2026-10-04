import { useSyncExternalStore } from 'octane'

// Match Launcher's phone and short landscape layouts.
export const MOBILE_MEDIA_QUERY = '(max-width: 574px), (orientation: landscape) and (max-height: 500px)'

const subscribe = (notify: VoidFunction) => {
  const media = window.matchMedia(MOBILE_MEDIA_QUERY)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const getSnapshot = () => window.matchMedia(MOBILE_MEDIA_QUERY).matches
const getServerSnapshot = () => true

export function useMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
