// /usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_5/src/index.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const config = require('./utils/config');
const logger = require('./utils/logger');
const db = require('./db/database');
const integratedService = require('./services/integrated-service');
const notificationService = require('./services/notification-service');
const accountManager = require('./services/account-manager'); // 引入 accountManager
const analysisService = require('./services/analysis-service'); // 引入 analysisService

const app = express();
const PORT = config.get('PORT', 3000);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // 静态文件服务

// API Routes

// Dashboard Stats
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const monitoredAccountsCount = (await db.getAllTwitterAccounts()).length;
        const processedTweetsCount = await db.getTweetsCount();
        const latestAnalysis = await db.getLatestTweetAnalysis();
        res.json({
            monitoredAccountsCount,
            processedTweetsCount,
            latestAnalysis
        });
    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
    }
});

// Monitor Control
app.post('/api/monitor/start', async (req, res) => {
    try {
        // 这里可以添加定时任务启动逻辑，例如使用 node-cron
        // 为了简化，这里直接调用一次
        integratedService.startMonitoringAndAnalysis();
        res.json({ success: true, message: 'Monitoring started (single run).' });
    } catch (error) {
        logger.error('Error starting monitor:', error);
        res.status(500).json({ success: false, message: 'Failed to start monitor.' });
    }
});

app.post('/api/monitor/stop', (req, res) => {
    // 如果有定时任务，这里需要停止它
    res.json({ success: true, message: 'Monitoring stopped (if running as a continuous process, this would stop the scheduler).' });
});

// Account Management
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await db.getAllTwitterAccounts();
        res.json(accounts);
    } catch (error) {
        logger.error('Error fetching accounts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch accounts.' });
    }
});

app.post('/api/accounts', async (req, res) => {
    const { username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret } = req.body;
    try {
        const newAccount = await db.addTwitterAccount(username, twitterUserId, consumerKey, consumerSecret, accessToken, accessSecret);
        res.status(201).json({ success: true, message: 'Account added successfully.', account: newAccount });
    } catch (error) {
        logger.error('Error adding account:', error);
        res.status(500).json({ success: false, message: 'Failed to add account.' });
    }
});

app.delete('/api/accounts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.deleteTwitterAccount(id);
        res.json({ success: true, message: 'Account deleted successfully.' });
    } catch (error) {
        logger.error('Error deleting account:', error);
        res.status(500).json({ success: false, message: 'Failed to delete account.' });
    }
});

// Tweet Browsing
app.get('/api/tweets', async (req, res) => {
    const { accountId } = req.query;
    try {
        let tweets;
        if (accountId) {
            tweets = await db.getTweetsByAccountId(accountId);
        } else {
            tweets = await db.getAllTweets();
        }
        res.json(tweets);
    } catch (error) {
        logger.error('Error fetching tweets:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tweets.' });
    }
});

app.get('/api/tweets/:tweetId/analysis', async (req, res) => {
    const { tweetId } = req.params;
    try {
        const analysis = await db.getTweetAnalysis(tweetId);
        res.json(analysis);
    } catch (error) {
        logger.error(`Error fetching analysis for tweet ${tweetId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch tweet analysis.' });
    }
});

// System Settings
app.get('/api/settings/deepseek', (req, res) => {
    res.json({ apiKey: config.get('DEEPSEEK_API_KEY', '') });
});

app.post('/api/settings/deepseek', (req, res) => {
    const { apiKey } = req.body;
    config.set('DEEPSEEK_API_KEY', apiKey);
    res.json({ success: true, message: 'Deepseek API Key saved.' });
});

app.get('/api/settings/ntfy', (req, res) => {
    res.json({
        ntfyServer: config.get('NTFY_SERVER', ''),
        ntfyTopic: config.get('NTFY_TOPIC', '')
    });
});

app.post('/api/settings/ntfy', (req, res) => {
    const { ntfyServer, ntfyTopic } = req.body;
    config.set('NTFY_SERVER', ntfyServer);
    config.set('NTFY_TOPIC', ntfyTopic);
    res.json({ success: true, message: 'ntfy settings saved.' });
});

app.post('/api/settings/ntfy/test', async (req, res) => {
    try {
        await notificationService.sendNotification('Test Notification', 'This is a test notification from your Twitter Monitor System.', 'default', 'tada');
        res.json({ success: true, message: 'Test notification sent.' });
    } catch (error) {
        logger.error('Error sending test ntfy notification:', error);
        res.status(500).json({ success: false, message: 'Failed to send test notification.' });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Initialize database and start server
db.initDb().then(() => {
    app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
        logger.info('Access the dashboard at /');
    });
}).catch(err => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down server...');
    await db.closeDb();
    process.exit(0);
});