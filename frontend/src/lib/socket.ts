import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('Connected to server with socket ID:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error: string) => {
      console.error('Socket error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomCode: string) {
    if (this.socket && this.socket.connected) {
      console.log('Joining room:', roomCode);
      this.socket.emit('join-room', roomCode);
    } else {
      console.error('Socket not connected, cannot join room');
    }
  }

  sendDrawingUpdate(data: any) {
    if (this.socket && this.socket.connected) {
      console.log('Sending drawing update via socket:', data);
      this.socket.emit('drawing-update', data);
    } else {
      console.error('Socket not connected, cannot send drawing update');
    }
  }

  sendChatMessage(message: { text: string }) {
    if (this.socket && this.socket.connected) {
      console.log('Sending chat message:', message);
      this.socket.emit('chat-message', message);
    } else {
      console.error('Socket not connected, cannot send chat message');
    }
  }

  toggleVoice(isEnabled: boolean) {
    if (this.socket) {
      this.socket.emit('voice-toggle', { isEnabled });
    }
  }

  onUserJoined(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user-joined', callback);
    }
  }

  onUserLeft(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user-left', callback);
    }
  }

  onDrawingUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('drawing-update', callback);
    }
  }

  onChatMessage(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('chat-message', callback);
    }
  }

  onVoiceToggle(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('voice-toggle', callback);
    }
  }

  // WebRTC Voice Chat Methods
  sendWebRTCOffer(offer: RTCSessionDescriptionInit) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc-offer', { offer });
    }
  }

  sendWebRTCAnswer(answer: RTCSessionDescriptionInit) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc-answer', { answer });
    }
  }

  sendWebRTCIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc-ice-candidate', { candidate });
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketClient = new SocketClient();