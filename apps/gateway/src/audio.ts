import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { logger } from './logger'

/** Mime que espera WhatsApp para una nota de voz. */
export const PTT_MIME = 'audio/ogg; codecs=opus'

const CONVERSION_TIMEOUT_MS = 60_000

export class FfmpegMissingError extends Error {
  constructor(binary: string) {
    super(
      `El gateway necesita ${binary} para convertir notas de voz a opus. ` +
        'Instalalo en el host (apt install ffmpeg) o envia el audio como adjunto comun.',
    )
    this.name = 'FfmpegMissingError'
  }
}

function run(binary: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args)
    let stdout = ''
    let stderr = ''

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${binary} tardo demasiado y se cancelo`))
    }, CONVERSION_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject((err as NodeJS.ErrnoException).code === 'ENOENT' ? new FfmpegMissingError(binary) : err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

async function probeDuration(file: string): Promise<number> {
  try {
    const { code, stdout } = await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ])

    if (code !== 0) return 0

    const seconds = Number.parseFloat(stdout.trim())
    return Number.isFinite(seconds) ? Math.round(seconds) : 0
  } catch (err) {
    // ffprobe es opcional: sin duracion WhatsApp igual reproduce la nota.
    logger.debug({ err }, 'no se pudo medir la duracion del audio')
    return 0
  }
}

/**
 * Convierte cualquier audio (webm/opus de Chrome, mp4 de Safari, mp3...) al
 * ogg/opus mono que WhatsApp exige para las notas de voz.
 */
export async function toVoiceNote(input: Buffer): Promise<{ buffer: Buffer; seconds: number }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nd-ptt-'))
  const source = path.join(dir, 'source')
  const target = path.join(dir, 'voice.ogg')

  try {
    await writeFile(source, input)

    const { code, stderr } = await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      source,
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-f',
      'ogg',
      target,
    ])

    if (code !== 0) {
      throw new Error(`ffmpeg no pudo convertir la nota de voz: ${stderr.trim().slice(0, 300)}`)
    }

    const [buffer, seconds] = await Promise.all([readFile(target), probeDuration(target)])

    return { buffer, seconds }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
