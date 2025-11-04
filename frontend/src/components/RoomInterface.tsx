import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Zap, LogOut, Moon, Sun, Users, Copy, Check, ArrowLeft, MessageCircle, X, Send, Download, FileImage, FileText } from 'lucide-react';
import { apiClient, Room, User } from '../lib/api';
import { socketClient } from '../lib/socket';
import { Whiteboard } from './Whiteboard';
import { VoiceChat } from './VoiceChat';

type RoomInterfaceProps = {
  roomId: string;
  onLeave: () => void;
};

export const RoomInterface = ({ roomId, onLeave }: RoomInterfaceProps) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRoomData();
    loadMessages();
    
    // Ensure socket is connected and join the room
    const socket = socketClient.getSocket();
    if (socket && socket.connected) {
      console.log('Socket already connected, joining room:', roomId);
      socketClient.joinRoom(roomId);
    } else {
      console.log('Socket not connected, waiting for connection...');
      // Wait for socket connection then join room
      const checkConnection = setInterval(() => {
        const currentSocket = socketClient.getSocket();
        if (currentSocket && currentSocket.connected) {
          console.log('Socket connected, joining room:', roomId);
          socketClient.joinRoom(roomId);
          clearInterval(checkConnection);
        }
      }, 100);
      
      // Clear interval after 5 seconds to prevent infinite checking
      setTimeout(() => clearInterval(checkConnection), 5000);
    }
    
    // Close export menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [roomId, showExportMenu]);

  // Separate useEffect for socket listeners to prevent duplicate listeners
  useEffect(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleUserJoined = (data: any) => {
      console.log('User joined:', data);
      loadRoomData();
    };
    
    const handleUserLeft = (data: any) => {
      console.log('User left:', data);
      loadRoomData();
    };
    
    const handleChatMessage = (message: any) => {
      console.log('💬 Received chat message:', message);
      setMessages(prev => {
        // Prevent duplicate messages by checking if message already exists
        const exists = prev.some(msg => msg._id === message._id);
        if (exists) {
          console.log('⚠️ Duplicate message detected, ignoring');
          return prev;
        }
        console.log('✅ Adding new message to state');
        return [...prev, message];
      });
    };

    // Set up socket listeners
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('chat-message', handleChatMessage);
    
    // Cleanup listeners on unmount or roomId change
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('chat-message', handleChatMessage);
    };
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRoomData = async () => {
    try {
      const response = await apiClient.getUserRooms();
      if (response.success) {
        const foundRoom = response.data.find(r => r.roomId === roomId);
        if (foundRoom) {
          setRoom(foundRoom);
          setParticipants(foundRoom.participants || []);
        }
      }
    } catch (error) {
      console.error('Error loading room:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await apiClient.getRoomMessages(roomId);
      if (response.success) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleCopyCode = () => {
    if (room?.roomId) {
      navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeaveRoom = async () => {
    onLeave();
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    
    try {
      // Find the main drawing canvas (not overlay canvases)
      const canvases = document.querySelectorAll('canvas');
      let mainCanvas = null;
      
      // Look for the canvas with actual content
      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Check if canvas has non-transparent pixels
          let hasContent = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) { // Alpha channel > 0
              hasContent = true;
              break;
            }
          }
          
          if (hasContent) {
            mainCanvas = canvas;
            break;
          }
        }
      }
      
      if (!mainCanvas && canvases.length > 0) {
        // Fallback to the largest canvas
        mainCanvas = Array.from(canvases).reduce((largest, canvas) => 
          (canvas.width * canvas.height) > (largest.width * largest.height) ? canvas : largest
        );
      }
      
      if (!mainCanvas) {
        setAiSummary('Error: No whiteboard canvas found');
        return;
      }

      console.log('Using canvas:', mainCanvas.width, 'x', mainCanvas.height);

      // Create a new canvas with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = mainCanvas.width;
      tempCanvas.height = mainCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // Fill with white background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the original canvas content on top
        tempCtx.drawImage(mainCanvas, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        tempCanvas.toBlob(resolve, 'image/png', 1.0);
      });

      if (!blob) {
        setAiSummary('Error: Failed to capture whiteboard image');
        return;
      }

      console.log('Blob size:', blob.size);

      const formData = new FormData();
      formData.append('file', blob, 'whiteboard.png');
      formData.append('image', blob, 'whiteboard.png');
      
      const response = await fetch('http://127.0.0.1:5000/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': import.meta.env.VITE_AI_API_TOKEN
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      setAiSummary(result.response || result.text || result.summary || 'No summary generated');
      
    } catch (error) {
      console.error('Error:', error);
      setAiSummary(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLeaveRoom}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <Zap className="w-8 h-8 text-blue-600 dark:text-cyan-400" />
              <div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {room?.name || 'Loading...'}
                </span>
                {room?.roomId && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {room.roomId}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors duration-200"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Export Dropdown - Miro Style */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-white"
                  title="Export"
                >
                  <Download className="w-5 h-5" />
                </button>
                
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          // Call export function from whiteboard
                          const canvas = document.querySelector('canvas') as HTMLCanvasElement;
                          if (canvas) {
                            const link = document.createElement('a');
                            link.download = `whiteboard-${roomId}-${new Date().toISOString().split('T')[0]}.png`;
                            link.href = canvas.toDataURL();
                            link.click();
                          }
                          setShowExportMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <FileImage className="w-4 h-4" />
                        Export as PNG
                      </button>
                      <button
                        onClick={async () => {
                          // Call PDF export function
                          const canvas = document.querySelector('canvas') as HTMLCanvasElement;
                          if (canvas) {
                            const { jsPDF } = await import('jspdf');
                            const imgData = canvas.toDataURL('image/png');
                            const pdf = new jsPDF({
                              orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                              unit: 'px',
                              format: [canvas.width, canvas.height]
                            });
                            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                            pdf.save(`whiteboard-${roomId}-${new Date().toISOString().split('T')[0]}.pdf`);
                          }
                          setShowExportMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-4 h-4" />
                        Export as PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Participants Avatars - Miro Style */}
              <div className="flex items-center -space-x-2">
                {participants.slice(0, 3).map((participant, index) => (
                  <div
                    key={participant._id}
                    className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 text-white text-xs font-medium"
                    title={participant.username}
                    style={{ zIndex: 10 - index }}
                  >
                    {participant.username.charAt(0).toUpperCase()}
                  </div>
                ))}
                {participants.length > 3 && (
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 text-white text-xs font-medium">
                    +{participants.length - 3}
                  </div>
                )}
              </div>
              

              <VoiceChat 
                roomId={roomId} 
                userId={user?._id || ''} 
                username={user?.username || ''} 
              />
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  showChat 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                title="Toggle Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                ) : (
                  <Sun className="w-5 h-5 text-gray-300" />
                )}
              </button>
              <button
                onClick={signOut}
                className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex relative">
        <main className="flex-1 flex relative">
          <Whiteboard roomId={roomId} />
          
          {/* AI Summary Button - Bottom Right */}
          <button
            onClick={generateAISummary}
            disabled={isGeneratingSummary}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 z-40 text-lg font-semibold"
          >
            {isGeneratingSummary ? 'Generating...' : 'AI Summary'}
          </button>
          
          {/* AI Summary Loading Overlay */}
          {isGeneratingSummary && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
                <div className="w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-700 font-medium">Generating AI Summary...</span>
              </div>
            </div>
          )}
        </main>
        
        {/* AI Summary Panel */}
        {aiSummary && (
          <aside className="w-80 bg-gradient-to-b from-purple-50 to-white border-l border-purple-200 flex flex-col shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-purple-200">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-purple-600 rounded"></div>
                <h3 className="font-semibold text-gray-800">AI Summary</h3>
              </div>
              <button
                onClick={() => setAiSummary('')}
                className="p-1 hover:bg-purple-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {aiSummary}
              </div>
            </div>
          </aside>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <aside className={`w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg ${aiSummary ? 'border-l-0' : ''}`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div key={message._id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {message.sender.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                    {message.message}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      const messageText = newMessage.trim();
                      socketClient.sendChatMessage({ text: messageText });
                      setNewMessage('');
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
                <button 
                  onClick={() => {
                    const messageText = newMessage.trim();
                    if (messageText) {
                      socketClient.sendChatMessage({ text: messageText });
                      setNewMessage('');
                    }
                  }}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
