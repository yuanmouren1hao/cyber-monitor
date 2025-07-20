/**
 * 内容分析服务
 * 负责协调推文获取和分析流程
 */

const deepseekClient = require('../api/deepseek');
const database = require('../db/database');
const logger = require('../utils/logger');

class AnalysisService {
  constructor() {
    this.isAnalyzing = false;
  }

  /**
   * 分析单条推文
   * @param {Object} tweet - 推文对象
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} - 分析结果
   */
  async analyzeTweet(tweet, options = {}) {
    try {
      logger.info(`开始分析推文: ${tweet.id}`);
      
      // 检查是否已经分析过
      const existingAnalysis = await this.getAnalysis(tweet.id);
      if (existingAnalysis) {
        logger.info(`推文 ${tweet.id} 已经分析过，跳过`);
        return existingAnalysis;
      }

      // 执行内容分析
      const analysisResult = await deepseekClient.analyzeContent(tweet.text, options);
      
      // 保存分析结果到数据库
      const analysis = await this.saveAnalysis(tweet.id, analysisResult);
      
      logger.info(`推文 ${tweet.id} 分析完成`);
      return analysis;
      
    } catch (error) {
      logger.error(`分析推文 ${tweet.id} 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量分析推文
   * @param {Array} tweets - 推文列表
   * @param {Object} options - 分析选项
   * @returns {Promise<Array>} - 分析结果列表
   */
  async analyzeTweets(tweets, options = {}) {
    if (this.isAnalyzing) {
      logger.warn('分析服务正在运行中，跳过本次批量分析');
      return [];
    }

    this.isAnalyzing = true;
    const results = [];

    try {
      logger.info(`开始批量分析 ${tweets.length} 条推文`);
      
      for (const tweet of tweets) {
        try {
          const analysis = await this.analyzeTweet(tweet, options);
          results.push(analysis);
          
          // 添加延迟以避免API限制
          await this.delay(1000);
          
        } catch (error) {
          logger.error(`分析推文 ${tweet.id} 失败: ${error.message}`);
          continue;
        }
      }
      
      logger.info(`批量分析完成，成功分析 ${results.length} 条推文`);
      return results;
      
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 保存分析结果到数据库
   * @param {number} tweetId - 推文ID
   * @param {Object} analysisResult - 分析结果
   * @returns {Promise<Object>} - 保存的分析记录
   */
  async saveAnalysis(tweetId, analysisResult) {
    const { sentiment, sentimentReason, keywords, summary } = analysisResult;
    
    const query = `
      INSERT INTO Analysis (tweet_id, sentiment, keywords, summary, analysis_time)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;
    
    const keywordsStr = Array.isArray(keywords) ? keywords.join(',') : '';
    
    try {
      const result = await database.run(query, [
        tweetId,
        sentiment || 'neutral',
        keywordsStr,
        summary || ''
      ]);
      
      return {
        id: result.lastID,
        tweet_id: tweetId,
        sentiment: sentiment || 'neutral',
        keywords: keywords || [],
        summary: summary || '',
        sentimentReason: sentimentReason || '',
        analysis_time: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`保存分析结果失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取推文的分析结果
   * @param {number} tweetId - 推文ID
   * @returns {Promise<Object|null>} - 分析结果
   */
  async getAnalysis(tweetId) {
    const query = `
      SELECT * FROM Analysis WHERE tweet_id = ?
    `;
    
    try {
      const analysis = await database.get(query, [tweetId]);
      if (analysis) {
        analysis.keywords = analysis.keywords ? analysis.keywords.split(',') : [];
      }
      return analysis;
    } catch (error) {
      logger.error(`获取分析结果失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取所有分析结果
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} - 分析结果列表
   */
  async getAllAnalyses(options = {}) {
    const { limit = 100, offset = 0, sentiment = null } = options;
    
    let query = `
      SELECT a.*, t.text, t.created_at as tweet_created_at, t.author_id
      FROM Analysis a
      JOIN Tweets t ON a.tweet_id = t.id
    `;
    
    const params = [];
    
    if (sentiment) {
      query += ' WHERE a.sentiment = ?';
      params.push(sentiment);
    }
    
    query += ' ORDER BY a.analysis_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    try {
      const analyses = await database.all(query, params);
      return analyses.map(analysis => ({
        ...analysis,
        keywords: analysis.keywords ? analysis.keywords.split(',') : []
      }));
    } catch (error) {
      logger.error(`获取分析结果列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取分析统计信息
   * @returns {Promise<Object>} - 统计信息
   */
  async getAnalysisStats() {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM Analysis',
      positive: 'SELECT COUNT(*) as count FROM Analysis WHERE sentiment = "positive"',
      negative: 'SELECT COUNT(*) as count FROM Analysis WHERE sentiment = "negative"',
      neutral: 'SELECT COUNT(*) as count FROM Analysis WHERE sentiment = "neutral"'
    };
    
    try {
      const stats = {};
      for (const [key, query] of Object.entries(queries)) {
        const result = await database.get(query);
        stats[key] = result.count;
      }
      
      return stats;
    } catch (error) {
      logger.error(`获取分析统计信息失败: ${error.message}`);
      return { total: 0, positive: 0, negative: 0, neutral: 0 };
    }
  }

  /**
   * 删除分析结果
   * @param {number} analysisId - 分析ID
   * @returns {Promise<boolean>} - 删除是否成功
   */
  async deleteAnalysis(analysisId) {
    const query = 'DELETE FROM Analysis WHERE id = ?';
    
    try {
      const result = await database.run(query, [analysisId]);
      return result.changes > 0;
    } catch (error) {
      logger.error(`删除分析结果失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} - Promise对象
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AnalysisService();