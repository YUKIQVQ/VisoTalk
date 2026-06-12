const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const qwenService = require('./services/qwenService');
const visionService = require('./services/visionService');
const cache = require('./utils/cache');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer配置 - 用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: 'qwen'
  });
});

// 视觉分析接口
app.post('/api/vision/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }

    const imageBuffer = req.file.buffer || require('fs').readFileSync(req.file.path);
    const cacheKey = `vision_${require('crypto').createHash('md5').update(imageBuffer).digest('hex')}`;
    
    // 检查缓存
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 进行视觉分析
    const analysis = await visionService.analyzeImage(imageBuffer);
    
    // 缓存结果
    cache.set(cacheKey, analysis, parseInt(process.env.CACHE_TTL) || 300);
    
    res.json(analysis);
  } catch (error) {
    console.error('视觉分析错误:', error);
    res.status(500).json({ 
      error: '视觉分析失败', 
      details: error.message 
    });
  }
});

// 实时视觉分析（Base64图片）
app.post('/api/vision/analyze-base64', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供Base64编码的图片' });
    }

    const cacheKey = `vision_${require('crypto').createHash('md5').update(imageBase64).digest('hex')}`;
    
    // 检查缓存
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 解码Base64
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: '无效的Base64格式' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // 进行视觉分析
    const analysis = await visionService.analyzeImage(imageBuffer);
    
    // 缓存结果
    cache.set(cacheKey, analysis, parseInt(process.env.CACHE_TTL) || 300);
    
    res.json(analysis);
  } catch (error) {
    console.error('视觉分析错误:', error);
    res.status(500).json({ 
      error: '视觉分析失败', 
      details: error.message 
    });
  }
});

// AI对话接口
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, visionData } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '请提供有效的消息内容' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: '消息长度不能超过2000字符' });
    }

    // 构建完整的上下文
    const fullContext = {
      userMessage: message,
      visionAnalysis: visionData || null,
      conversationHistory: context || [],
      timestamp: new Date().toISOString()
    };

    // 生成AI响应
    const response = await qwenService.generateResponse(fullContext);
    
    res.json(response);
  } catch (error) {
    console.error('AI对话错误:', error);
    res.status(500).json({ 
      error: 'AI响应失败', 
      details: error.message 
    });
  }
});

// 语音转文字接口（预留，实际可由前端Web Speech API处理）
app.post('/api/speech-to-text', async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    
    if (!audioBase64) {
      return res.status(400).json({ error: '请提供音频数据' });
    }

    res.json({
      text: '语音识别功能待实现',
      confidence: 0 
    });
  } catch (error) {
    console.error('语音转文字错误:', error);
    res.status(500).json({ 
      error: '语音识别失败', 
      details: error.message 
    });
  }
});

// 文字转语音接口（预留）
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text, voice = 'zh-CN' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '请提供要转换的文本' });
    }

    res.json({
      audioUrl: null,
      message: 'TTS功能待实现，建议使用前端Web Speech API'
    });
  } catch (error) {
    console.error('文字转语音错误:', error);
    res.status(500).json({ 
      error: 'TTS失败', 
      details: error.message 
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: '文件上传错误' });
  }
  
  console.error('未处理的错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 AI视觉语音对话助手后端服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 AI提供商: 通义千问 (Qwen)`);
  });
}

module.exports = app;
