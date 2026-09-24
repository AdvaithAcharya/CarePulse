import { useState, useEffect } from 'react';
import axios from 'axios';

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE = `http://${host}:8000`;

export function VideoGrid() {
  const [rooms, setRooms] = useState([]);
  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
    fetchActiveStreams();
    const interval = setInterval(fetchActiveStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/rooms`);
      setRooms(response.data || []);
      setLoading(false);
    } catch {
      // Default to empty array gracefully without error spam
      setRooms([]);
      setLoading(false);
    }
  };

  const fetchActiveStreams = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/streams`);
      setActiveStreams(response.data.streams.map(s => s.room_id));
    } catch (error) {
      console.error('Error fetching active streams:', error);
    }
  };

  const startStream = async (room) => {
    try {
      await axios.post(`${API_BASE}/api/streams/start`, {
        room_id: room.id,
        camera_url: room.camera_url,
        enable_gesture_detection: true,
        enable_fall_detection: true,
        enable_voice_detection: false,
        enable_privacy_filter: room.privacy_enabled
      });
      fetchActiveStreams();
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Failed to start stream: ' + (error.response?.data?.detail || error.message));
    }
  };

  const stopStream = async (roomId) => {
    try {
      await axios.post(`${API_BASE}/api/streams/stop/${roomId}`);
      fetchActiveStreams();
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  const isStreamActive = (roomId) => activeStreams.includes(roomId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading rooms...</div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Video Feeds</h2>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Ward monitor CCTV feed is active via Screen Capture.</p>
          <a href="/screen-capture" className="text-blue-600 hover:underline font-semibold">
            Open Ward CCTV Monitor →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Video Feeds</h2>
        <div className="text-sm text-gray-600">
          Active Streams: {activeStreams.length} / {rooms.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {rooms.map((room) => {
          const streamActive = isStreamActive(room.id);
          
          return (
            <div key={room.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Room {room.room_number}</h3>
                  {room.floor && <p className="text-xs text-gray-300">Floor {room.floor}</p>}
                </div>
                <div className="flex items-center space-x-2">
                  {room.privacy_enabled && (
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                      Privacy On
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${
                    streamActive ? 'bg-green-600' : 'bg-gray-600'
                  }`}>
                    {streamActive ? 'LIVE' : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="relative bg-gray-900" style={{ aspectRatio: '16/9' }}>
                {streamActive ? (
                  <img
                    src={`${API_BASE}/api/streams/${room.id}/stream`}
                    alt={`Room ${room.room_number}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback if stream fails
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">Camera Offline</p>
                    </div>
                  </div>
                )}
                <div className="hidden absolute inset-0 items-center justify-center text-red-400 bg-gray-900">
                  <div className="text-center">
                    <p className="text-sm">Stream Error</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <p className="font-medium">{room.camera_url === 'mobile' ? 'Mobile Camera' : 'CCTV Camera'}</p>
                  {!room.camera_enabled && (
                    <p className="text-red-600 text-xs">Camera Disabled</p>
                  )}
                </div>
                <div className="space-x-2">
                  {streamActive ? (
                    <button
                      onClick={() => stopStream(room.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => startStream(room)}
                      disabled={!room.camera_enabled}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VideoGrid;
