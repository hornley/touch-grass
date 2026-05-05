'use client';
import { useState, useRef, useEffect } from 'react';
import { detectPose, analyzeMeditation, PoseResult } from '@/lib/mediapipe';

interface PoseDetectionProps {
  onComplete: () => void;
  duration: number;
}

export function PoseDetection({ onComplete, duration }: PoseDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);

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
          setPoseResult(result);
          setScore(analysis.score);
          setStatus(analysis.status === 'unknown' ? 'detecting' : analysis.status);

          if (analysis.status === 'yoga') {
            setProgress((prev) => prev + 0.5);
          }
        } else {
          setStatus('no-pose');
          setPoseResult(null);
        }
      } catch (err) {
        console.error('Pose detection error:', err);
      }
    };

    const intervalId = setInterval(runDetection, 500);
    return () => clearInterval(intervalId);
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || video.offsetWidth;
    canvas.height = video.videoHeight || video.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!poseResult?.landmarks) return;

    const landmarks = poseResult.landmarks;
    const w = canvas.width;
    const h = canvas.height;
    const isYoga = status === 'yoga';

    ctx.strokeStyle = isYoga ? '#22c55e' : '#8855e';
    ctx.lineWidth = 3;
    ctx.fillStyle = isYoga ? '#22c55e' : '#8855e';

    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28],
      [11, 13], [12, 14], [13, 15], [14, 16],
    ];

    for (const [i, j] of connections) {
      if (landmarks[i] && landmarks[j]) {
        ctx.beginPath();
        ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
        ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
        ctx.stroke();
      }
    }

    const keyIndices = [0, 11, 12, 23, 24, 25, 26, 27, 28];
    for (const idx of keyIndices) {
      if (landmarks[idx]) {
        ctx.beginPath();
        ctx.arc(landmarks[idx].x * w, landmarks[idx].y * h, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [poseResult, status]);

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
    <div className="relative rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        loop
        webkit-playsinline="true"
        className="w-full"
        style={{ minHeight: '300px', backgroundColor: '#000' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ minHeight: '300px' }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
        <div className="text-center bg-black/60 rounded-xl p-4 backdrop-blur-sm">
          <div className="text-5xl font-bold text-white mb-1">{Math.floor(progress)}s</div>
          <p className="text-gray-300 text-sm mb-3">of {duration}s</p>

          <div className="w-48 bg-gray-700 rounded-full h-3 mb-3">
            <div
              className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full"
              style={{ width: `${Math.min(100, (progress / duration) * 100)}%` }}
            />
          </div>

          <div className="flex justify-center gap-3">
            <div className={`px-3 py-1 rounded-lg ${status === 'yoga' ? 'bg-green-600' : 'bg-gray-600'}`}>
              <span className="text-xl">🧘</span>
              <p className="text-xs text-white">{status === 'yoga' ? 'Yoga Pose' : 'Not detected'}</p>
            </div>
            <div className={`px-3 py-1 rounded-lg ${score > 50 ? 'bg-green-600' : 'bg-gray-600'}`}>
              <span className="text-xl">📊</span>
              <p className="text-xs text-white">{score.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}