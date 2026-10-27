/** Stable per-browser analysis session id (also used by the backend history store). */
export function getSessionId(): string {
  const KEY = 'medvision_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id =
      crypto.randomUUID?.() ??
      `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(KEY, id)
  }
  return id
}
