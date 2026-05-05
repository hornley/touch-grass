'use client';
import { useState, useRef, useEffect } from 'react';
import { detectPose, analyzeMeditation } from '@/lib/mediapipe';

interface PoseDetectionProps {
  onComplete: () => void;
  duration: number;
}

export function PoseDetection({ onComplete, duration }: PoseDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);

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
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      setError(null);
      setStatus('detecting');
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
        const result = await detectPose(video);

        if (result && result.landmarks && result.landmarks.length > 0) {
          const analysis = analyzeMeditation(result.landmarks);
          setScore(analysis.score);
          setStatus(analysis.status === 'unknown' ? 'detecting' : analysis.status);

          if (analysis.score > 70) {
            setProgress((prev) => prev + 0.5);
          }
        } else {
          setStatus('no-pose');
        }
      } catch (err) {
        console.error('Pose detection error:', err);
      }
    };

    const intervalId = setInterval(runDetection, 500);
    return () => clearInterval(intervalId);
  }, [stream]);

  useEffect(() => {
    if (progress >= duration) {
      onComplete();
    }
  }, [progress, duration, onComplete]);

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
        className="bg-purple-600 text-white px-6 py-3 rounded-lg text-lg font-semibold disabled:bg-gray-500"
      >
        {isStarting ? 'Opening...' : 'Start Meditation'}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <video ref={videoRef} autoPlay playsInline muted loop webkit-playsinline="true" className="hidden" />

      <div className="text-center">
        <div className="text-5xl font-bold mb-2">{Math.floor(progress)}s</div>
        <p className="text-gray-400 mb-4">of {duration}s meditation</p>

        <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
          <div
            className="bg-gradient-to-r from-purple-500 to-purple-700 h-4 rounded-full"
            style={{ width: `${Math.min(100, (progress / duration) * 100)}%` }}
          />
        </div>

        <div className="flex justify-center gap-4 mb-4">
          <div className={`px-4 py-2 rounded-lg ${status === 'sitting' ? 'bg-green-600' : 'bg-gray-700'}`}>
            <span className="text-2xl">🧘</span>
            <p className="text-sm">Sitting</p>
          </div>
          <div className={`px-4 py-2 rounded-lg ${score > 50 ? 'bg-green-600' : 'bg-gray-700'}`}>
            <span className="text-2xl">📊</span>
            <p className="text-sm">{score.toFixed(0)}%</p>
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          Keep your face visible in the camera
        </p>
      </div>
    </div>
  );
}