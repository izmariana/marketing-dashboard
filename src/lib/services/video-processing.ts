import os from "os";
import path from "path";
import fs from "fs/promises";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * IMPORTANTE — esto corre ffmpeg dentro de una función serverless de
 * Vercel. Funciona, pero con límites reales que vale la pena conocer
 * antes de usarlo en producción con muchos videos:
 *  - El binario de ffmpeg agrega ~80MB al bundle de esta función.
 *  - Descargar el video + transcribirlo + extraer frames puede acercarse
 *    al límite de duración de la función (ver `maxDuration` en la ruta
 *    que llama a este servicio) para videos largos o con conexión lenta.
 *  - Se usa /tmp (el único directorio escribible en Vercel), que tiene un
 *    límite de espacio (~512MB-1GB según el plan) — se borra el archivo
 *    apenas termina, pero si el video es muy pesado puede fallar antes.
 * Si esto resulta poco confiable en producción, la alternativa es mover
 * el procesamiento a un worker fuera de Vercel (ej. una cola + un
 * servidor con más tiempo/recursos) en vez de la función serverless.
 */

async function downloadToTempFile(url: string, extension: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el video (HTTP ${res.status}). La URL puede haber expirado — vuelve a sincronizar el contenido.`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `video-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}

export interface TranscriptionResult {
  text: string;
  /** Segmentos con marca de tiempo, para poder correlacionar con la caída de retención. */
  segments: { start: number; end: number; text: string }[];
}

/**
 * Transcribe el audio del video con Whisper. OpenAI acepta el archivo de
 * video directamente (mp4/mov/webm) — no hace falta separar el audio a
 * mano para este paso.
 */
export async function transcribeVideo(videoUrl: string, apiKey: string): Promise<TranscriptionResult> {
  const client = new OpenAI({ apiKey });
  const tmpPath = await downloadToTempFile(videoUrl, ".mp4");
  try {
    const fileBuffer = await fs.readFile(tmpPath);
    const file = new File([fileBuffer], "video.mp4", { type: "video/mp4" });

    const transcription = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      language: "es",
    });

    const verbose = transcription as unknown as { text: string; segments?: Array<{ start: number; end: number; text: string }> };
    return {
      text: verbose.text,
      segments: verbose.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text })) ?? [],
    };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/**
 * Extrae N frames distribuidos uniformemente a lo largo del video, como
 * imágenes JPEG en base64 (para mandarlas a GPT-4o Vision). Si ffmpeg
 * falla por cualquier motivo (formato no soportado, timeout, etc.),
 * devuelve un array vacío en vez de tirar abajo todo el análisis — el
 * resto del análisis (transcripción + métricas) sigue funcionando igual.
 */
export async function extractFrames(videoUrl: string, count = 6): Promise<string[]> {
  let videoPath: string | null = null;
  const frameDir = path.join(os.tmpdir(), `frames-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    videoPath = await downloadToTempFile(videoUrl, ".mp4");
    await fs.mkdir(frameDir, { recursive: true });

    const durationSec = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath as string, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration ?? 0);
      });
    });
    if (!durationSec || durationSec <= 0) return [];

    const timestamps = Array.from({ length: count }, (_, i) => (durationSec * (i + 0.5)) / count);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath as string)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .screenshots({ timestamps, filename: "frame-%i.jpg", folder: frameDir, size: "480x?" });
    });

    const files = (await fs.readdir(frameDir)).sort();
    const frames: string[] = [];
    for (const f of files) {
      const buf = await fs.readFile(path.join(frameDir, f));
      frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
    }
    return frames;
  } catch {
    return [];
  } finally {
    if (videoPath) await fs.unlink(videoPath).catch(() => {});
    await fs.rm(frameDir, { recursive: true, force: true }).catch(() => {});
  }
}
