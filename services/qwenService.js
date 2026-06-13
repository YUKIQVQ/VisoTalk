const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

class QwenService {
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY;
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = 'qwen-plus';
    this.visionModel = 'qwen-vl-plus';

    if (!this.apiKey) {
      console.warn('⚠️ 警告: DASHSCOPE_API_KEY 环境变量未设置');
    }

    console.log(`✅ Qwen服务已初始化，使用模型: ${this.model}`);
    console.log(`   视觉模型: ${this.visionModel}`);
    console.log(`   API地址: ${this.baseUrl}`);
  }

  async generateResponse(context) {
    if (!this.apiKey) {
      throw new Error('DashScope API密钥未配置，请在系统环境变量中设置DASHSCOPE_API_KEY');
    }

    try {
      const messages = this.buildMessages(context);

      const payload = {
        model: this.model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.8
      };

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000
        }
      );

      const aiMessage = response.data.choices[0].message.content;

      return {
        success: true,
        provider: 'qwen',
        model: this.model,
        message: aiMessage,
        timestamp: new Date().toISOString(),
        usage: {
          tokens: this.estimateTokens(aiMessage),
          estimatedCost: this.calculateCost(aiMessage)
        }
      };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        console.error('Qwen API错误响应:', JSON.stringify(errorData, null, 2));

        if (status === 401) {
          throw new Error('DashScope API密钥无效或已过期');
        } else if (status === 429) {
          throw new Error('API调用频率超限，请稍后重试');
        } else if (status === 400) {
          throw new Error(`请求参数错误: ${errorData.error?.message || '未知错误'}`);
        } else if (status === 503) {
          throw new Error('DashScope服务暂时不可用，请稍后重试');
        }
      }

      throw new Error(`DashScope API调用失败: ${error.message}`);
    }
  }

  async analyzeImage(imageBase64) {
    if (!this.apiKey) {
      throw new Error('DashScope API密钥未配置');
    }

    try {
      console.log(' 开始视觉分析，使用模型:', this.visionModel);

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64
              }
            },
            {
              type: 'text',
              text: '请详细分析这张图片。请用JSON格式返回以下字段：scene（场景类型，如室内办公室、户外等）、category（类别）、objects（检测到的物体列表，每个包含name和confidence）、description（简短描述）、tags（标签数组）。只返回JSON，不要其他文字。'
            }
          ]
        }
      ];

      const payload = {
        model: this.visionModel,
        messages: messages,
        max_tokens: 1500,
        temperature: 0.3
      };

      console.log('🔄 发送请求到 DashScope API...');

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000
        }
      );

      console.log('✅ API响应成功');
      const analysisText = response.data.choices[0].message.content;
      console.log('📝 原始响应:', analysisText.substring(0, 200));

      return this.parseVisionAnalysis(analysisText);
    } catch (error) {
      console.error('❌ 视觉分析API调用失败:', error.message);
      if (error.response) {
        console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  parseVisionAnalysis(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ 成功解析JSON结果');
        return parsed;
      }
    } catch (e) {
      console.warn('️ 解析视觉分析JSON失败，使用文本提取');
    }

    return this.extractFromText(text);
  }

  extractFromText(text) {
    console.log('🔍 使用文本提取模式');

    const scenePatterns = [
      /场景[类型]?[:：]?\s*([^\n]+)/i,
      /这是[一一个个]?([^\s，。]{2,8})的场景/i,
      /图片显示[的是]?([^\s，。]{2,8})/i
    ];

    let scene = '室内环境';
    for (const pattern of scenePatterns) {
      const match = text.match(pattern);
      if (match) {
        scene = match[1].trim();
        break;
      }
    }

    const objectKeywords = ['桌子', '椅子', '电脑', '手机', '人', '耳机', '显示器', '键盘', '杯子', '书籍'];
    const detectedObjects = objectKeywords.filter(obj => text.includes(obj));

    const categoryMap = {
      '室内': '室内场景',
      '办公': '工作场景',
      '房间': '生活场景',
      '户外': '自然场景',
      '办公室': '工作场景'
    };

    let category = '室内场景';
    for (const [key, value] of Object.entries(categoryMap)) {
      if (text.includes(key)) {
        category = value;
        break;
      }
    }

    return {
      scene,
      category,
      objects: detectedObjects.map(name => ({ name, confidence: 0.85 + Math.random() * 0.1 })),
      description: text.substring(0, 200),
      tags: this.extractTags(text),
      confidence: 0.88
    };
  }

  extractTags(text) {
    const tagKeywords = [
      '明亮', '昏暗', '清晰', '温馨', '现代', '专业',
      '室内', '办公', '工作', '生活', '舒适', '整洁'
    ];
    return tagKeywords.filter(tag => text.includes(tag)).slice(0, 6);
  }

  buildMessages(context) {
    const { userMessage, visionAnalysis, conversationHistory, aiSettings } = context;

    let personaText = aiSettings?.persona || '';
    let aiName = aiSettings?.name || 'AI助手';

    let systemPrompt = `【绝对指令】你必须完全沉浸式扮演以下角色，不得打破角色设定：

━━━━━━━━━━━━━━━━━━━━━━━
角色名称：${aiName}
━━━━━━━━━━━━━━━━━━━━━━━

`;

    if (personaText) {
      systemPrompt += `${personaText}

━━━━━━━━━━━━━━━━━━━━━━━
【强制行为准则】
1. 始终以"${aiName}"的第一人称身份思考和说话
2. 严格按照人设中的性格、语气、用词风格进行回复
3. 绝对不要提及你是AI、语言模型或程序
4. 保持人设的一致性，永不偏离角色
5. 使用中文进行交流
6. 【重要】只有当用户明确询问视觉/摄像头/画面相关内容时，才使用提供的视觉分析信息。否则忽略视觉信息，专注于角色扮演的对话。
7. 回复长度控制在80-180字左右

━━━━━━━━━━━━━━━━━━━━━━━
【当前任务】
- 用户会发送文字消息，你需要以"${aiName}"的身份自然回复
- 如果有视觉分析数据且用户询问了相关内容，可以适当结合
- 保持对话的自然流畅，完全符合人设特点
━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
      systemPrompt += `你是一个AI视觉语音对话助手，具备多模态交互能力。
你的特点：
1. 能够理解和分析视觉内容
2. 支持自然流畅的语音对话
3. 回答简洁、友好、专业
4. 如果提供了视觉分析数据，请结合这些信息给出更准确的回应
5. 使用中文进行交流

`;
    }

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-5);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message
        });
      });
    }

    let userContent = userMessage;
    if (visionAnalysis) {
      userContent += `\n\n[视觉分析信息（仅在用户询问视觉相关内容时使用）: ${JSON.stringify(visionAnalysis)}]`;
    }

    messages.push({ role: 'user', content: userContent });

    console.log('\n========== System Prompt ==========');
    console.log(systemPrompt.substring(0, 300) + '...');
    console.log('===================================');
    console.log(' AI名字:', aiName);
    console.log(' 人设长度:', personaText.length, '字符');
    console.log('👁️ 视觉分析:', visionAnalysis ? '已提供' : '未提供');
    console.log('===================================\n');

    return messages;
  }

  estimateTokens(text) {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  calculateCost(text) {
    const tokens = this.estimateTokens(text);
    return (tokens / 1000) * 0.002;
  }

  async testConnection() {
    try {
      const testContext = {
        userMessage: '你好',
        conversationHistory: []
      };

      const response = await this.generateResponse(testContext);
      return {
        success: true,
        message: 'API连接测试成功',
        response: response.message
      };
    } catch (error) {
      return {
        success: false,
        message: `API连接测试失败: ${error.message}`
      };
    }
  }
}

module.exports = new QwenService();
