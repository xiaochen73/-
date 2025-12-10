// generate-content.js
// 功能：调用AI生成今日养生内容，并保存为 data/today.json

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function generateContent() {
  try {
    console.log('🚀 开始生成今日养生内容...');
    
    // === 1. 获取日期与环境变量 ===
    const today = new Date();
    // 获取北京时间 YYYY-MM-DD
    const dateStr = today.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
    console.log('📅 今日日期:', dateStr);
    
    // 从GitHub Actions的环境变量中读取密钥（已通过Secrets设置）
    const AI_API_KEY = process.env.AI_API_KEY;
    if (!AI_API_KEY) {
      throw new Error('❌ 未找到API密钥。请在GitHub仓库的Settings > Secrets中设置AI_API_KEY。');
    }
    
    // === 2. 构建AI请求参数 ===
    const prompt = `你是一位专业的营养健康顾问。请生成${dateStr}的养生知识，内容必须严格涵盖以下三个方面：
    a. 【每日适宜糖分摄入】：说明成人每日推荐摄入量（单位：克），列举2-3种常见高糖食物示例，并提供一条核心的控糖注意事项。
    b. 【每日适宜热量摄入】：清晰区分轻体力、中等体力、重体力活动人群的每日热量摄入范围（单位：千卡），并给出一条关于保持摄入平衡的总体建议。
    c. 【每日适宜咖啡因摄入】：说明成人每日安全摄入量（单位：毫克），简述过量摄入可能带来的影响，并建议每日应避免摄入咖啡因的截止时段。
    
    **最重要：你的回复必须是一个格式完好的JSON对象，且只包含这个JSON，不要有任何额外的解释、标记或开场白。**
    **JSON格式必须与以下示例完全一致（只替换具体内容）：**
    
    {
      "date": "${dateStr}",
      "healthTips": {
        "sugar": {
          "dailyAmount": "25克以内",
          "note": "少喝甜饮料，蛋糕/奶茶等高糖食物需控制摄入量"
        },
        "calorie": {
          "range": {
            "lightActivity": "1800-2000千卡",
            "moderateActivity": "2000-2400千卡",
            "heavyActivity": "2400-3000千卡"
          },
          "tip": "根据活动量调整，搭配荤素避免热量过剩"
        },
        "caffeine": {
          "safeAmount": "不超过400毫克",
          "warning": "过量易失眠，建议下午3点后避免摄入咖啡因"
        }
      }
    }`;
    
    // === 3. 调用AI API（以智谱AI GLM-4为例）===
    console.log('🤖 正在调用AI生成内容...');
    const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const requestData = {
      model: "glm-4", // 使用GLM-4模型
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7 // 控制创造性，0-1之间
    };
    
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30秒超时
    });
    
    // === 4. 解析AI返回的JSON ===
    const aiReply = response.data.choices[0].message.content;
    // 提取JSON部分，防止模型返回多余文本
    const jsonMatch = aiReply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI返回的内容中未找到有效的JSON格式。');
    }
    const healthData = JSON.parse(jsonMatch[0]);
    // 确保日期是今天
    healthData.date = dateStr;
    
    // === 5. 写入文件 ===
    const dataDir = path.join(process.cwd(), 'data'); // 使用当前工作目录
    const filePath = path.join(dataDir, 'today.json');
    
    // 如果data目录不存在，则创建
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    await fs.writeFile(filePath, JSON.stringify(healthData, null, 2), 'utf8'); // 缩进2个空格，美化格式
    console.log('✅ 今日养生内容已成功生成并保存至: ', filePath);
    console.log('生成内容摘要:', JSON.stringify(healthData, null, 2));
    
  } catch (error) {
    console.error('❌ 生成内容过程中发生错误:');
    if (error.response) {
      // API返回了错误状态码（如401密钥错误，429频率限制）
      console.error(`API请求失败，状态码: ${error.response.status}`);
      console.error('错误详情:', JSON.stringify(error.response.data));
    } else if (error.request) {
      // 请求发出但没有收到响应（网络问题）
      console.error('网络错误: 无法连接到AI服务，请检查网络。');
    } else {
      // 脚本内部错误
      console.error('脚本错误:', error.message);
    }
    // 非零退出码会让GitHub Actions标记此步骤为失败
    process.exit(1);
  }
}

// 执行主函数
generateContent();
