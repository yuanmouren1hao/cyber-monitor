/**
 * 监控服务
 * 负责定期监控Twitter账号并获取新推文
 */

const cron = require('node-cron');
const TwitterClient = require('../api/twitter');
const AccountManager = require('./account-manager');
const database = require('../db/database');
const logger = require('../utils/logger');
const config = require('../utils/config');

class MonitorService {
  constructor() {
    this.twitterClient = new TwitterClient();
    this.accountManager = new AccountManager();
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * 启动监控服务
   */
  start() {
    if (this.isRunning) {
      logger.warn('监控服务已在运行中');
      return;
    }

    // 每5分钟执行一次监控
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.monitorAllAccounts();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    
    logger.info('监控服务已启动');
    
    // 立即执行一次监控
    this.monitorAllAccounts();
  }

  /**
   * 停止监控服务
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('监控服务已停止');
  }

  /**
   * 监控所有账号
   */
  async monitorAllAccounts() {
    try {
      logger.info('开始监控所有账号...');
      
      const accounts = await this.accountManager.getAllAccounts();
      
      if (accounts.length === 0) {
        logger.info('没有需要监控的账号');
        return;
      }

      logger.info(`开始监控 ${accounts.length} 个账号`);

      // 并发监控所有账号
      const promises = accounts.map(account => this.monitorAccount(account));
      const results = await Promise.allSettled(promises);

      // 统计结果
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
          logger.error(`监控账号失败: ${accounts[index].username}`, { 
            error: result.reason 
          });
        }
      });

      logger.info(`监控完成: 成功 ${successCount}, 失败 ${errorCount}`);
    } catch (error) {
      logger.error(`监控服务执行失败: ${error.message}`, { error });
    }
  }

  /**
   * 监控单个账号
   * @param {Object} account - 账号信息
   */
  async monitorAccount(account) {
    try {
      logger.debug(`开始监控账号: ${account.username}`);

      const options = {
        max_results: config.monitor.maxTweets
      };

      // 如果有最后推文ID，只获取更新的推文
      if (account.last_tweet_id) {
        options.since_id = account.last_tweet_id;
      }

      // 获取推文
      const tweets = await this.twitterClient.getUserTweets(account.user_id, options);

      if (tweets.length === 0) {
        logger.debug(`账号 ${account.username} 没有新推文`);
        return;
      }

      logger.info(`账号 ${account.username} 获取到 ${tweets.length} 条新推文`);

      // 保存推文到数据库
      let savedCount = 0;
      let latestTweetId = account.last_tweet_id;

      for (const tweet of tweets) {
        try {
          const saved = await this.saveTweet(tweet, account);
          if (saved) {
            savedCount++;
            // 更新最新推文ID
            if (!latestTweetId || tweet.id > latestTweetId) {
              latestTweetId = tweet.id;
            }
          }
        } catch (error) {
          logger.error(`保存推文失败: ${tweet.id}`, { error });
        }
      }

      // 更新账号的最后推文ID
      if (latestTweetId && latestTweetId !== account.last_tweet_id) {
        await this.accountManager.updateLastTweetId(account.username, latestTweetId);
      }

      logger.info(`账号 ${account.username} 成功保存 ${savedCount} 条推文`);
    } catch (error) {
      logger.error(`监控账号失败: ${account.username}`, { error });
      throw error;
    }
  }

  /**
   * 保存推文到数据库
   * @param {Object} tweet - 推文数据
   * @param {Object} account - 账号信息
   * @returns {Promise<boolean>} 是否成功保存
   */
  async saveTweet(tweet, account) {
    try {
      // 检查推文是否已存在
      const existingTweet = await database.query(
        'SELECT id FROM tweets WHERE id = ?', 
        [tweet.id]
      );

      if (existingTweet.length > 0) {
        logger.debug(`推文已存在: ${tweet.id}`);
        return false;
      }

      // 处理媒体URL
      const mediaUrls = tweet.media ? 
        JSON.stringify(tweet.media.map(m => m.url || m.preview_image_url)) : 
        null;

      // 处理引用推文
      const referencedTweets = tweet.referenced_tweets ? 
        JSON.stringify(tweet.referenced_tweets) : 
        null;

      // 处理实体信息
      const entities = tweet.entities ? 
        JSON.stringify(tweet.entities) : 
        null;

      const sql = `
        INSERT INTO tweets 
        (id, user_id, username, text, created_at, retweet_count, like_count, 
         reply_count, quote_count, has_media, media_urls, referenced_tweets, 
         entities, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        tweet.id,
        account.user_id,
        account.username,
        tweet.text,
        tweet.created_at,
        tweet.public_metrics?.retweet_count || 0,
        tweet.public_metrics?.like_count || 0,
        tweet.public_metrics?.reply_count || 0,
        tweet.public_metrics?.quote_count || 0,
        tweet.media ? 1 : 0,
        mediaUrls,
        referencedTweets,
        entities,
        JSON.stringify(tweet)
      ];

      await database.run(sql, params);
      logger.debug(`推文保存成功: ${tweet.id}`);
      return true;
    } catch (error) {
      logger.error(`保存推文失败: ${tweet.id}`, { error });
      throw error;
    }
  }

  /**
   * 获取监控状态
   * @returns {Object} 监控状态信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? this.cronJob.nextDate() : null
    };
  }

  /**
   * 手动触发监控
   */
  async triggerMonitor() {
    if (this.isRunning) {
      await this.monitorAllAccounts();
    } else {
      throw new Error('监控服务未启动');
    }
  }
}

module.exports = MonitorService;
