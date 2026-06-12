const fs = require('fs');
const path = require('path');

// 加载.env文件（仅用于其他配置，API密钥从系统环境变量读取）
require('dotenv').config();

console.log('🔍 检查系统环境变量...');

// 从系统环境变量读取API密钥
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
  console.error('\n❌ 错误: DASHSCOPE_API_KEY 未设置');
  console.log('\n请设置系统环境变量:');
  console.log('\nWindows (PowerShell):');
  console.log('  $env:DASHSCOPE_API_KEY="sk-your-key-here"');
  console.log('\nWindows (CMD - 永久设置):');
  console.log('  setx DASHSCOPE_API_KEY "sk-your-key-here"');
  console.log('\nmacOS/Linux (临时):');
  console.log('  export DASHSCOPE_API_KEY="sk-your-key-here"');
  console.log('\nmacOS/Linux (永久):');
  console.log('  echo \'export DASHSCOPE_API_KEY="sk-your-key-here"\' >> ~/.bashrc');
  console.log('  source ~/.bashrc');
  console.log('\n获取API密钥: https://dashscope.console.aliyun.com/apiKey\n');
  process.exit(1);
}

if (apiKey === 'your_qwen_api_key_here' ||
    apiKey === 'sk-your-actual-api-key-here') {
  console.error('\n❌ 错误: DASHSCOPE_API_KEY 仍然是示例值');
  console.log('请将其替换为你的真实API密钥');
  console.log('获取地址: https://dashscope.console.aliyun.com/apiKey\n');
  process.exit(1);
}

console.log('✅ DASHSCOPE_API_KEY 已配置');
console.log(`   密钥前缀: ${apiKey.substring(0, 8)}...`);
console.log(`📍 端口: ${process.env.PORT || 3000}`);

// 启动服务器
const app = require('./server');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 AI视觉语音对话助手后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI提供商: 通义千问 (Qwen)`);
  console.log(`\n💡 提示: 打开浏览器访问 http://localhost:${PORT}/api/health 测试服务`);
});
