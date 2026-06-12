const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function detectOS() {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

function getSetupInstructions(apiKey) {
  const os = detectOS();
  
  const instructions = {
    windows: `
${colors.cyan}Windows 系统环境变量配置方法:${colors.reset}

${colors.yellow}方法1: 使用命令行（推荐）${colors.reset}
  临时设置（当前终端有效）:
  ${colors.green}set DASHSCOPE_API_KEY=${apiKey}${colors.reset}
  
  永久设置:
  ${colors.green}setx DASHSCOPE_API_KEY "${apiKey}"${colors.reset}
  ⚠️ 注意: 设置后需要重新打开终端才能生效

${colors.yellow}方法2: 通过系统设置${colors.reset}
  1. 右键"此电脑" → "属性"
  2. 点击"高级系统设置"
  3. 点击"环境变量"
  4. 在"用户变量"或"系统变量"中点击"新建"
  5. 变量名: DASHSCOPE_API_KEY
  6. 变量值: ${apiKey}
  7. 点击确定保存
`,
    
    macos: `
${colors.cyan}macOS 系统环境变量配置方法:${colors.reset}

${colors.yellow}方法1: 临时设置（当前终端会话）${colors.reset}
${colors.green}export DASHSCOPE_API_KEY="${apiKey}"${colors.reset}

${colors.yellow}方法2: 永久设置（推荐）${colors.reset}
  对于 bash:
  ${colors.green}echo 'export DASHSCOPE_API_KEY="${apiKey}"' >> ~/.bash_profile${colors.reset}
  ${colors.green}source ~/.bash_profile${colors.reset}
  
  对于 zsh (macOS 默认):
  ${colors.green}echo 'export DASHSCOPE_API_KEY="${apiKey}"' >> ~/.zshrc${colors.reset}
  ${colors.green}source ~/.zshrc${colors.reset}

${colors.yellow}方法3: 使用 launchd（系统级）${colors.reset}
  创建 ~/Library/LaunchAgents/environment.plist 文件
`,
    
    linux: `
${colors.cyan}Linux 系统环境变量配置方法:${colors.reset}

${colors.yellow}方法1: 临时设置（当前终端会话）${colors.reset}
${colors.green}export DASHSCOPE_API_KEY="${apiKey}"${colors.reset}

${colors.yellow}方法2: 永久设置（推荐）${colors.reset}
  添加到 ~/.bashrc:
  ${colors.green}echo 'export DASHSCOPE_API_KEY="${apiKey}"' >> ~/.bashrc${colors.reset}
  ${colors.green}source ~/.bashrc${colors.reset}
  
  或添加到 ~/.profile:
  ${colors.green}echo 'export DASHSCOPE_API_KEY="${apiKey}"' >> ~/.profile${colors.reset}
  ${colors.green}source ~/.profile${colors.reset}

${colors.yellow}方法3: 系统级配置${colors.reset}
  编辑 /etc/environment 文件，添加:
  DASHSCOPE_API_KEY=${apiKey}
`
  };
  
  return instructions[os];
}

async function main() {
  log(colors.blue, '\n╔══════════════════════════════════════╗');
  log(colors.blue, '║   DASHSCOPE_API_KEY 配置助手         ║');
  log(colors.blue, '╚══════════════════════════════════════╝\n');
  
  // 检查是否已经配置
  const currentKey = process.env.DASHSCOPE_API_KEY;
  
  if (currentKey && 
      currentKey !== 'your_qwen_api_key_here' && 
      currentKey !== 'sk-your-actual-api-key-here') {
    log(colors.green, '✅ DASHSCOPE_API_KEY 已配置');
    log(colors.cyan, `   当前密钥: ${currentKey.substring(0, 8)}...`);
    
    const shouldChange = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      shouldChange.question('是否需要修改? (y/n): ', resolve);
    });
    shouldChange.close();
    
    if (answer.toLowerCase() !== 'y') {
      log(colors.green, '\n✅ 配置无需修改，可以直接启动服务');
      log(colors.yellow, '   运行命令: npm start\n');
      return;
    }
  }
  
  // 获取新的API密钥
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const apiKey = await new Promise(resolve => {
    readline.question('\n请输入你的 DashScope API 密钥: ', resolve);
  });
  readline.close();
  
  if (!apiKey || apiKey.trim().length < 10) {
    log(colors.red, '\n❌ API密钥格式不正确');
    process.exit(1);
  }
  
  log(getSetupInstructions(apiKey.trim()));
  
  log(colors.cyan, '\n📝 配置完成后，验证是否成功:');
  log(colors.green, '  Windows: echo %DASHSCOPE_API_KEY%');
  log(colors.green, '  macOS/Linux: echo $DASHSCOPE_API_KEY\n');
  
  log(colors.yellow, '💡 获取API密钥: https://dashscope.console.aliyun.com/apiKey\n');
}

main().catch(error => {
  log(colors.red, `\n❌ 错误: ${error.message}`);
  console.error(error);
});
