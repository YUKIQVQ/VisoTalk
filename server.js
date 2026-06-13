const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const qwenService = require('./services/qwenService');
const visionService = require('./services/visionService');
const cache = require('./utils/cache');
const costMonitor = require('./utils/costMonitor');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: 'qwen',
    cacheStats: cache.getStats(),
    costStats: costMonitor.getUsageReport()
  });
});

app.get('/api/monitor/costs', (req, res) => {
  res.json(costMonitor.getUsageReport());
});

app.get('/api/monitor/cache', (req, res) => {
  res.json(cache.getStats());
});

app.get('/api/monitor/vision-cache', (req, res) => {
  res.json(visionService.getCacheStats());
});

app.post('/api/vision/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }

    const imageBuffer = req.file.buffer || require('fs').readFileSync(req.file.path);

    const forceCloud = req.body.forceCloud === 'true';
    const forceLocal = req.body.forceLocal === 'true';
    
    const analysis = await visionService.analyzeImage(imageBuffer, {
      forceCloud,
      forceLocal
    });

    costMonitor.recordVisionUsage(
      analysis.analysisSource && analysis.analysisSource.startsWith('cloud') ? 'cloud' : 'local',
      analysis.metadata.costEstimate
    );
    
    res.json(analysis);
  } catch (error) {
    console.error('视觉分析错误:', error);
    res.status(500).json({ 
      error: '视觉分析失败', 
      details: error.message 
    });
  }
});

app.post('/api/vision/analyze-base64', async (req, res) => {
  try {
    const { imageBase64, forceCloud, forceLocal } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供Base64编码的图片' });
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: '无效的Base64格式' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    const analysis = await visionService.analyzeImage(imageBuffer, {
      forceCloud: forceCloud === 'true',
      forceLocal: forceLocal === 'true'
    });
    
    costMonitor.recordVisionUsage(
      analysis.analysisSource === 'cloud-qwen-vl' || analysis.analysisSource === 'cloud-enhanced' ? 'cloud' : 'local',
      analysis.metadata.costEstimate
    );
    
    res.json(analysis);
  } catch (error) {
    console.error('视觉分析错误:', error);
    res.status(500).json({ 
      error: '视觉分析失败', 
      details: error.message 
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, visionData, aiSettings } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '请提供有效的消息内容' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: '消息长度不能超过2000字符' });
    }

    const needsVision = visionService.needsVisionAnalysis(message);

    let finalVisionData = visionData;
    if (needsVision && !visionData) {
      console.log('👁️ 检测到视觉相关关键词，但无视觉数据');
    }

    const fullContext = {
      userMessage: message,
      visionAnalysis: finalVisionData || null,
      conversationHistory: context || [],
      aiSettings: aiSettings || {},
      timestamp: new Date().toISOString()
    };

    const response = await qwenService.generateResponse(fullContext);
    
    costMonitor.recordQwenUsage(
      response.usage.tokens,
      response.usage.estimatedCost
    );

    res.json(response);
  } catch (error) {
    console.error('AI对话错误:', error);
    res.status(500).json({ 
      error: 'AI响应失败', 
      details: error.message 
    });
  }
});

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

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: '文件上传错误' });
  }
  
  console.error('未处理的错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 AI视觉语音对话助手后端服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 AI提供商: 通义千问 (Qwen)`);
    console.log(`💰 成本监控: 已启用`);
    console.log(`📊 缓存系统: 高级缓存（含磁盘）`);
  });
}

module.exports = app;
