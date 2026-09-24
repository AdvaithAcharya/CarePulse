import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LiquidMetalButton } from './ui/LiquidMetal';

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE = `http://${host}:8000`;
const WS_BASE = `ws://${host}:8000`;

export function MobileCamera() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(10);
  const [stats, setStats] = useState({ framesSent: 0, alertsDetected: 0 });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const streamWsRef = useRef(null);

  useEffect(() => {
    fetchMobileRooms();
    return () => {
      stopStreaming();
    };
  }, []);

  const fetchMobileRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/rooms`);
      const dbRooms = response.data || [];
      const mobileRooms = dbRooms.filter(r => r.camera_url === 'mobile');
      
      const allOptions = [
        { id: 'screen-monitor-session', room_number: 'Screen Monitor (Default CCTV)', floor: 'Live' },
        ...mobileRooms
      ];
      setRooms(allOptions);
      setSelectedRoom('screen-monitor-session');
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([{ id: 'screen-monitor-session', room_number: 'Screen Monitor (Default CCTV)', floor: 'Live' }]);
      setSelectedRoom('screen-monitor-session');
    }
  };

  const startStreaming = async () => {
    const targetRoom = selectedRoom || 'screen-monitor-session';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Mobile Browser Security Lock: Camera access is restricted on HTTP IP addresses.\n\n" +
                  "Quick 10-second fix on Android Chrome:\n" +
                  "1. Open new tab: chrome://flags/#unsafely-treat-insecure-origin-as-secure\n" +
                  "2. Enable flag and add: http://" + host + ":5173\n" +
                  "3. Tap Relaunch and try again!";
      alert(msg);
      return;
    }

    try {
      // Request mobile camera access with multi-level fallback
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      mediaStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      await new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          resolve();
        };
      });

      // Connect binary WebSocket to backend at host IP
      const wsUrl = `${WS_BASE}/api/streams/mobile/${targetRoom}/ws`;
      const ws = new WebSocket(wsUrl);
      streamWsRef.current = ws;

      ws.onopen = () => {
        console.log("Mobile camera binary stream WebSocket connected to " + wsUrl);
      };

      setStreaming(true);
      setStats({ framesSent: 0, alertsDetected: 0 });

      // Start sending binary Blob frames over WebSocket
      const interval = 1000 / fps;
      streamIntervalRef.current = setInterval(() => {
        captureAndSendBinaryFrame();
      }, interval);

    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Camera Permission Denied! Please tap the lock icon in your browser address bar and allow Camera access.');
      } else {
        alert('Failed to access mobile camera (' + error.name + '): ' + error.message);
      }
    }
  };

  const stopStreaming = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
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
    setStreaming(false);
  };

  const captureAndSendBinaryFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = 480;
    canvas.height = 270;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (streamWsRef.current && streamWsRef.current.readyState === WebSocket.OPEN && blob) {
        streamWsRef.current.send(blob);
        setStats(prev => ({ ...prev, framesSent: prev.framesSent + 1 }));
      }
    }, 'image/jpeg', 0.5);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Mobile Camera Streaming</h2>
        <p className="text-gray-600">
          Use your device's camera to stream video to the monitoring system
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Target Stream Room</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              disabled={streaming}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.room_number} {room.floor ? `(${room.floor})` : ''}
                </option>
              ))}
            </select>
          </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Frame Rate: {fps} FPS
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  disabled={streaming}
                  className="w-full disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher FPS = Better detection but more data usage
                </p>
              </div>

              <div className="flex space-x-3">
                <LiquidMetalButton
                  onClick={streaming ? stopStreaming : startStreaming}
                  borderWidth={4}
                  size="md"
                  innerClassName={streaming ? "bg-red-950 text-red-200" : "bg-neutral-950 text-white"}
                >
                  {streaming ? "Stop Streaming" : "Start Streaming"}
                </LiquidMetalButton>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
              <h3 className="font-semibold">Camera Preview</h3>
              {streaming && (
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                  <span className="text-sm">STREAMING</span>
                </span>
              )}
            </div>
            <div className="relative bg-gray-900" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted
              />
              {!streaming && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p>Camera not active</p>
                    <p className="text-sm mt-1">Click "Start Streaming" above</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {streaming && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">Frames Sent</div>
                <div className="text-2xl font-bold text-blue-900">{stats.framesSent}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">Alerts Detected</div>
                <div className="text-2xl font-bold text-red-900">{stats.alertsDetected}</div>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default MobileCamera;
