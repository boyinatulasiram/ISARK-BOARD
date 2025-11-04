const express=require('express');
const cors=require('cors');
const cookieparser=require('cookie-parser');


const app=express();

app.use(express.json())
app.use(cors(
    {
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            // Allow all origins for development
            return callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
))

app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(cookieparser());

//include routes
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/rooms', require('./routes/room.routes'));
app.use('/api/v1/boards', require('./routes/board.routes'));
app.use('/api/v1/chat', require('./routes/chat.routes'));
app.use('/api/v1/ai', require('./routes/ai.routes'));



module.exports=app