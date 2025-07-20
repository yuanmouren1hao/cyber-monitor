/**
 * 数据库连接和管理模块
 * 负责SQLite数据库的连接、初始化和操作
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../utils/config');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = config.database.path;
    this.init();
  }

  /**
   * 初始化数据库连接
   */
  init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 创建数据库连接
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('数据库连接失败:', err);
          throw err;
        }
        logger.info('数据库连接成功');
        this.createTables();
      });
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建数据库表
   */
  createTables() {
    const tables = [
      // 监控账号表
      `CREATE TABLE IF NOT EXISTS monitored_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        user_id TEXT UNIQUE,
        display_name TEXT,
        profile_image_url TEXT,
        description TEXT,
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        tweet_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        last_tweet_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 推文表
      `CREATE TABLE IF NOT EXISTS tweets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        retweet_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        quote_count INTEGER DEFAULT 0,
        has_media BOOLEAN DEFAULT 0,
        media_urls TEXT,
        referenced_tweets TEXT,
        entities TEXT,
        raw_data TEXT,
        collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES monitored_accounts(user_id)
      )`,
      
      // 分析结果表
      `CREATE TABLE IF NOT EXISTS tweet_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tweet_id TEXT NOT NULL,
        sentiment_score REAL,
        sentiment_label TEXT,
        keywords TEXT,
        summary TEXT,
        analysis_data TEXT,
        analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tweet_id) REFERENCES tweets(id)
      )`,
      
      // 通知记录表
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tweet_id TEXT,
        type TEXT NOT NULL,
        title TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tweet_id) REFERENCES tweets(id)
      )`,
      
      // 系统配置表
      `CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    tables.forEach((sql, index) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error(`创建表失败 (${index + 1}):`, err);
        } else {
          logger.debug(`表创建成功 (${index + 1})`);
        }
      });
    });
  }

  /**
   * 执行查询
   */
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('查询执行失败:', { sql, params, error: err });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 执行插入/更新/删除
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('SQL执行失败:', { sql, params, error: err });
          reject(err);
        } else {
          resolve({ 
            lastID: this.lastID, 
            changes: this.changes 
          });
        }
      });
    });
  }

  /**
   * 关闭数据库连接
   */
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('数据库关闭失败:', err);
          reject(err);
        } else {
          logger.info('数据库连接已关闭');
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
