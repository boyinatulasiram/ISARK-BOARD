# XLR8 - Collaborative Whiteboard Application

A real-time collaborative whiteboard application built with React (frontend) and Node.js (backend).

## Features

- **Real-time Collaboration**: Multiple users can work on the same whiteboard simultaneously
- **User Authentication**: Secure signup/login system
- **Room Management**: Create and join rooms with unique codes
- **Real-time Chat**: Built-in chat functionality for each room
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Socket.io-client for real-time communication
- Lucide React for icons

### Backend
- Node.js with Express
- MongoDB with Mongoose
- Socket.io for real-time features
- JWT for authentication
- bcrypt for password hashing

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/xlr8
   ACCESS_TOKEN_SECRET=your_access_token_secret_here
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
   REFRESH_TOKEN_EXPIRY=10d
   CORS_ORIGIN=http://localhost:5173
   NODE_ENV=development
   ```

4. Start the backend server:
   ```bash
   npm start
   ```

The backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The `.env` file is already configured for local development:
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api/v1
   VITE_SOCKET_URL=http://localhost:3000
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

## Usage

1. **Sign Up/Login**: Create an account or login with existing credentials
2. **Create Room**: Click "Create Room" to start a new collaborative session
3. **Join Room**: Use "Join Room" and enter a room code to join an existing session
4. **Collaborate**: Start drawing and chatting with other participants in real-time

## API Endpoints

### Authentication
- `POST /api/v1/users/user-signup` - User registration
- `POST /api/v1/users/user-login` - User login
- `POST /api/v1/users/user-logout` - User logout

### Rooms
- `POST /api/v1/rooms/create` - Create a new room
- `POST /api/v1/rooms/join` - Join an existing room
- `GET /api/v1/rooms` - Get user's rooms

### Board & Chat
- `GET /api/v1/boards/:roomId` - Get board data
- `GET /api/v1/chat/:roomId` - Get chat messages

## Socket Events

### Client to Server
- `join-room` - Join a room
- `drawing-update` - Send drawing updates
- `chat-message` - Send chat message
- `voice-toggle` - Toggle voice status

### Server to Client
- `user-joined` - User joined the room
- `user-left` - User left the room
- `drawing-update` - Receive drawing updates
- `chat-message` - Receive chat message
- `voice-toggle` - Voice status update

## Development

### Project Structure

```
Omnitrix/
├── backend/
│   ├── controllers/     # Request handlers
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── middlewares/    # Custom middlewares
│   ├── socket/         # Socket.io handlers
│   ├── utils/          # Utility functions
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── contexts/   # React contexts
│   │   ├── lib/        # API and socket clients
│   │   └── App.tsx     # Main app component
│   └── package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
