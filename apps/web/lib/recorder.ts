'use client'

/** Formatos que puede grabar el navegador, del mas conveniente al menos. */
const CANDIDATE_TYPES: { mime: string; extension: string }[] = [
  // Firefox graba ogg/opus directo: es lo que WhatsApp quiere, sin conversion.
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/webm', extension: 'webm' },
  { mime: 'audio/mp4', extension: 'm4a' },
]

export const MAX_RECORDING_SECONDS = 300

export function recorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export function pickRecordingFormat(): { mime: string; extension: string } | null {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return null

  for (const candidate of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate
  }

  // Sin tipo soportado explicitamente, dejamos que el navegador elija.
  return { mime: '', extension: 'webm' }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
