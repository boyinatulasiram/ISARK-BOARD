import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { socketClient } from '../lib/socket';

interface VoiceChatProps {
  roomId: string;
  userId: string;
  username: string;
}

interface PeerConnection {
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

export const VoiceChat = ({ roomId, userId, username }: VoiceChatProps) => {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContainerRef = useRef<HTMLDivElement>(null);

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    // Listen for WebRTC signaling events
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('voice-ready', handleVoiceReady);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('voice-ready', handleVoiceReady);
      cleanup();
    };
  }, [roomId]);

  // Handle incoming WebRTC offer
  const handleOffer = async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
    if (data.userId === userId) return;
    
    console.log('📞 Received offer from:', data.userId);

    try {
      const peerConnection = createPeerConnection(data.userId);
      await peerConnection.setRemoteDescription(data.offer);

      // Add local stream if mic is enabled
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log('🎤 Adding local track to peer connection');
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log('📤 Sending answer to:', data.userId);
      socketClient.sendWebRTCAnswer(answer);
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  };

  // Handle incoming WebRTC answer
  const handleAnswer = async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
    if (data.userId === userId) return;
    
    console.log('📞 Received answer from:', data.userId);

    try {
      const peer = peersRef.current.get(data.userId);
      if (peer) {
        await peer.connection.setRemoteDescription(data.answer);
        console.log('✅ Answer processed successfully');
      } else {
        console.log('⚠️ No peer found for user:', data.userId);
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  // Handle incoming ICE candidate
  const handleIceCandidate = async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
    if (data.userId === userId) return;

    try {
      const peer = peersRef.current.get(data.userId);
      if (peer) {
        await peer.connection.addIceCandidate(data.candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Handle user joining the room
  const handleUserJoined = async (data: { userId: string; username: string }) => {
    if (data.userId === userId) return;
    
    console.log('👥 User joined:', data.username, '- Mic enabled:', isMicEnabled);

    // Create offer for new user if we have mic enabled
    if (isMicEnabled && localStreamRef.current) {
      console.log('📤 Creating offer for new user:', data.username);
      await createOfferForUser(data.userId);
    }
  };

  // Handle user leaving the room
  const handleUserLeft = (data: { userId: string }) => {
    console.log('👥 User left:', data.userId);
    const peer = peersRef.current.get(data.userId);
    if (peer) {
      peer.connection.close();
      if (peer.audioElement) {
        peer.audioElement.remove();
      }
      peersRef.current.delete(data.userId);
      setConnectedUsers(prev => prev.filter(id => id !== data.userId));
    }
  };

  // Handle when another user is ready for voice chat
  const handleVoiceReady = async (data: { userId: string; username: string }) => {
    if (data.userId === userId) return;
    
    console.log('🎙️ User ready for voice:', data.username);
    
    // If we have our mic enabled, create an offer
    if (isMicEnabled && localStreamRef.current) {
      console.log('📤 Creating offer for voice-ready user:', data.username);
      await createOfferForUser(data.userId);
    } else {
      console.log('⚠️ Cannot create offer - mic not enabled or no stream');
    }
  };

  // Manual test function to create offer
  const testCreateOffer = async () => {
    console.log('🧪 Testing offer creation...');
    if (!isMicEnabled || !localStreamRef.current) {
      console.log('❌ Enable microphone first!');
      return;
    }
    
    // Create a test offer for any connected user
    const connectedUserIds = Array.from(peersRef.current.keys());
    if (connectedUserIds.length === 0) {
      console.log('📡 No connected users, broadcasting test offer to room');
      // Create offer for any user in the room
      await createOfferForUser('test-user-id');
    } else {
      console.log('📤 Creating test offer for existing user:', connectedUserIds[0]);
      await createOfferForUser(connectedUserIds[0]);
    }
  };

  // Create peer connection for a user
  const createPeerConnection = (remoteUserId: string): RTCPeerConnection => {
    console.log('🔗 Creating peer connection for:', remoteUserId);
    const peerConnection = new RTCPeerConnection(rtcConfig);

    // Handle incoming audio stream
    peerConnection.ontrack = (event) => {
      console.log('🎧 Received audio track from:', remoteUserId);
      console.log('Stream tracks:', event.streams[0].getTracks());
      
      const audioElement = document.createElement('audio');
      audioElement.srcObject = event.streams[0];
      audioElement.autoplay = true;
      audioElement.volume = 1.0;
      audioElement.style.display = 'none';
      
      // Ensure audio plays
      audioElement.play().catch(e => {
        console.log('🔊 Auto-play prevented, user interaction needed');
        // Try to play on next user interaction
        document.addEventListener('click', () => {
          audioElement.play().catch(console.error);
        }, { once: true });
      });
      
      if (audioContainerRef.current) {
        audioContainerRef.current.appendChild(audioElement);
      }

      // Update peer connection with audio element
      const existingPeer = peersRef.current.get(remoteUserId);
      if (existingPeer) {
        existingPeer.audioElement = audioElement;
      } else {
        peersRef.current.set(remoteUserId, {
          connection: peerConnection,
          audioElement
        });
      }
      
      setConnectedUsers(prev => [...prev.filter(id => id !== remoteUserId), remoteUserId]);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${remoteUserId}:`, peerConnection.connectionState);
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${remoteUserId}:`, peerConnection.iceConnectionState);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', remoteUserId);
        socketClient.sendWebRTCIceCandidate(event.candidate);
      }
    };

    // Store peer connection
    peersRef.current.set(remoteUserId, {
      connection: peerConnection
    });

    return peerConnection;
  };

  // Create offer for a specific user
  const createOfferForUser = async (remoteUserId: string) => {
    try {
      console.log('🔗 Creating peer connection and offer for:', remoteUserId);
      
      const peerConnection = createPeerConnection(remoteUserId);

      // Add local stream
      if (localStreamRef.current) {
        console.log('🎤 Adding local tracks to peer connection');
        localStreamRef.current.getTracks().forEach(track => {
          console.log('Adding track:', track.kind, track.enabled);
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      } else {
        console.log('❌ No local stream available');
        return;
      }

      // Create and send offer
      console.log('📤 Creating offer...');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      console.log('💾 Setting local description...');
      await peerConnection.setLocalDescription(offer);

      console.log('📡 Sending offer via socket...');
      socketClient.sendWebRTCOffer(offer);
      
      console.log('✅ Offer sent successfully');
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  // Toggle microphone
  const toggleMicrophone = async () => {
    setIsConnecting(true);

    try {
      if (!isMicEnabled) {
        console.log('🎤 Enabling microphone...');
        
        // Enable microphone
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        console.log('✅ Microphone access granted');
        console.log('Audio tracks:', stream.getAudioTracks());
        
        localStreamRef.current = stream;
        setIsMicEnabled(true);

        // Create offers for all users in the room
        // We'll broadcast to everyone and let them decide if they want to connect
        console.log('📡 Broadcasting audio availability...');
        
        // Create offers for all users currently in the room
        setTimeout(async () => {
          console.log('📡 Creating offers for existing users in room');
          // Emit a signal that we're ready to connect
          const socket = socketClient.getSocket();
          if (socket) {
            socket.emit('voice-ready', { userId, username });
          }
        }, 100);
        
      } else {
        console.log('🔇 Disabling microphone...');
        
        // Disable microphone
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
          localStreamRef.current = null;
        }

        // Close all peer connections
        peersRef.current.forEach(peer => {
          peer.connection.close();
          if (peer.audioElement) {
            peer.audioElement.remove();
          }
        });
        peersRef.current.clear();
        setConnectedUsers([]);

        setIsMicEnabled(false);
      }
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
      alert('Failed to access microphone. Please check permissions and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    peersRef.current.forEach(peer => {
      peer.connection.close();
      peer.audioElement.remove();
    });
    peersRef.current.clear();
  };

  return (
    <div className="voice-chat">
      {/* Hidden audio container for remote streams */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
      
      {/* Microphone toggle button */}
      <button
        onClick={toggleMicrophone}
        disabled={isConnecting}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
          isMicEnabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isMicEnabled ? 'Disable Microphone' : 'Enable Microphone'}
      >
        {isConnecting ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isMicEnabled ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        🎙️ {isMicEnabled ? 'Mic On' : 'Mic Off'}
      </button>
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-1">
          <div>Connected: {connectedUsers.length} users</div>
          <button 
            onClick={testCreateOffer}
            className="mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded"
          >
            Test Offer
          </button>
        </div>
      )}
    </div>
  );
};