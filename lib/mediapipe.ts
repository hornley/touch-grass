import {
  FilesetResolver,
  PoseLandmarker,
  ObjectDetector as MPObjectDetector,
} from '@mediapipe/tasks-vision';

let poseLandmarker: PoseLandmarker | null = null;
let objectDetector: MPObjectDetector | null = null;

export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-assets/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  return poseLandmarker;
}

export async function initObjectDetector(): Promise<MPObjectDetector> {
  if (objectDetector) return objectDetector;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  objectDetector = await MPObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/object_detector/ssd_mobilenet_v2/float32/1/ssd_mobilenet_v2.tflite',
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    maxResults: 10,
  });

  return objectDetector;
}

export interface PoseResult {
  landmarks: { x: number; y: number; z: number }[];
  confidence: number;
}

export async function detectPose(video: HTMLVideoElement): Promise<PoseResult | null> {
  const landmarker = await initPoseLandmarker();
  const results = landmarker.detectForVideo(video, performance.now());
  
  if (!results.landmarks || results.landmarks.length === 0) {
    return null;
  }

  return {
    landmarks: results.landmarks[0],
    confidence: 0.9,
  };
}

export interface ObjectDetectionResult {
  label: string;
  confidence: number;
}

export async function detectObjects(video: HTMLVideoElement): Promise<ObjectDetectionResult[]> {
  try {
    const detector = await initObjectDetector();
    const results = detector.detectForVideo(video, Date.now());
    
    console.log('Detection results:', results);
    
    if (!results.detections || results.detections.length === 0) {
      return [];
    }

  return results.detections.map((detection) => ({
      label: detection.categories?.[0]?.categoryName ?? 'unknown',
      confidence: detection.categories?.[0]?.score ?? 0,
    }));
  } catch (error) {
    console.error('Object detection error:', error);
    return [];
  }
}

export interface MeditationAnalysis {
  sitting: number;
  stillness: number;
  score: number;
  status: 'sitting' | 'standing' | 'unknown';
}

export function analyzeMeditation(landmarks: { x: number; y: number; z: number }[]): MeditationAnalysis {
  if (!landmarks || landmarks.length < 33) {
    return { sitting: 0, stillness: 0, score: 0, status: 'unknown' };
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;
  const torsoLength = hipMidY - shoulderMidY;

  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  const torsoRatio = torsoLength > 0 ? shoulderWidth / torsoLength : 0;

  const sittingScore = torsoRatio > 0.4 && torsoRatio < 1.2 ? Math.min(1, torsoRatio / 0.6) : 0;

  const headY = nose.y;
  const isUpright = headY > shoulderMidY - 0.15 && headY < shoulderMidY + 0.1;

  const sitting = Math.min(1, (sittingScore + (isUpright ? 0.5 : 0)) / 1.5);
  const stillness = 0.7;

  const score = sitting * 0.6 + stillness * 0.4;
  const status: 'sitting' | 'standing' | 'unknown' = sitting > 0.5 ? 'sitting' : 'standing';

  return {
    sitting: sitting * 100,
    stillness: stillness * 100,
    score: score * 100,
    status,
  };
}

export const OBJECT_TARGETS: Record<string, string[]> = {
  tree: ['potted plant', 'plant', 'tree'],
  cup: ['cup', 'bottle', 'wine glass', 'glass'],
  book: ['book', 'notebook', 'keyboard'],
  phone: ['cell phone', 'mobile phone', 'remote', 'tv'],
  person: ['person'],
  cat: ['cat'],
  dog: ['dog'],
  chair: ['chair', 'dining table', 'couch'],
};

export function matchesTarget(label: string, target: string): boolean {
  const targetLabels = OBJECT_TARGETS[target] || [target];
  const lowerLabel = label.toLowerCase();
  return targetLabels.some((t) => lowerLabel.includes(t.toLowerCase()));
}