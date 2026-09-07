'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SECONDS, pickRecordingFormat, recorderSupported } from '@/lib/recorder'

export interface VoiceRecording {
  file: File
  seconds: number
}

/**
 * Graba audio del microfono y devuelve un File listo para subir. La conversion
 * a ogg/opus (lo que WhatsApp exige para un PTT) la hace el gateway.
 */
export function useVoiceRecorder(onFinish: (recording: VoiceRecording) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Se resuelve despues de montar: en el servidor no hay MediaRecorder y el
  // marcado tiene que coincidir con el que produce la hidratacion.
  const [supported, setSupported] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // La duracion se lleva tambien en un ref: onstop se cierra sobre el render
  // en el que arranco la grabacion y ahi el estado todavia vale 0.
  const secondsRef = useRef(0)
  const cancelledRef = useRef(false)
  const finishRef = useRef(onFinish)

  finishRef.current = onFinish

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
  }, [])

  useEffect(() => setSupported(recorderSupported()), [])

  // Si el componente se desmonta a mitad de la grabacion, soltamos el microfono.
  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    setError(null)

    if (!recorderSupported()) {
      setError('Este navegador no permite grabar audio.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const format = pickRecordingFormat()
      const recorder = new MediaRecorder(stream, format?.mime ? { mimeType: format.mime } : undefined)

      cancelledRef.current = false
      chunksRef.current = []
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const chunks = chunksRef.current
        const elapsed = secondsRef.current
        const mime = recorder.mimeType || format?.mime || 'audio/webm'
        const extension = format?.extension ?? 'webm'
        const wasCancelled = cancelledRef.current

        cleanup()

        if (wasCancelled || chunks.length === 0) return

        const blob = new Blob(chunks, { type: mime })
        const file = new File([blob], `nota-de-voz.${extension}`, { type: mime })

        finishRef.current({ file, seconds: elapsed })
      }

      recorder.start()
      setRecording(true)
      setSeconds(0)
      secondsRef.current = 0

      timerRef.current = setInterval(() => {
        setSeconds((current) => {
          const next = current + 1
          secondsRef.current = next
          // Corte duro para no subir archivos enormes por olvido.
          if (next >= MAX_RECORDING_SECONDS) recorderRef.current?.stop()
          return next
        })
      }, 1000)
    } catch (err) {
      cleanup()
      setError(
        (err as Error).name === 'NotAllowedError'
          ? 'No diste permiso para usar el microfono.'
          : `No se pudo iniciar la grabacion: ${(err as Error).message}`,
      )
    }
  }, [cleanup])

  const stop = useCallback(() => {
    cancelledRef.current = false
    recorderRef.current?.stop()
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    recorderRef.current?.stop()
    cleanup()
  }, [cleanup])

  return { recording, seconds, error, start, stop, cancel, supported }
}
