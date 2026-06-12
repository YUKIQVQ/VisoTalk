const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

class QwenService {
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY;
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = 'qwen-plus';

    if (!this.apiKey) {
      console.warn('⚠️ 警告: DASHSCOPE_API_KEY 环境变量未设置');
    }

    console.log(`✅ Qwen服务已初始化，使用模型: ${this.model}`);
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

  buildMessages(context) {
    const { userMessage, visionAnalysis, conversationHistory } = context;

    let systemPrompt = `你是一个AI视觉语音对话助手，具备多模态交互能力。
你的特点：
1. 能够理解和分析视觉内容
2. 支持自然流畅的语音对话
3. 回答简洁、友好、专业
4. 如果提供了视觉分析数据，请结合这些信息给出更准确的回应
5. 使用中文进行交流`;

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
      userContent += `\n\n[视觉分析信息: ${JSON.stringify(visionAnalysis)}]`;
    }

    messages.push({ role: 'user', content: userContent });

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
