/**
 * Twitter API客户端
 * 负责与Twitter API进行通信，获取推文数据
 */

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
const config = require('../utils/config');

class TwitterClient {
  constructor() {
    this.client = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessTokenSecret,
    });
    
    // 只读客户端
    this.readOnlyClient = this.client.readOnly;
  }

  /**
   * 获取用户信息
   * @param {string} username - Twitter用户名
   * @returns {Promise<Object>} 用户信息
   */
  async getUserByUsername(username) {
    try {
      const user = await this.readOnlyClient.v2.userByUsername(username, {
        'user.fields': ['id', 'name', 'username', 'profile_image_url', 'description', 'created_at', 'public_metrics']
      });
      
      if (!user.data) {
        throw new Error(`用户 ${username} 不存在`);
      }
      
      return user.data;
    } catch (error) {
      logger.error(`获取用户信息失败: ${error.message}`, { username, error });
      throw new Error(`获取Twitter用户信息失败: ${error.message}`);
    }
  }

  /**
   * 获取用户的推文
   * @param {string} userId - Twitter用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 推文列表
   */
  async getUserTweets(userId, options = {}) {
    try {
      const params = {
        max_results: options.max_results || 10,
        'tweet.fields': ['id', 'text', 'created_at', 'public_metrics', 'entities', 'referenced_tweets'],
        expansions: ['author_id', 'referenced_tweets.id', 'attachments.media_keys'],
        'media.fields': ['url', 'preview_image_url', 'type']
      };

      // 如果提供了since_id，只获取更新的推文
      if (options.since_id) {
        params.since_id = options.since_id;
      }

      const tweets = await this.readOnlyClient.v2.userTimeline(userId, params);
      
      // 处理并格式化响应数据
      const tweetData = tweets.data?.data || [];
      const includes = tweets.data?.includes || {};
      
      return this._enrichTweets(tweetData, includes);
    } catch (error) {
      logger.error(`获取用户推文失败: ${error.message}`, { userId, error });
      throw new Error(`获取Twitter用户推文失败: ${error.message}`);
    }
  }

  /**
   * 搜索推文
   * @param {string} query - 搜索查询
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 推文列表
   */
  async searchTweets(query, options = {}) {
    try {
      const params = {
        query: query,
        max_results: options.max_results || 10,
        'tweet.fields': ['id', 'text', 'created_at', 'public_metrics', 'entities', 'referenced_tweets'],
        expansions: ['author_id', 'referenced_tweets.id', 'attachments.media_keys'],
        'media.fields': ['url', 'preview_image_url', 'type']
      };

      if (options.since_id) {
        params.since_id = options.since_id;
      }

      const tweets = await this.readOnlyClient.v2.search(query, params);
      
      const tweetData = tweets.data?.data || [];
      const includes = tweets.data?.includes || {};
      
      return this._enrichTweets(tweetData, includes);
    } catch (error) {
      logger.error(`搜索推文失败: ${error.message}`, { query, error });
      throw new Error(`搜索Twitter推文失败: ${error.message}`);
    }
  }

  /**
   * 丰富推文数据，添加媒体和引用信息
   * @private
   * @param {Array} tweets - 推文列表
   * @param {Object} includes - 包含的媒体和用户信息
   * @returns {Array} 丰富后的推文列表
   */
  _enrichTweets(tweets, includes) {
    if (!tweets || tweets.length === 0) {
      return [];
    }

    const media = includes.media || [];
    const users = includes.users || [];
    const referencedTweets = includes.tweets || [];

    // 创建查找表
    const mediaLookup = {};
    media.forEach(item => {
      mediaLookup[item.media_key] = item;
    });

    const userLookup = {};
    users.forEach(user => {
      userLookup[user.id] = user;
    });

    const tweetLookup = {};
    referencedTweets.forEach(tweet => {
      tweetLookup[tweet.id] = tweet;
    });

    // 丰富推文数据
    return tweets.map(tweet => {
      // 添加用户信息
      if (tweet.author_id && userLookup[tweet.author_id]) {
        tweet.author = userLookup[tweet.author_id];
      }

      // 添加媒体信息
      if (tweet.attachments && tweet.attachments.media_keys) {
        tweet.media = tweet.attachments.media_keys
          .map(key => mediaLookup[key])
          .filter(Boolean);
      }

      // 添加引用推文信息
      if (tweet.referenced_tweets) {
        tweet.referenced_tweets = tweet.referenced_tweets.map(ref => {
          if (tweetLookup[ref.id]) {
            return {
              ...ref,
              ...tweetLookup[ref.id]
            };
          }
          return ref;
        });
      }

      return tweet;
    });
  }
}

module.exports = TwitterClient;
