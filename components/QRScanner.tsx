"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

interface QRScannerProps {
  onScan: (data: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    let isMounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 300 },
            height: { ideal: 300 },
          },
        });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          setError(
            "Camera access denied. Please allow camera permissions or use manual input."
          );
        }
      }
    };
    startCamera();
    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      onScan(manualInput.trim());
    }
  };

  const captureAndAnalyze = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data) {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          onScan(code.data);
        } else {
          alert("No QR code detected. Try again or use manual input.");
        }
      } else {
        alert("Unable to capture frame. Please use manual input.");
      }
    } else {
      alert("Camera not ready. Please use manual input.");
    }
  };

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-4">{error}</div>
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Enter Bus ID (e.g., SNU_BUS001)"
            className="w-full px-3 py-2 border rounded-lg text-center"
            required
          />
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
          >
            Submit Bus ID
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-64 object-cover rounded-lg"
        />
        <div className="absolute inset-0 border-2 border-green-500 rounded-lg pointer-events-none">
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-green-500"></div>
          <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-green-500"></div>
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-green-500"></div>
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-green-500"></div>
        </div>
      </div>
      <button
        onClick={captureAndAnalyze}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
      >
        Capture QR Code
      </button>
      <div className="w-full">
        <p className="text-sm text-gray-600 text-center mb-2">
          Or enter Bus ID manually:
        </p>
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Enter Bus ID (e.g., SNU_BUS001)"
            className="w-full px-3 py-2 border rounded-lg text-center text-sm"
          />
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm"
          >
            Submit Bus ID
          </button>
        </form>
      </div>
    </div>
  );
}
