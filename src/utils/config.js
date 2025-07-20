/**
 * 配置管理模块
 * 负责加载和管理系统配置
 */

require('dotenv').config();

const config = {
  // 数据库配置
  database: {
    path: process.env.DB_PATH || './data/twitter_monitor.db'
  },
  
  // Twitter API配置
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  },
  
  // Deepseek API配置
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  },
  
  // ntfy配置
  ntfy: {
    server: process.env.NTFY_SERVER || 'https://ntfy.sh',
    topic: process.env.NTFY_TOPIC || 'twitter-monitor',
    priority: process.env.NTFY_PRIORITY || 'default'
  },
  
  // 监控配置
  monitor: {
    interval: parseInt(process.env.MONITOR_INTERVAL) || 300000, // 5分钟
    maxTweets: parseInt(process.env.MAX_TWEETS_PER_REQUEST) || 10
  },
  
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost'
  },

  // 添加 get 方法
  get: function(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  },

  // 添加 set 方法
  set: function(key, value) {
    const keys = key.split('.');
    let obj = this;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
  }
};

module.exports = config;
