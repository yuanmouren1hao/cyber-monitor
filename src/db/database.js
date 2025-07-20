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
   * 获取所有监控的 Twitter 账号
   */
  getAllTwitterAccounts() {
    return this.query('SELECT * FROM monitored_accounts WHERE is_active = 1 ORDER BY created_at DESC');
  }

  /**
   * 添加监控账号
   */
  addTwitterAccount(accountData) {
    const { username, user_id, display_name, profile_image_url, description, followers_count, following_count, tweet_count } = accountData;
    return this.run(
      `INSERT INTO monitored_accounts 
       (username, user_id, display_name, profile_image_url, description, followers_count, following_count, tweet_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, user_id, display_name, profile_image_url, description, followers_count, following_count, tweet_count]
    );
  }

  /**
   * 删除监控账号
   */
  removeTwitterAccount(username) {
    return this.run('UPDATE monitored_accounts SET is_active = 0 WHERE username = ?', [username]);
  }

  /**
   * 获取推文总数
   */
  getTweetCount() {
    return this.query('SELECT COUNT(*) as count FROM tweets');
  }

  /**
   * 获取推文总数（别名方法）
   */
  getTweetsCount() {
    return this.getTweetCount();
  }

  /**
   * 获取所有推文
   */
  getAllTweets(limit = 50) {
    return this.query('SELECT * FROM tweets ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  /**
   * 获取分析总数
   */
  getAnalysisCount() {
    return this.query('SELECT COUNT(*) as count FROM tweet_analysis');
  }

  /**
   * 获取通知总数
   */
  getNotificationCount() {
    return this.query('SELECT COUNT(*) as count FROM notifications');
  }

  /**
   * 保存推文
   */
  saveTweet(tweetData) {
    const { id, user_id, username, text, created_at, retweet_count, like_count, reply_count, quote_count, has_media, media_urls, referenced_tweets, entities, raw_data } = tweetData;
    return this.run(
      `INSERT OR REPLACE INTO tweets 
       (id, user_id, username, text, created_at, retweet_count, like_count, reply_count, quote_count, has_media, media_urls, referenced_tweets, entities, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, username, text, created_at, retweet_count, like_count, reply_count, quote_count, has_media, media_urls, referenced_tweets, entities, raw_data]
    );
  }

  /**
   * 获取最新推文
   */
  getLatestTweets(limit = 50) {
    return this.query('SELECT * FROM tweets ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  /**
   * 保存分析结果
   */
  saveAnalysis(analysisData) {
    const { tweet_id, sentiment_score, sentiment_label, keywords, summary, analysis_data } = analysisData;
    return this.run(
      `INSERT INTO tweet_analysis (tweet_id, sentiment_score, sentiment_label, keywords, summary, analysis_data) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tweet_id, sentiment_score, sentiment_label, keywords, summary, analysis_data]
    );
  }

  /**
   * 获取最新的推文分析
   */
  getLatestTweetAnalysis(limit = 10) {
    return this.query(
      `SELECT ta.*, t.text, t.username, t.created_at as tweet_created_at 
       FROM tweet_analysis ta 
       JOIN tweets t ON ta.tweet_id = t.id 
       ORDER BY ta.analyzed_at DESC 
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * 获取所有分析结果
   */
  getAllAnalysis(limit = 50) {
    return this.query(
      `SELECT ta.*, t.text, t.username, t.created_at as tweet_created_at 
       FROM tweet_analysis ta 
       JOIN tweets t ON ta.tweet_id = t.id 
       ORDER BY ta.analyzed_at DESC 
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * 初始化数据库（用于外部调用）
   */
  initDb() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
      } else {
        // 如果数据库未初始化，重新初始化
        try {
          this.init();
          // 等待数据库连接完成
          setTimeout(() => {
            if (this.db) {
              resolve();
            } else {
              reject(new Error('数据库初始化失败'));
            }
          }, 1000);
        } catch (error) {
          reject(error);
        }
      }
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

  /**
   * 关闭数据库连接（用于外部调用）
   */
  closeDb() {
    return this.close();
  }
}

module.exports = new Database();
