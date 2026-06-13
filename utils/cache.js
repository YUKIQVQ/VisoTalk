const fs = require('fs');
const path = require('path');

class AdvancedCache {
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.defaultTTL = options.ttl || 300;
    this.maxSize = options.maxSize || 1000;

    this.diskCachePath = options.diskPath || './.cache/vision';
    this.enableDiskCache = options.enableDisk || false;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskWrites: 0,
      diskReads: 0
    };

    if (this.enableDiskCache) {
      this.ensureDiskCacheDir();
    }

    console.log(`✅ 高级缓存系统已初始化`);
    console.log(`   内存缓存上限: ${this.maxSize} 条`);
    console.log(`   默认TTL: ${this.defaultTTL} 秒`);
    console.log(`   磁盘缓存: ${this.enableDiskCache ? '启用' : '禁用'}`);
  }

  set(key, value, ttl = this.defaultTTL, priority = 'normal') {
    const expiry = Date.now() + (ttl * 1000);

    if (this.memoryCache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.memoryCache.set(key, {
      value,
      expiry,
      priority,
      lastAccessed: Date.now(),
      accessCount: 0
    });

    if (this.enableDiskCache && priority === 'high') {
      this.saveToDisk(key, value);
    }

    return true;
  }

  get(key) {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      this.stats.misses++;

      if (this.enableDiskCache) {
        const diskValue = this.loadFromDisk(key);
        if (diskValue) {
          this.stats.hits++;
          this.set(key, diskValue, this.defaultTTL, 'normal');
          return diskValue;
        }
      }

      return null;
    }

    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      this.stats.misses++;
      this.removeFromDisk(key);
      return null;
    }

    item.lastAccessed = Date.now();
    item.accessCount++;
    this.stats.hits++;

    return item.value;
  }

  delete(key) {
    this.memoryCache.delete(key);
    this.removeFromDisk(key);
  }

  clear() {
    this.memoryCache.clear();
    if (this.enableDiskCache) {
      this.clearDiskCache();
    }
    this.resetStats();
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      cacheSize: this.memoryCache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
        this.removeFromDisk(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 清理了 ${cleaned} 个过期缓存项`);
    }

    return cleaned;
  }

  startCleanup(interval = 3600000) {
    setInterval(() => this.cleanup(), interval);
    console.log(`⏰ 缓存自动清理已启动（间隔: ${interval / 1000 / 60}分钟）`);
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.memoryCache.entries()) {
      const score = item.lastAccessed - (item.accessCount * 60000);
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
      console.log(`🔄 淘汰最久未使用的缓存项: ${oldestKey.substring(0, 16)}...`);
    }
  }

  ensureDiskCacheDir() {
    if (!fs.existsSync(this.diskCachePath)) {
      fs.mkdirSync(this.diskCachePath, { recursive: true });
      console.log(`📁 创建磁盘缓存目录: ${this.diskCachePath}`);
    }
  }

  saveToDisk(key, value) {
    try {
      const filePath = path.join(this.diskCachePath, `${key}.json`);
      const data = {
        key,
        value,
        timestamp: Date.now()
      };
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
      this.stats.diskWrites++;
    } catch (error) {
      console.warn('⚠️ 磁盘缓存写入失败:', error.message);
    }
  }

  loadFromDisk(key) {
    try {
      const filePath = path.join(this.diskCachePath, `${key}.json`);
      if (!fs.existsSync(filePath)) return null;

      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      const age = Date.now() - data.timestamp;
      if (age > this.defaultTTL * 1000 * 2) {
        fs.unlinkSync(filePath);
        return null;
      }

      this.stats.diskReads++;
      return data.value;
    } catch (error) {
      console.warn('⚠️ 磁盘缓存读取失败:', error.message);
      return null;
    }
  }

  removeFromDisk(key) {
    try {
      const filePath = path.join(this.diskCachePath, `${key}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('⚠️ 磁盘缓存删除失败:', error.message);
    }
  }

  clearDiskCache() {
    try {
      if (fs.existsSync(this.diskCachePath)) {
        const files = fs.readdirSync(this.diskCachePath);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.diskCachePath, file));
        });
        console.log('🗑️ 磁盘缓存已清空');
      }
    } catch (error) {
      console.warn('⚠️ 磁盘缓存清空失败:', error.message);
    }
  }

  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [key, item] of this.memoryCache.entries()) {
      totalSize += Buffer.byteLength(JSON.stringify(item.value));
    }
    return `${(totalSize / 1024).toFixed(2)} KB`;
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskWrites: 0,
      diskReads: 0
    };
  }

  getHotKeys(topN = 10) {
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({
        key,
        accessCount: item.accessCount,
        lastAccessed: item.lastAccessed
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, topN);

    return entries;
  }
}

const cache = new AdvancedCache({
  ttl: parseInt(process.env.CACHE_TTL) || 300,
  maxSize: 500,
  enableDisk: process.env.ENABLE_DISK_CACHE === 'true',
  diskPath: './.cache/vision'
});

cache.startCleanup(1800000);

module.exports = cache;
