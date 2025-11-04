import { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Square, Circle, Undo, Redo, Download } from 'lucide-react';
import { socketClient } from '../lib/socket';
import { apiClient } from '../lib/api';

interface WhiteboardProps {
  roomId: string;
}

interface DrawingData {
  type: 'draw' | 'clear' | 'shape' | 'cursor';
  x?: number;
  y?: number;
  prevX?: number;
  prevY?: number;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  tool?: string;
  userId?: string;
  username?: string;
}

export const Whiteboard = ({ roomId }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'rectangle' | 'circle'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [lastPoint, setLastPoint] = useState<{x: number, y: number} | null>(null);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [remoteCursors, setRemoteCursors] = useState<{[userId: string]: {x: number, y: number, username: string}}>({});
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    if (overlayCanvas) {
      overlayCanvas.width = canvas.offsetWidth;
      overlayCanvas.height = canvas.offsetHeight;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save initial blank state
    setTimeout(() => {
      const imageData = canvas.toDataURL();
      setHistory([imageData]);
      setHistoryIndex(0);
    }, 100);
    
    loadBoardState();

    const handleDrawingUpdate = (data: DrawingData) => {
      if (data.type === 'draw' && data.x !== undefined && data.y !== undefined) {
        drawOnCanvas(data.x, data.y, data.prevX, data.prevY, data.color || '#000000', data.strokeWidth || 2, data.tool || 'pen');
      } else if (data.type === 'shape' && data.x !== undefined && data.y !== undefined) {
        drawShape(data.x, data.y, data.width || 0, data.height || 0, data.color || '#000000', data.strokeWidth || 2, data.tool || 'rectangle');
      } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else if (data.type === 'cursor' && data.userId && data.x !== undefined && data.y !== undefined) {
        setRemoteCursors(prev => ({
          ...prev,
          [data.userId!]: { x: data.x!, y: data.y!, username: data.username || 'User' }
        }));
      }
    };

    const socket = socketClient.getSocket();
    if (socket) {
      socket.on('drawing-update', handleDrawingUpdate);
    }

    return () => {
      if (socket) {
        socket.off('drawing-update', handleDrawingUpdate);
      }
    };
  }, [roomId]);

  const drawOnCanvas = (x: number, y: number, prevX?: number, prevY?: number, drawColor = color, drawStrokeWidth = strokeWidth, drawTool = tool) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = drawTool === 'eraser' ? '#ffffff' : drawColor;
    ctx.lineWidth = drawTool === 'eraser' ? drawStrokeWidth * 3 : drawStrokeWidth;
    
    if (prevX !== undefined && prevY !== undefined) {
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const drawShape = (x: number, y: number, width: number, height: number, drawColor = color, drawStrokeWidth = strokeWidth, shapeType = tool) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawStrokeWidth;
    ctx.beginPath();

    if (shapeType === 'rectangle') {
      ctx.rect(x, y, width, height);
    } else if (shapeType === 'circle') {
      const radius = Math.sqrt(width * width + height * height) / 2;
      ctx.arc(x + width / 2, y + height / 2, radius, 0, 2 * Math.PI);
    }
    
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Save state before starting to draw
    saveToHistory();
    
    setIsDrawing(true);
    setLastPoint({ x, y });
    setStartPoint({ x, y });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    socketClient.sendDrawingUpdate({
      type: 'cursor',
      x,
      y
    });

    if (!isDrawing) return;

    if (tool === 'pen' || tool === 'eraser') {
      if (!lastPoint) return;
      drawOnCanvas(x, y, lastPoint.x, lastPoint.y);
      
      socketClient.sendDrawingUpdate({
        type: 'draw' as const,
        x,
        y,
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        color,
        strokeWidth,
        tool
      });
      
      setLastPoint({ x, y });
    } else if ((tool === 'rectangle' || tool === 'circle') && startPoint && overlayCanvas) {
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = strokeWidth;
        overlayCtx.beginPath();
        
        if (tool === 'rectangle') {
          overlayCtx.rect(startPoint.x, startPoint.y, width, height);
        } else if (tool === 'circle') {
          const radius = Math.sqrt(width * width + height * height) / 2;
          overlayCtx.arc(startPoint.x + width / 2, startPoint.y + height / 2, radius, 0, 2 * Math.PI);
        }
        
        overlayCtx.stroke();
      }
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      setIsDrawing(false);
      setLastPoint(null);
      setStartPoint(null);
      return;
    }

    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if ((tool === 'rectangle' || tool === 'circle') && startPoint) {
      const width = x - startPoint.x;
      const height = y - startPoint.y;
      
      if (overlayCanvas) {
        const overlayCtx = overlayCanvas.getContext('2d');
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      }
      
      drawShape(startPoint.x, startPoint.y, width, height);
      
      const shapeData = {
        type: 'shape' as const,
        x: startPoint.x,
        y: startPoint.y,
        width,
        height,
        color,
        strokeWidth,
        tool
      };
      socketClient.sendDrawingUpdate(shapeData);
      
      setTimeout(saveBoardState, 100);
    }

    setIsDrawing(false);
    setLastPoint(null);
    setStartPoint(null);
  };

  const loadBoardState = async () => {
    try {
      const response = await apiClient.getBoard(roomId);
      if (response.success && response.data.imageData) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = response.data.imageData;
      }
    } catch (error) {
      console.log('No existing board state or error loading:', error);
    }
  };

  const saveBoardState = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const imageData = canvas.toDataURL();
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/boards/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ imageData })
      });
    } catch (error) {
      console.error('Error saving board state:', error);
    }
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[newIndex];
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[newIndex];
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save state before clearing
    saveToHistory();
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveBoardState();
    
    socketClient.sendDrawingUpdate({
      type: 'clear'
    });
  };

  const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];

  return (
    <div className="flex-1 flex">
      {/* Left Sidebar */}
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'pen' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="Pen"
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'eraser' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="Eraser"
        >
          <Eraser className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('rectangle')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'rectangle' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="Rectangle"
        >
          <Square className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('circle')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'circle' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="Circle"
        >
          <Circle className="w-5 h-5" />
        </button>
        
        <div className="w-8 h-px bg-gray-300 my-2"></div>
        
        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          className={`p-2 rounded-lg transition-colors ${
            historyIndex <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
          }`}
          title="Undo"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className={`p-2 rounded-lg transition-colors ${
            historyIndex >= history.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
          }`}
          title="Redo"
        >
          <Redo className="w-5 h-5" />
        </button>
        
        <div className="w-8 h-px bg-gray-300 my-2"></div>
        
        <div className="w-6 h-6 rounded border-2 border-gray-300 cursor-pointer" 
             style={{ backgroundColor: color }}
             title="Current Color"
        ></div>
        
        <div className="w-8 h-px bg-gray-300 my-2"></div>
        
        <button
          onClick={exportAsImage}
          className="p-2 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
          title="Download PNG"
        >
          <Download className="w-5 h-5" />
        </button>
        
        <button
          onClick={clearCanvas}
          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
          title="Clear Canvas"
        >
          <Eraser className="w-5 h-5" />
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
          <div className="flex items-center gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded border-2 transition-all ${
                  color === c ? 'border-gray-800 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{strokeWidth}px</span>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-100 relative">
          <div className="absolute inset-4">
            <canvas
              ref={canvasRef}
              className="w-full h-full bg-white shadow-sm cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={() => {
                const overlayCanvas = overlayCanvasRef.current;
                if (overlayCanvas) {
                  const overlayCtx = overlayCanvas.getContext('2d');
                  if (overlayCtx) {
                    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                  }
                }
                setIsDrawing(false);
                setLastPoint(null);
                setStartPoint(null);
              }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            
            {Object.entries(remoteCursors).map(([userId, cursor]) => (
              <div
                key={userId}
                className="absolute pointer-events-none z-10"
                style={{
                  left: cursor.x - 12,
                  top: cursor.y - 12,
                  transform: 'translate(0, 0)'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 3L19 12L12 13L8 19L5 3Z" fill="#3B82F6" stroke="white" strokeWidth="1"/>
                </svg>
                <div className="absolute top-6 left-6 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {cursor.username}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};