const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000/api';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testHealth() {
  log(colors.cyan, '\n📋 测试1: 健康检查');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    log(colors.green, `✅ 健康检查通过: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    log(colors.red, `❌ 健康检查失败: ${error.message}`);
    return false;
  }
}

async function testChat() {
  log(colors.cyan, '\n📋 测试2: AI对话接口');
  try {
    const response = await axios.post(`${BACKEND_URL}/chat`, {
      message: '你好，请介绍一下自己',
      context: [],
      visionData: null
    });

    log(colors.green, `✅ AI对话测试通过`);
    log(colors.blue, `   响应: ${response.data.message}`);
    log(colors.yellow, `   提供商: ${response.data.provider}`);
    log(colors.yellow, `   模型: ${response.data.model}`);
    return true;
  } catch (error) {
    log(colors.red, `❌ AI对话测试失败: ${error.message}`);
    if (error.response) {
      log(colors.red, `   错误详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testVisionBase64() {
  log(colors.cyan, '\n📋 测试3: 视觉分析接口（Base64）');
  try {
    // 创建一个简单的测试图片（1x1像素的红色PNG）
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const response = await axios.post(`${BACKEND_URL}/vision/analyze-base64`, {
      imageBase64: testImageBase64
    });

    log(colors.green, `✅ 视觉分析测试通过`);
    log(colors.blue, `   场景: ${response.data.analysis.scene}`);
    log(colors.blue, `   类别: ${response.data.analysis.category}`);
    log(colors.yellow, `   置信度: ${(response.data.analysis.confidence * 100).toFixed(1)}%`);
    return true;
  } catch (error) {
    log(colors.red, `❌ 视觉分析测试失败: ${error.message}`);
    if (error.response) {
      log(colors.red, `   错误详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function runAllTests() {
  log(colors.blue, '\n╔══════════════════════════════════════╗');
  log(colors.blue, '║   AI视觉语音对话助手 - API测试工具   ║');
  log(colors.blue, '╚══════════════════════════════════════╝');

  // 检查环境变量
  log(colors.cyan, '\n📋 检查系统环境变量');
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    log(colors.red, '❌ DASHSCOPE_API_KEY 未在系统环境变量中配置');
    log(colors.yellow, '\n请运行以下命令配置:');
    log(colors.green, '  npm run setup');
    log(colors.yellow, '\n或手动设置:');
    log(colors.green, '  Windows: setx DASHSCOPE_API_KEY "sk-your-key"');
    log(colors.green, '  macOS/Linux: export DASHSCOPE_API_KEY="sk-your-key"');
    return;
  }

  log(colors.green, `✅ DASHSCOPE_API_KEY 已配置: ${apiKey.substring(0, 8)}...`);

  // 运行测试
  const healthOk = await testHealth();
  if (!healthOk) {
    log(colors.red, '\n⚠️  后端服务未启动，请先运行: npm start');
    return;
  }

  await testChat();
  await testVisionBase64();

  log(colors.green, '\n✅ 所有测试完成！');
  log(colors.blue, '\n💡 如果所有测试都通过，但前端仍显示离线，请检查:');
  log(colors.yellow, '   1. 前端BACKEND_URL是否正确 (http://localhost:3000/api)');
  log(colors.yellow, '   2. 浏览器控制台是否有CORS错误');
  log(colors.yellow, '   3. 网络请求是否被防火墙阻止');
}

runAllTests().catch(error => {
  log(colors.red, `\n❌ 测试过程出错: ${error.message}`);
  console.error(error);
});
