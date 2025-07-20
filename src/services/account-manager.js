/**
 * 账号管理服务
 * 负责管理监控的Twitter账号
 */

const database = require('../db/database');
const TwitterClient = require('../api/twitter');
const logger = require('../utils/logger');

class AccountManager {
  constructor() {
    this.twitterClient = new TwitterClient();
  }

  /**
   * 添加监控账号
   * @param {string|Object} usernameOrData - Twitter用户名或包含账号信息的对象
   * @returns {Promise<Object>} 添加的账号信息
   */
  async addAccount(usernameOrData) {
    try {
      let username;
      
      // 处理不同的输入格式
      if (typeof usernameOrData === 'string') {
        username = usernameOrData;
      } else if (typeof usernameOrData === 'object' && usernameOrData.username) {
        username = usernameOrData.username;
      } else {
        throw new Error('缺少用户名参数');
      }

      // 检查账号是否已存在
      const existing = await this.getAccountByUsername(username);
      if (existing) {
        throw new Error(`账号 ${username} 已在监控列表中`);
      }

      // 从Twitter获取用户信息
      const userInfo = await this.twitterClient.getUserByUsername(username);
      
      // 保存到数据库
      const sql = `
        INSERT INTO monitored_accounts 
        (username, user_id, display_name, profile_image_url, description, 
         followers_count, following_count, tweet_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        userInfo.username,
        userInfo.id,
        userInfo.name,
        userInfo.profile_image_url,
        userInfo.description,
        userInfo.public_metrics?.followers_count || 0,
        userInfo.public_metrics?.following_count || 0,
        userInfo.public_metrics?.tweet_count || 0
      ];

      const result = await database.run(sql, params);
      
      logger.info(`成功添加监控账号: ${username}`, { userId: userInfo.id });
      
      return {
        id: result.lastID,
        ...userInfo
      };
    } catch (error) {
      logger.error(`添加监控账号失败: ${error.message}`, { username: usernameOrData, error });
      throw error;
    }
  }

  /**
   * 移除监控账号
   * @param {string} username - Twitter用户名
   * @returns {Promise<boolean>} 是否成功移除
   */
  async removeAccount(username) {
    try {
      const sql = 'DELETE FROM monitored_accounts WHERE username = ?';
      const result = await database.run(sql, [username]);
      
      if (result.changes > 0) {
        logger.info(`成功移除监控账号: ${username}`);
        return true;
      } else {
        logger.warn(`账号不存在: ${username}`);
        return false;
      }
    } catch (error) {
      logger.error(`移除监控账号失败: ${error.message}`, { username, error });
      throw error;
    }
  }

  /**
   * 获取所有监控账号
   * @returns {Promise<Array>} 监控账号列表
   */
  async getAllAccounts() {
    try {
      const sql = 'SELECT * FROM monitored_accounts WHERE is_active = 1 ORDER BY created_at DESC';
      const accounts = await database.query(sql);
      return accounts;
    } catch (error) {
      logger.error(`获取监控账号列表失败: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * 根据用户名获取账号信息
   * @param {string} username - Twitter用户名
   * @returns {Promise<Object|null>} 账号信息
   */
  async getAccountByUsername(username) {
    try {
      const sql = 'SELECT * FROM monitored_accounts WHERE username = ?';
      const accounts = await database.query(sql, [username]);
      return accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      logger.error(`获取账号信息失败: ${error.message}`, { username, error });
      throw error;
    }
  }

  /**
   * 更新账号的最后推文ID
   * @param {string} username - Twitter用户名
   * @param {string} lastTweetId - 最后推文ID
   * @returns {Promise<boolean>} 是否成功更新
   */
  async updateLastTweetId(username, lastTweetId) {
    try {
      const sql = `
        UPDATE monitored_accounts 
        SET last_tweet_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE username = ?
      `;
      const result = await database.run(sql, [lastTweetId, username]);
      return result.changes > 0;
    } catch (error) {
      logger.error(`更新最后推文ID失败: ${error.message}`, { username, lastTweetId, error });
      throw error;
    }
  }

  /**
   * 启用/禁用账号监控
   * @param {string} username - Twitter用户名
   * @param {boolean} isActive - 是否启用
   * @returns {Promise<boolean>} 是否成功更新
   */
  async toggleAccountStatus(username, isActive) {
    try {
      const sql = `
        UPDATE monitored_accounts 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE username = ?
      `;
      const result = await database.run(sql, [isActive ? 1 : 0, username]);
      
      if (result.changes > 0) {
        logger.info(`账号状态更新成功: ${username} -> ${isActive ? '启用' : '禁用'}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`更新账号状态失败: ${error.message}`, { username, isActive, error });
      throw error;
    }
  }
}

module.exports = AccountManager;
