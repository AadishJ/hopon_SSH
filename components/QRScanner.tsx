"use client";
import { useEffect, useRef, useState } from "react";

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
            facingMode: "environment", // Use back camera
            width: { ideal: 300 },
            height: { ideal: 300 },
          },
        });

        if (!isMounted) {
          // Component unmounted, stop the stream
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (isMounted) {
          setError(
            "Camera access denied. Please allow camera permissions or use manual input."
          );
        }
      }
    };

    startCamera();

    // Cleanup function
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
      // Stop camera before calling onScan
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      onScan(manualInput.trim());
    }
  };

  const captureAndAnalyze = () => {
    // For demo purposes, prompt user to use manual input
    alert("QR scanning captured! Please use manual input below for demo.");
  };

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-4">{error}</div>

        {/* Manual input form */}
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

        {/* Scanning overlay */}
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

      {/* Manual input */}
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
