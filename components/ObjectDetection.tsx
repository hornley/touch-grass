'use client';
import { useState, useRef, useEffect } from 'react';
import { detectObjects, matchesTarget, ObjectDetectionResult } from '@/lib/mediapipe';

interface ObjectDetectionProps {
  onComplete: () => void;
  targetObject: string;
}

export function ObjectDetection({ onComplete, targetObject }: ObjectDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<ObjectDetectionResult[]>([]);
  const [found, setFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectionThreshold = 0.55;

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || video.offsetWidth;
    canvas.height = video.videoHeight || video.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const targetMatch = detectedObjects.find(
      (obj) => matchesTarget(obj.label, targetObject) && obj.confidence > detectionThreshold
    );

    if (targetMatch?.boundingBox) {
      const box = targetMatch.boundingBox;
      const x = (box.originX ?? 0) * canvas.width;
      const y = (box.originY ?? 0) * canvas.height;
      const w = box.width * canvas.width;
      const h = box.height * canvas.height;

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(x, y, w, h);
    } else {
      for (const obj of detectedObjects) {
        if (obj.boundingBox && matchesTarget(obj.label, targetObject)) {
          const box = obj.boundingBox;
          const x = (box.originX ?? 0) * canvas.width;
          const y = (box.originY ?? 0) * canvas.height;
          const w = box.width * canvas.width;
          const h = box.height * canvas.height;

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(x, y, w, h);
          break;
        }
      }
    }
  }, [detectedObjects, targetObject, detectionThreshold]);

  const startCamera = async () => {
    setIsStarting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied or unavailable');
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const runDetection = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const results = await detectObjects(video);
        setDetectedObjects(results);

        const match = results.find((obj) =>
          matchesTarget(obj.label, targetObject) && obj.confidence > detectionThreshold
        );

        if (match && !found) {
          setFound(true);
          setTimeout(() => onComplete(), 1000);
        }
      } catch (err) {
        console.error('Detection error:', err);
      }
    };

    const intervalId = setInterval(runDetection, 1000);
    return () => clearInterval(intervalId);
  }, [stream, targetObject, onComplete, found, detectionThreshold]);

  if (error) {
    return (
      <div className="p-4 bg-red-900 rounded-lg text-center">
        <p className="text-white">{error}</p>
        <button onClick={startCamera} className="mt-2 bg-red-700 text-white px-4 py-2 rounded">
          Retry
        </button>
      </div>
    );
  }

  if (!stream) {
    return (
      <button
        onClick={startCamera}
        disabled={isStarting}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold disabled:bg-gray-500"
      >
        {isStarting ? 'Opening...' : 'Start Camera'}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden" style={{ minHeight: '200px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          loop
          webkit-playsinline="true"
          className="w-full rounded-lg bg-black"
          style={{ width: '100%', display: 'block' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      <div className="text-center">
        <p className="text-lg font-semibold mb-2">
          Find: <span className="capitalize text-blue-400">{targetObject}</span>
        </p>

        {found && (
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg mb-4">
            ✓ Found! Quest Complete!
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-sm text-gray-400 mb-2">Detected:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {detectedObjects.length > 0 ? (
              detectedObjects.map((obj, idx) => (
                <span
                  key={idx}
                  className={`px-3 py-1 rounded-full text-sm ${
                    matchesTarget(obj.label, targetObject) && obj.confidence > detectionThreshold
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-gray-300'
                  }`}
                >
                  {obj.label} ({Math.round(obj.confidence * 100)}%)
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-sm">Searching...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
