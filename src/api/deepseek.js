/**
 * Deepseek API客户端
 * 负责与Deepseek API进行交互，实现内容分析功能
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../utils/config');

class DeepseekClient {
  constructor() {
    // 修改这一行
    this.apiKey = config.get('deepseek.apiKey') || process.env.DEEPSEEK_API_KEY;
    this.baseUrl = 'https://api.deepseek.com/v1';
  }

  /**
   * 执行通用API调用
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} - API响应
   */
  async _callAPI(endpoint, data) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data,
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      logger.error(`Deepseek API调用失败: ${error.message}`);
      if (error.response) {
        logger.error(`响应状态: ${error.response.status}, 响应数据: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 执行情感分析
   * @param {string} text - 要分析的文本
   * @returns {Promise<Object>} - 情感分析结果
   */
  async analyzeSentiment(text) {
    const prompt = `请对以下文本进行情感分析，判断其情感倾向(positive、negative或neutral)，并给出分析理由：

${text}

请以JSON格式返回结果，包含sentiment(情感)和reason(理由)字段。`;
    
    const data = {
      model: "deepseek-chat",
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    };
    
    try {
      const response = await this._callAPI('chat/completions', data);
      const result = JSON.parse(response.choices[0].message.content);
      return {
        sentiment: result.sentiment || 'neutral',
        reason: result.reason || '无法分析'
      };
    } catch (error) {
      logger.error(`解析情感分析结果失败: ${error.message}`);
      return {
        sentiment: 'neutral',
        reason: '解析结果失败，默认为中性'
      };
    }
  }

  /**
   * 提取关键词
   * @param {string} text - 要分析的文本
   * @param {number} [maxKeywords=5] - 最大关键词数量
   * @returns {Promise<Array<string>>} - 关键词列表
   */
  async extractKeywords(text, maxKeywords = 5) {
    const prompt = `请从以下文本中提取最多${maxKeywords}个关键词，并按重要性排序。请以JSON格式返回结果，包含keywords数组字段：

${text}`;
    
    const data = {
      model: "deepseek-chat",
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    };
    
    try {
      const response = await this._callAPI('chat/completions', data);
      const result = JSON.parse(response.choices[0].message.content);
      return Array.isArray(result.keywords) ? result.keywords : [];
    } catch (error) {
      logger.error(`解析关键词提取结果失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 生成文本摘要
   * @param {string} text - 要摘要的文本
   * @param {number} [maxLength=150] - 摘要最大长度
   * @returns {Promise<string>} - 生成的摘要
   */
  async generateSummary(text, maxLength = 150) {
    const prompt = `请为以下文本生成一个简洁的摘要，最多${maxLength}个字符：

${text}`;
    
    const data = {
      model: "deepseek-chat",
      messages: [
        { role: "user", content: prompt }
      ]
    };
    
    try {
      const response = await this._callAPI('chat/completions', data);
      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error(`生成摘要失败: ${error.message}`);
      return text.substring(0, maxLength) + '...';
    }
  }

  /**
   * 执行完整内容分析
   * @param {string} text - 要分析的文本
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} - 分析结果
   */
  async analyzeContent(text, options = {}) {
    const {
      includeSentiment = true,
      includeKeywords = true,
      includeSummary = true,
      maxKeywords = 5,
      maxSummaryLength = 150
    } = options;

    const result = {};
    const tasks = [];

    if (includeSentiment) {
      tasks.push(
        this.analyzeSentiment(text).then(data => {
          result.sentiment = data.sentiment;
          result.sentimentReason = data.reason;
        }).catch(error => {
          logger.error(`情感分析失败: ${error.message}`);
          result.sentiment = 'neutral';
          result.sentimentReason = '分析失败';
        })
      );
    }

    if (includeKeywords) {
      tasks.push(
        this.extractKeywords(text, maxKeywords).then(keywords => {
          result.keywords = keywords;
        }).catch(error => {
          logger.error(`关键词提取失败: ${error.message}`);
          result.keywords = [];
        })
      );
    }

    if (includeSummary) {
      tasks.push(
        this.generateSummary(text, maxSummaryLength).then(summary => {
          result.summary = summary;
        }).catch(error => {
          logger.error(`摘要生成失败: ${error.message}`);
          result.summary = text.substring(0, maxSummaryLength) + '...';
        })
      );
    }

    await Promise.allSettled(tasks);
    return result;
  }
}

module.exports = new DeepseekClient();