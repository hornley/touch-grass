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
        className={isStarting ? undefined : 'animate-pulse-glow'}
        style={{
          fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
          color: isStarting ? '#3d4f60' : '#d4a030',
          background: 'none',
          border: `1px solid ${isStarting ? '#1c2c3c' : '#d4a030'}`,
          padding: '12px 24px', cursor: isStarting ? 'default' : 'pointer',
          transition: 'all 0.2s', width: '100%',
        }}
      >
        {isStarting ? 'INITIALIZING...' : '◈ BEGIN SEARCH'}
      </button>
    );
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div className="relative rounded-lg overflow-hidden" style={{ minHeight: '200px', background: '#000', border: '1px solid #2a3d52' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          loop
          webkit-playsinline="true"
          style={{ width: '100%', display: 'block' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>

      <div style={{ marginTop: '12px', textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '2px',
          color: '#6a8898', marginBottom: '12px',
        }}>
          FIND: <span style={{ color: '#d4a030', textTransform: 'capitalize' }}>{targetObject}</span>
        </p>

        {found && (
          <div style={{
            background: 'rgba(45,110,72,0.15)', border: '1px solid #2d6e48',
            color: '#4ade80', padding: '10px 16px', borderRadius: '4px',
            marginBottom: '12px', fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '2px',
          }}>
            ◆ FOUND — QUEST COMPLETE
          </div>
        )}

        <div style={{
          background: '#172030', border: '1px solid #2a3d52',
          padding: '12px', borderRadius: '4px',
        }}>
          <p style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '2px',
            color: '#4e6878', marginBottom: '10px',
          }}>DETECTED</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {detectedObjects.length > 0 ? (
              detectedObjects.map((obj, idx) => {
                const isMatch = matchesTarget(obj.label, targetObject) && obj.confidence > detectionThreshold;
                return (
                  <span
                    key={idx}
                    style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '11px',
                      border: `1px solid ${isMatch ? '#2d6e48' : '#2a3d52'}`,
                      background: isMatch ? 'rgba(45,110,72,0.15)' : 'transparent',
                      color: isMatch ? '#4ade80' : '#6a8898',
                      fontFamily: 'var(--font-inconsolata, monospace)',
                    }}
                  >
                    {obj.label} {Math.round(obj.confidence * 100)}%
                  </span>
                );
              })
            ) : (
              <span style={{ color: '#4e6878', fontSize: '11px', fontFamily: 'var(--font-cinzel)', letterSpacing: '2px' }}>
                SCANNING...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
