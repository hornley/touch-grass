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
      <div style={{
        padding: '16px', background: '#2a1a1a', border: '1px solid #7f1d1d',
        borderRadius: '4px', textAlign: 'center', marginTop: '12px',
      }}>
        <p style={{ color: '#fca5a5', fontSize: '12px' }}>{error}</p>
        <button onClick={startCamera} style={{
          marginTop: '10px', fontFamily: 'var(--font-cinzel)', fontSize: '10px',
          letterSpacing: '2px', color: '#d4a030', background: 'none',
          border: '1px solid #d4a030', padding: '8px 20px', cursor: 'pointer',
        }}>
          RETRY
        </button>
      </div>
    );
  }

  if (!stream) {
    return (
      <button
        onClick={startCamera}
        disabled={isStarting}
        style={{
          fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
          color: isStarting ? '#3d4f60' : '#d4a030',
          background: 'none',
          border: `1px solid ${isStarting ? '#1c2c3c' : '#d4a030'}`,
          padding: '12px 24px', cursor: isStarting ? 'default' : 'pointer',
          transition: 'all 0.2s', width: '100%',
        }}
      >
        {isStarting ? 'INITIALIZING...' : '◈ BEGIN MEDITATION'}
      </button>
    );
  }

  return (
    <div style={{
      position: 'relative', border: '1px solid #2a3d52', overflow: 'hidden',
      background: '#172030', marginTop: '12px',
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        loop
        webkit-playsinline="true"
        style={{ width: '100%', display: 'block', background: '#000', minHeight: '240px' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ minHeight: '300px' }}
      />

      {/* Timer at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(180deg, rgba(13,21,32,0.9) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '24px', fontWeight: 900,
            color: '#d4a030', letterSpacing: '1px',
          }}>
            {duration - Math.floor(progress)}
          </span>
          <span style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '8px', letterSpacing: '2px',
            color: '#6a8898',
          }}>
            SEC
          </span>
        </div>
        <div style={{
          flex: 1, height: '4px', background: '#172030', border: '1px solid #2a3d52',
          marginLeft: '16px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (progress / duration) * 100)}%`,
            background: 'linear-gradient(90deg, #1e3a2a, #d4a030)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Status at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(0deg, rgba(13,21,32,0.9) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'center', gap: '12px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '4px',
          border: `1px solid ${status === 'yoga' ? '#2d6e48' : '#2a3d52'}`,
          background: status === 'yoga' ? 'rgba(45,110,72,0.15)' : 'transparent',
        }}>
          <span style={{ fontSize: '14px' }}>🧘</span>
          <span style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '8px', letterSpacing: '2px',
            color: status === 'yoga' ? '#4ade80' : '#4e6878',
          }}>
            {status === 'yoga' ? 'YOGA' : 'NONE'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '4px',
          border: `1px solid ${score > 50 ? '#2d6e48' : '#2a3d52'}`,
          background: score > 50 ? 'rgba(45,110,72,0.15)' : 'transparent',
        }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '8px', letterSpacing: '2px',
            color: score > 50 ? '#4ade80' : '#4e6878',
          }}>
            {score.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}