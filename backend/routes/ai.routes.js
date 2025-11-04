const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { verifyJWT } = require('../middlewares/auth.middleware');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/summarize', verifyJWT, upload.single('file'), async (req, res) => {
    try {
        console.log('AI summarize request received');
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('File received, size:', req.file.size);

        const FormData = require('form-data');
        const formData = new FormData();
        
        formData.append('file', req.file.buffer, {
            filename: 'whiteboard.png',
            contentType: 'image/png'
        });
        formData.append('prompt', 'Analyze this whiteboard diagram and provide a comprehensive summary of the content, including key concepts, relationships, and insights.');

        console.log('Sending to Gemini API...');
        
        const response = await axios.post('https://gemini-file-api.vercel.app/api/upload', formData, {
            headers: {
                ...formData.getHeaders(),
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000
        });

        console.log('Gemini API success:', response.data);
        res.json(response.data);

    } catch (error) {
        console.error('AI Summary Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: error.response?.data?.error || error.message || 'Failed to generate summary'
        });
    }
});

module.exports = router;