'use client';
import { useState, useRef, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: () => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [, setCameraError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [stream]);

  const startCamera = async () => {
    setIsStarting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      setCameraError(null);
    } catch {
      setCameraError('Camera access denied');
      setShowFallback(true);
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => { stream?.getTracks().forEach(t => t.stop()); setStream(null); };
  const capturePhoto = () => { stopCamera(); onCapture(); };

  if (showFallback) {
    return (
      <label style={{ display: 'inline-block', cursor: 'pointer' }}>
        <span style={{
          display: 'inline-block',
          fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
          color: '#8a9aac', border: '1px solid #1c2c3c', padding: '10px 20px',
        }}>
          ◈ UPLOAD PHOTO
        </span>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files?.length) onCapture(); }} />
      </label>
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
          transition: 'all 0.2s',
        }}
      >
        {isStarting ? 'ACCESSING LENS...' : '◈ OPEN LENS'}
      </button>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '10px', border: '1px solid #1c2c3c' }}>
        <video
          ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', display: 'block', background: '#000', minHeight: '180px' }}
        />
        {/* Corner brackets overlay */}
        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute',
            ...(pos.includes('top-0') ? { top: 8 } : { bottom: 8 }),
            ...(pos.includes('left-0') ? { left: 8 } : { right: 8 }),
            width: 16, height: 16,
            borderTop: pos.includes('top-0') ? '1px solid rgba(212,160,48,0.6)' : 'none',
            borderBottom: pos.includes('bottom-0') ? '1px solid rgba(212,160,48,0.6)' : 'none',
            borderLeft: pos.includes('left-0') ? '1px solid rgba(212,160,48,0.6)' : 'none',
            borderRight: pos.includes('right-0') ? '1px solid rgba(212,160,48,0.6)' : 'none',
            pointerEvents: 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={capturePhoto}
          style={{
            flex: 1, fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
            color: '#d4a030', background: 'rgba(212,160,48,0.07)',
            border: '1px solid #d4a030', padding: '12px', cursor: 'pointer',
          }}
        >
          ◈ CAPTURE
        </button>
        <button
          onClick={() => { stopCamera(); setShowFallback(true); }}
          style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '11px',
            color: '#3d4f60', background: 'none', border: '1px solid #1c2c3c',
            padding: '12px 16px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
