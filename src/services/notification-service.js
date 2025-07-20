// /usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_5/src/services/notification-service.js
const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.ntfyServer = config.get('NTFY_SERVER');
        this.ntfyTopic = config.get('NTFY_TOPIC');
        if (!this.ntfyServer || !this.ntfyTopic) {
            logger.warn('NTFY_SERVER or NTFY_TOPIC not configured. Notifications will be disabled.');
        }
    }

    /**
     * 发送通知到ntfy
     * @param {string} title 通知标题
     * @param {string} message 通知内容
     * @param {string} priority 通知优先级 (e.g., 'default', 'high', 'urgent')
     * @param {string} tags 通知标签 (e.g., 'bell', 'warning')
     */
    async sendNotification(title, message, priority = 'default', tags = '') {
        if (!this.ntfyServer || !this.ntfyTopic) {
            logger.info('NTFY notifications are disabled due to missing configuration.');
            return;
        }

        const url = `${this.ntfyServer}/${this.ntfyTopic}`;
        try {
            await axios.post(url, message, {
                headers: {
                    'Title': title,
                    'Priority': priority,
                    'Tags': tags,
                    'Content-Type': 'text/plain'
                }
            });
            logger.info(`Notification sent: ${title}`);
        } catch (error) {
            logger.error(`Failed to send notification: ${error.message}`);
        }
    }

    /**
     * 发送新推文通知
     * @param {object} tweet 推文对象
     * @param {string} monitorAccountName 监控的账号名称
     */
    async sendNewTweetNotification(tweet, monitorAccountName) {
        const title = `New Tweet from ${monitorAccountName}`;
        const message = `User: @${tweet.author_username}\nText: ${tweet.text}\nLink: ${tweet.tweet_url}`;
        await this.sendNotification(title, message, 'default', 'bird');
    }

    /**
     * 发送推文分析结果通知
     * @param {object} tweet 推文对象
     * @param {object} analysisResult 分析结果
     */
    async sendAnalysisResultNotification(tweet, analysisResult) {
        const title = `Analysis Result for Tweet from @${tweet.author_username}`;
        let message = `Original Tweet: ${tweet.text}\n\n`;
        if (analysisResult.sentiment) {
            message += `Sentiment: ${analysisResult.sentiment}\n`;
        }
        if (analysisResult.keywords && analysisResult.keywords.length > 0) {
            message += `Keywords: ${analysisResult.keywords.join(', ')}\n`;
        }
        if (analysisResult.summary) {
            message += `Summary: ${analysisResult.summary}\n`;
        }
        message += `Link: ${tweet.tweet_url}`;

        await this.sendNotification(title, message, 'high', 'chart_with_upwards_trend');
    }

    /**
     * 发送系统通知
     * @param {string} type 通知类型 (e.g., 'error', 'info', 'warning')
     * @param {string} message 通知内容
     */
    async sendSystemNotification(type, message) {
        let title = `System ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        let priority = 'default';
        let tags = 'gear';

        switch (type) {
            case 'error':
                priority = 'urgent';
                tags = 'warning';
                break;
            case 'warning':
                priority = 'high';
                tags = 'warning';
                break;
            case 'info':
                priority = 'default';
                tags = 'information_source';
                break;
        }
        await this.sendNotification(title, message, priority, tags);
    }
}

module.exports = new NotificationService();