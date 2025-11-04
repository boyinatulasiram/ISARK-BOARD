require('dotenv').config('./.env')
const connectDB=require('./db/db');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { handleConnection } = require('./socket/socketHandlers');

const app=require('./app');
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow requests with no origin
            if (!origin) return callback(null, true);
            // Allow all origins for development
            return callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

handleConnection(io);

server.listen(process.env.PORT||3000,()=>{
    console.log("Server is running......");  
})

connectDB();