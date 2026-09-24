import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';

import { API_BASE, WS_BASE } from '../config';

const ScreenCaptureContext = createContext();
const MONITORING_SESSION_ID = 'screen-monitor-session';

export function ScreenCaptureProvider({ children }) {
  const [capturing, setCapturing] = useState(false);
  const [fps, setFps] = useState(10);
  const [stats, setStats] = useState({ framesSent: 0, alertsDetected: 0 });
  const [captureMode, setCaptureMode] = useState('camera'); // 'camera', 'mobile', or 'screen'
  const [monitorName, setMonitorName] = useState('CCTV Monitor');
  const [mobileFeedUrl, setMobileFeedUrl] = useState('');
  const toast = useToast();
  
  const streamIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const processingCanvasRef = useRef(null);
  const streamWsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isProcessingFrameRef = useRef(false);
  const prevBBoxesRef = useRef([]);

  // Helper to connect WebSocket with heartbeat and auto-reconnect
  const connectWebSocket = () => {
    const wsUrl = `${WS_BASE}/api/streams/mobile/${MONITORING_SESSION_ID}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Binary Stream WebSocket connected successfully");
      isProcessingFrameRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 5000);
    };

    ws.onmessage = (event) => {
      isProcessingFrameRef.current = false; // Release lock as soon as response arrives

      try {
        const resData = JSON.parse(event.data);
        if (resData.type === 'pong') return; // Ignore ping responses

        const bboxes = resData.bboxes || [];
        const raisedDuration = resData.raised_duration || 0.0;

        // Render high-precision smooth tracking box on overlay canvas
        if (canvasRef.current && videoRef.current) {
          const overlayCanvas = canvasRef.current;
          overlayCanvas.width = videoRef.current.videoWidth || 640;
          overlayCanvas.height = videoRef.current.videoHeight || 360;
          const overlayCtx = overlayCanvas.getContext('2d');
          
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          if (bboxes.length > 0 && raisedDuration < 10.0) {
            // Apply Exponential Moving Average (EMA) smoothing to remove coordinate jitter
            const smoothedBoxes = bboxes.map((box, idx) => {
              const prev = prevBBoxesRef.current[idx];
              if (!prev) return box;
              const alpha = 0.70; // High responsiveness + ultra-smooth trajectory
              return {
                xmin: prev.xmin * (1 - alpha) + box.xmin * alpha,
                ymin: prev.ymin * (1 - alpha) + box.ymin * alpha,
                xmax: prev.xmax * (1 - alpha) + box.xmax * alpha,
                ymax: prev.ymax * (1 - alpha) + box.ymax * alpha
              };
            });
            prevBBoxesRef.current = smoothedBoxes;

            smoothedBoxes.forEach(box => {
              const x = box.xmin * overlayCanvas.width;
              const y = box.ymin * overlayCanvas.height;
              const w = (box.xmax - box.xmin) * overlayCanvas.width;
              const h = (box.ymax - box.ymin) * overlayCanvas.height;
              const radius = 12;

              // Glowing high-contrast green tracking box with live timer badge
              const mainColor = '#00FF66';
              const fillColor = 'rgba(0, 255, 102, 0.08)';

              overlayCtx.save();
              overlayCtx.strokeStyle = mainColor;
              overlayCtx.lineWidth = 4;
              overlayCtx.shadowColor = mainColor;
              overlayCtx.shadowBlur = 12;
              
              overlayCtx.beginPath();
              overlayCtx.roundRect(x, y, w, h, radius);
              overlayCtx.stroke();

              // Semi-transparent fill inside tracking box
              overlayCtx.fillStyle = fillColor;
              overlayCtx.fill();

              // Draw Timer Badge (displays continuous timer up to 10s cutoff)
              overlayCtx.fillStyle = mainColor;
              overlayCtx.shadowBlur = 6;
              const labelText = `⏱️ ${raisedDuration.toFixed(1)}s`;
              overlayCtx.font = 'bold 13px Inter, system-ui, sans-serif';
              const textWidth = overlayCtx.measureText(labelText).width;
              const badgeY = Math.max(22, y - 10);
              
              overlayCtx.beginPath();
              overlayCtx.roundRect(x, badgeY - 18, textWidth + 16, 22, 6);
              overlayCtx.fill();

              overlayCtx.fillStyle = '#000000';
              overlayCtx.fillText(labelText, x + 8, badgeY - 3);
              overlayCtx.restore();
            });
          } else {
            prevBBoxesRef.current = [];
          }
        }

        setStats(prev => ({
          framesSent: prev.framesSent + 1,
          alertsDetected: prev.alertsDetected + (resData.alerts_detected || 0)
        }));
      } catch (e) {
        // Silently skip malformed messages
      }
    };

    ws.onclose = () => {
      isProcessingFrameRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (streamWsRef.current === ws) {
        setTimeout(() => {
          connectWebSocket();
        }, 1000);
      }
    };

    ws.onerror = () => {
      isProcessingFrameRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    streamWsRef.current = ws;
    return ws;
  };

  // Initialize hidden video and offscreen canvas for processing
  useEffect(() => {
    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
    }
    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  const startCapture = async () => {
    try {
      if (captureMode === 'mobile') {
        // Mobile camera mode: subscribe to MJPEG stream feed & binary WebSocket
        setMobileFeedUrl(`${API_BASE}/api/streams/mobile/${MONITORING_SESSION_ID}/mjpeg?t=${Date.now()}`);
        connectWebSocket();
        setCapturing(true);
        setStats({ framesSent: 0, alertsDetected: 0 });
        toast.success("Mobile Camera Monitor initialized. Stream from mobile device or phone browser!");
        return;
      }

      if (captureMode === 'camera') {
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      } else if (captureMode === 'screen') {
        const displayMediaOptions = {
          video: {
            cursor: 'never',
            displaySurface: 'monitor',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        mediaStreamRef.current = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        await new Promise(resolve => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      }

      // Initialize ultra-fast binary WebSocket stream connection with heartbeat ping
      connectWebSocket();

      setCapturing(true);
      setStats({ framesSent: 0, alertsDetected: 0 });

      // Trigger frame extraction check at 30 FPS interval, but lock guard ensures no buffering
      streamIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 33);

      if (mediaStreamRef.current && mediaStreamRef.current.getVideoTracks()[0]) {
        mediaStreamRef.current.getVideoTracks()[0].addEventListener('ended', () => {
          stopCapture();
        });
      }

    } catch (error) {
      console.error('Error starting video capture:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Capture permission denied. Please allow access to video/camera.');
      } else {
        toast.error('Failed to start capture: ' + error.message);
      }
    }
  };

  const stopCapture = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (streamWsRef.current) {
      streamWsRef.current.close();
      streamWsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    isProcessingFrameRef.current = false;
    prevBBoxesRef.current = [];
    setMobileFeedUrl('');
    setCapturing(false);
  };

  const captureAndSendFrame = () => {
    if (captureMode === 'mobile') return; // Mobile device sends its own frames
    if (!videoRef.current || !mediaStreamRef.current) return;
    if (isProcessingFrameRef.current) return; // IN-FLIGHT LOCK: Skip if backend is still processing previous frame

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
    const procCanvas = processingCanvasRef.current;
    procCanvas.width = 480;
    procCanvas.height = 270;
    const procCtx = procCanvas.getContext('2d');
    procCtx.drawImage(video, 0, 0, procCanvas.width, procCanvas.height);

    isProcessingFrameRef.current = true; // Lock before sending

    // Send compressed raw binary Blob over WebSocket
    procCanvas.toBlob((blob) => {
      if (streamWsRef.current && streamWsRef.current.readyState === WebSocket.OPEN && blob) {
        streamWsRef.current.send(blob);
      } else {
        isProcessingFrameRef.current = false;
      }
    }, 'image/jpeg', 0.5);
  };

  const value = {
    capturing,
    startCapture,
    stopCapture,
    fps,
    setFps,
    stats,
    captureMode,
    setCaptureMode,
    monitorName,
    setMonitorName,
    mobileFeedUrl,
    mediaStream: mediaStreamRef.current,
    canvasRef,
    videoRef
  };

  return (
    <ScreenCaptureContext.Provider value={value}>
      {children}
    </ScreenCaptureContext.Provider>
  );
}

export const useScreenCapture = () => useContext(ScreenCaptureContext);
