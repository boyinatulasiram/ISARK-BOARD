# Voice Chat Setup Instructions

## 🎙️ WebRTC Voice Chat System

Your collaboration board now includes real-time voice chat functionality using WebRTC and Socket.io.

## Features Added

- **🎙️ Toggle Mic Button**: Enable/disable microphone during sessions
- **Real-time Audio**: Hear other participants instantly (like Google Meet/Discord)
- **Automatic Connection**: Users joining the same board session are automatically connected
- **Dark Theme UI**: Matches your existing board design
- **Multiple Participants**: Supports multiple users in the same session

## How to Test Locally

### 1. Start Backend Server
```bash
cd backend
npm run dev
```
The server should start on `http://localhost:3000`

### 2. Start Frontend Server
```bash
cd frontend
npm run dev
```
The frontend should start on `http://localhost:5173`

### 3. Test Voice Chat

1. **Open two browser windows/tabs** (or use different browsers)
2. **Login with different accounts** in each window
3. **Join the same room** in both windows
4. **Click "🎙️ Toggle Mic"** in one window
5. **Grant microphone permission** when prompted
6. **Speak into the microphone** - the other user should hear you!

### 4. Testing Tips

- **Use headphones** to prevent audio feedback
- **Test on different devices** for best results
- **Check browser console** for any WebRTC errors
- **Ensure microphone permissions** are granted

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari (latest)
- ✅ Edge

## Troubleshooting

### No Audio Heard
1. Check microphone permissions in browser settings
2. Ensure both users are in the same room
3. Check browser console for WebRTC errors
4. Try refreshing both browser windows

### Microphone Not Working
1. Grant microphone permission when prompted
2. Check system microphone settings
3. Try a different browser
4. Ensure microphone is not used by another app

### Connection Issues
1. Check if backend server is running
2. Verify Socket.io connection in browser console
3. Ensure both users are authenticated and in the same room

## Code Structure

### Frontend Components
- `VoiceChat.tsx` - Main voice chat component with WebRTC logic
- `RoomInterface.tsx` - Updated to include voice chat
- `socket.ts` - Updated with WebRTC signaling methods

### Backend
- `socketHandlers.js` - Already includes WebRTC signaling support
- WebRTC events: `webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`

## Security Notes

- Audio streams are peer-to-peer (not stored on server)
- Uses STUN servers for NAT traversal
- Requires HTTPS in production for microphone access
- All WebRTC connections are encrypted

## Production Deployment

For production deployment:

1. **Use HTTPS** - Required for microphone access
2. **Add TURN servers** - For users behind strict firewalls
3. **Implement user limits** - Limit participants per room
4. **Add audio quality controls** - Bitrate, echo cancellation settings

## Next Steps

The voice chat system is now fully integrated! Users can:
- Toggle their microphone on/off
- Hear other participants in real-time
- Automatically connect when joining the same room
- Use the system alongside drawing and chat features

Enjoy your new collaborative voice-enabled whiteboard! 🎉