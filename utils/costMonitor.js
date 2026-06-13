// C:\Users\26279\PycharmProjects\AI-react\utils\costMonitor.js
class CostMonitor {
  constructor() {
    this.usage = {
      qwen: {
        calls: 0,
        tokens: 0,
        cost: 0,
        lastReset: Date.now()
      },
      vision: {
        localCalls: 0,
        cloudCalls: 0,
        cost: 0,
        lastReset: Date.now()
      }
    };

    this.budgets = {
      daily: parseFloat(process.env.DAILY_BUDGET) || 10.0,
      monthly: parseFloat(process.env.MONTHLY_BUDGET) || 200.0
    };

    this.alerts = [];
  }

  recordQwenUsage(tokens, cost) {
    this.usage.qwen.calls++;
    this.usage.qwen.tokens += tokens;
    this.usage.qwen.cost += cost;

    this.checkBudgetAlerts();
  }

  recordVisionUsage(type, cost) {
    if (type === 'cloud') {
      this.usage.vision.cloudCalls++;
    } else {
      this.usage.vision.localCalls++;
    }
    this.usage.vision.cost += cost;

    this.checkBudgetAlerts();
  }

  checkBudgetAlerts() {
    const dailyTotal = this.usage.qwen.cost + this.usage.vision.cost;

    if (dailyTotal > this.budgets.daily * 0.8) {
      this.addAlert('warning', `日预算已使用 ${(dailyTotal / this.budgets.daily * 100).toFixed(1)}%`);
    }

    if (dailyTotal > this.budgets.daily) {
      this.addAlert('critical', '日预算已超支！');
    }
  }

  addAlert(level, message) {
    const alert = {
      level,
      message,
      timestamp: new Date().toISOString()
    };

    this.alerts.unshift(alert);

    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    console.warn(`💰 [${level.toUpperCase()}] ${message}`);
  }

  getUsageReport() {
    const dailyTotal = this.usage.qwen.cost + this.usage.vision.cost;

    return {
      period: '今日',
      qwen: {
        ...this.usage.qwen,
        averageTokensPerCall: Math.round(this.usage.qwen.tokens / (this.usage.qwen.calls || 1))
      },
      vision: {
        ...this.usage.vision,
        cloudUtilizationRate: this.usage.vision.cloudCalls / (this.usage.vision.cloudCalls + this.usage.vision.localCalls || 1) * 100
      },
      totalCost: dailyTotal.toFixed(4),
      budgetRemaining: Math.max(0, this.budgets.daily - dailyTotal).toFixed(4),
      budgetUtilization: `${(dailyTotal / this.budgets.daily * 100).toFixed(1)}%`,
      alerts: this.alerts.slice(0, 5)
    };
  }

  resetDailyStats() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - this.usage.qwen.lastReset > oneDay) {
      this.usage.qwen.calls = 0;
      this.usage.qwen.tokens = 0;
      this.usage.qwen.cost = 0;
      this.usage.qwen.lastReset = now;
    }

    if (now - this.usage.vision.lastReset > oneDay) {
      this.usage.vision.localCalls = 0;
      this.usage.vision.cloudCalls = 0;
      this.usage.vision.cost = 0;
      this.usage.vision.lastReset = now;
    }

    this.alerts = [];
  }
}

const costMonitor = new CostMonitor();

setInterval(() => costMonitor.resetDailyStats(), 24 * 60 * 60 * 1000);

module.exports = costMonitor;
