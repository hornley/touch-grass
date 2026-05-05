'use client';
import { useState, useRef, useEffect } from 'react';
import { detectObjects, matchesTarget } from '@/lib/mediapipe';

interface ObjectDetectionProps {
  onComplete: () => void;
  targetObject: string;
}

export function ObjectDetection({ onComplete, targetObject }: ObjectDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<{ label: string; confidence: number }[]>([]);
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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        loop
        webkit-playsinline="true"
        className="w-full rounded-lg bg-black"
        style={{ minHeight: '200px' }}
      />

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
