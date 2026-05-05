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
      setCameraError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Camera access denied or unavailable');
      setShowFallback(true);
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    stopCamera();
    onCapture();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onCapture();
    }
  };

  if (showFallback) {
    return (
      <div className="p-4 border-2 border-dashed border-gray-400 rounded-lg text-center">
        <p className="text-gray-600 mb-2">Camera unavailable</p>
        <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
          Upload Photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    );
  }

  if (!stream) {
    return (
      <button
        onClick={startCamera}
        disabled={isStarting}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-500"
      >
        {isStarting ? 'Opening...' : 'Open Camera'}
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
      <div className="flex gap-2">
        <button
          onClick={capturePhoto}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex-1"
        >
          Capture
        </button>
        <button
          onClick={() => {
            stopCamera();
            setShowFallback(true);
          }}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}