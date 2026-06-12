class Cache {
  constructor(defaultTTL = 300) {
    this.store = new Map();
    this.defaultTTL = defaultTTL; // 默认5分钟
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + (ttl * 1000);
    this.store.set(key, {
      value,
      expiry
    });
  }

  get(key) {
    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiry) {
        this.store.delete(key);
      }
    }
  }

  startCleanup(interval = 3600000) {
    // 每小时清理一次过期缓存
    setInterval(() => this.cleanup(), interval);
  }
}

const cache = new Cache();
cache.startCleanup();

module.exports = cache;
