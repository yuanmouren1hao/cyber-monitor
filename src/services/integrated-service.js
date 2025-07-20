// /usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_5/src/services/integrated-service.js
const monitorService = require('./monitor-service');
const analysisService = require('./analysis-service');
const notificationService = require('./notification-service');
const db = require('../db/database');
const logger = require('../utils/logger');

class IntegratedService {
    constructor() {
        this.isMonitoring = false;
    }

    async startMonitoringAndAnalysis() {
        if (this.isMonitoring) {
            logger.info('Monitoring and analysis already running.');
            return;
        }
        this.isMonitoring = true;
        logger.info('Starting integrated monitoring and analysis service...');

        // 获取所有配置的Twitter账号
        const accounts = await db.getAllTwitterAccounts();
        if (accounts.length === 0) {
            logger.warn('No Twitter accounts configured. Please add accounts to start monitoring.');
            this.isMonitoring = false;
            return;
        }

        for (const account of accounts) {
            logger.info(`Monitoring tweets for @${account.username} (ID: ${account.twitter_user_id})...`);
            try {
                // 1. 获取最新推文
                const newTweets = await monitorService.getAndStoreLatestTweets(account.twitter_user_id, account.username);
                logger.info(`Found ${newTweets.length} new tweets for @${account.username}.`);

                for (const tweet of newTweets) {
                    // 2. 发送新推文通知
                    await notificationService.sendNewTweetNotification(tweet, account.username);

                    // 3. 分析推文内容
                    logger.info(`Analyzing tweet ID: ${tweet.tweet_id}`);
                    const analysisResult = await analysisService.analyzeTweet(tweet.text);

                    // 4. 存储分析结果
                    await db.saveTweetAnalysis(tweet.tweet_id, analysisResult);
                    logger.info(`Analysis saved for tweet ID: ${tweet.tweet_id}`);

                    // 5. 发送分析结果通知
                    await notificationService.sendAnalysisResultNotification(tweet, analysisResult);
                }
            } catch (error) {
                logger.error(`Error during monitoring and analysis for @${account.username}: ${error.message}`);
                await notificationService.sendSystemNotification('error', `Monitoring error for @${account.username}: ${error.message}`);
            }
        }
        this.isMonitoring = false;
        logger.info('Integrated monitoring and analysis service finished a cycle.');
    }

    async getMonitoredAccounts() {
        return db.getAllTwitterAccounts();
    }

    async getTweetsByAccountId(accountId) {
        return db.getTweetsByAccountId(accountId);
    }

    async getTweetAnalysis(tweetId) {
        return db.getTweetAnalysis(tweetId);
    }

    async addTwitterAccount(username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret) {
        return db.addTwitterAccount(username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret);
    }

    async deleteTwitterAccount(accountId) {
        return db.deleteTwitterAccount(accountId);
    }

    async updateTwitterAccount(accountId, username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret) {
        return db.updateTwitterAccount(accountId, username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret);
    }
}

module.exports = new IntegratedService();