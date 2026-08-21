import * as faceapi from 'face-api.js'
import * as canvas from 'canvas'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'node:fs'

// Patch face-api.js to use node-canvas
const { Canvas, Image, ImageData } = canvas
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODEL_PATH = path.join(__dirname, '..', 'face-models')

let modelsLoaded = false

/**
 * Load face-api.js models once. Idempotent — safe to call multiple times.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return

  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Face models directory not found at ${MODEL_PATH}. Please download the models.`)
  }

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH)

  modelsLoaded = true
  console.log('[FaceRecognition] Models loaded successfully from', MODEL_PATH)
}

/**
 * Compute a 128-float face descriptor from an image buffer.
 * Returns null if no face is detected.
 */
export async function computeDescriptor(imageBuffer: Buffer): Promise<Float32Array | null> {
  await loadModels()

  const img = await canvas.loadImage(imageBuffer)
  const detection = await faceapi
    .detectSingleFace(img as any)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null
  return detection.descriptor
}

/**
 * Compute descriptor from a file path (convenience wrapper).
 */
export async function computeDescriptorFromFile(filePath: string): Promise<Float32Array | null> {
  const buffer = fs.readFileSync(filePath)
  return computeDescriptor(buffer)
}

/**
 * Compare two face descriptors using Euclidean distance.
 * Lower distance = more similar. Threshold of 0.6 is standard.
 */
export function euclideanDistance(desc1: Float32Array | number[], desc2: Float32Array | number[]): number {
  let sum = 0
  for (let i = 0; i < desc1.length; i++) {
    const diff = (desc1[i] ?? 0) - (desc2[i] ?? 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export interface MatchResult {
  matched: boolean
  confidence: number
  employeeId?: string
  employeeDocId?: string
  employeeName?: string
}

/**
 * Find the best matching employee from a list of employees with stored descriptors.
 * @param selfieDescriptor - The 128-float descriptor of the selfie
 * @param employees - Array of { id, employeeId, name, faceDescriptor }
 * @param threshold - Maximum Euclidean distance to consider a match (default 0.6)
 */
export function findBestMatch(
  selfieDescriptor: Float32Array | number[],
  employees: Array<{
    id: string
    employeeId: string
    name: string
    faceDescriptor: number[]
  }>,
  threshold = 0.6,
): MatchResult {
  let bestDistance = Infinity
  let bestEmployee: (typeof employees)[0] | null = null

  for (const emp of employees) {
    if (!emp.faceDescriptor || !Array.isArray(emp.faceDescriptor)) continue
    const distance = euclideanDistance(selfieDescriptor, emp.faceDescriptor)
    if (distance < bestDistance) {
      bestDistance = distance
      bestEmployee = emp
    }
  }

  if (bestEmployee && bestDistance <= threshold) {
    // Convert distance to confidence (0 distance = 1.0 confidence, threshold distance = 0.0)
    const confidence = Math.max(0, Math.min(1, 1 - bestDistance / threshold))
    return {
      matched: true,
      confidence: Math.round(confidence * 100) / 100,
      employeeId: bestEmployee.employeeId,
      employeeDocId: bestEmployee.id,
      employeeName: bestEmployee.name,
    }
  }

  return {
    matched: false,
    confidence: 0,
  }
}
