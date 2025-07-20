/**
 * Twitter监控分析系统 - 主入口文件
 * 集成Twitter API监控功能和Deepseek API分析功能
 */

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const accountManager = require('./services/account-manager');
const monitorService = require('./services/monitor-service');
const analysisService = require('./services/analysis-service');
const integratedService = require('./services/integrated-service');
const database = require('./db/database');
const config = require('./utils/config');
const logger = require('./utils/logger');

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// 视图引擎设置
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));

// API路由 - 账号管理
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await accountManager.getAllAccounts();
    res.json(accounts);
  } catch (error) {
    logger.error(`获取账号列表失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await accountManager.addAccount(req.body);
    res.status(201).json(account);
  } catch (error) {
    logger.error(`添加账号失败: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const account = await accountManager.getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: '账号不存在' });
    }
    res.json(account);
  } catch (error) {
    logger.error(`获取账号详情失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const updated = await accountManager.updateAccount(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: '账号不存在' });
    }
    res.json(updated);
  } catch (error) {
    logger.error(`更新账号失败: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const deleted = await accountManager.deleteAccount(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: '账号不存在' });
    }
    res.status(204).end();
  } catch (error) {
    logger.error(`删除账号失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API路由 - 推文监控
app.get('/api/tweets', async (req, res) => {
  try {
    const accountId = req.query.accountId;
    const limit = parseInt(req.query.limit) || 50;
    const tweets = accountId 
      ? await monitorService.getTweetsByAccount(accountId, limit)
      : await monitorService.getAllTweets(limit);
    res.json(tweets);
  } catch (error) {
    logger.error(`获取推文列表失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitor/fetch', async (req, res) => {
  try {
    const accountId = req.body.accountId;
    const tweets = accountId 
      ? await monitorService.fetchNewTweets(accountId)
      : await integratedService.triggerManualRun();
    res.json(tweets);
  } catch (error) {
    logger.error(`手动获取推文失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API路由 - 内容分析
app.get('/api/analysis', async (req, res) => {
  try {
    const tweetId = req.query.tweetId;
    const analyses = tweetId 
      ? await analysisService.getAnalysis(tweetId)
      : await analysisService.getAllAnalyses(50);
    res.json(analyses);
  } catch (error) {
    logger.error(`获取分析结果失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analysis/analyze', async (req, res) => {
  try {
    const { tweetId, options } = req.body;
    if (!tweetId) {
      return res.status(400).json({ error: '缺少推文ID' });
    }
    
    const tweet = await monitorService.getTweet(tweetId);
    if (!tweet) {
      return res.status(404).json({ error: '推文不存在' });
    }
    
    const analysis = await analysisService.analyzeTweet(tweet, options);
    res.json(analysis);
  } catch (error) {
    logger.error(`分析推文失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analysis/batch', async (req, res) => {
  try {
    const { accountId, options } = req.body;
    
    let tweets;
    if (accountId) {
      tweets = await monitorService.getTweetsByAccount(accountId, 50);
    } else {
      tweets = await monitorService.getAllTweets(50);
    }
    
    if (tweets.length === 0) {
      return res.json({ message: '没有可分析的推文', count: 0 });
    }
    
    const analyses = await analysisService.analyzeTweets(tweets, options);
    res.json({ message: '批量分析完成', count: analyses.length });
  } catch (error) {
    logger.error(`批量分析失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API路由 - 集成服务
app.post('/api/integrated/start', async (req, res) => {
  try {
    await integratedService.start(req.body);
    res.json({ message: '集成服务已启动' });
  } catch (error) {
    logger.error(`启动集成服务失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/integrated/stop', async (req, res) => {
  try {
    integratedService.stop();
    res.json({ message: '集成服务已停止' });
  } catch (error) {
    logger.error(`停止集成服务失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrated/status', async (req, res) => {
  try {
    const status = integratedService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error(`获取服务状态失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrated/stats', async (req, res) => {
  try {
    const stats = await integratedService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`获取统计信息失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 系统配置API
app.get('/api/config', async (req, res) => {
  try {
    const key = req.query.key;
    if (key) {
      const value = config.get(key);
      return res.json({ [key]: value });
    }
    
    const allConfig = await config.getAll();
    res.json(allConfig);
  } catch (error) {
    logger.error(`获取配置失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    await config.set(key, value, description);
    res.json({ [key]: value });
  } catch (error) {
    logger.error(`更新配置失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 前端路由
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/accounts', (req, res) => {
  res.render('accounts');
});

app.get('/tweets', (req, res) => {
  res.render('tweets');
});

app.get('/analysis', (req, res) => {
  res.render('analysis');
});

app.get('/settings', (req, res) => {
  res.render('settings');
});

// 初始化并启动应用
async function init() {
  try {
    // 初始化数据库
    await database.init();
    logger.info('数据库初始化成功');
    
    // 启动Web服务器
    app.listen(PORT, () => {
      logger.info(`Twitter监控分析系统启动成功，运行在端口 ${PORT}`);
    });
    
    // 是否自动启动集成服务
    const autoStart = config.get('auto_start_service') === 'true';
    if (autoStart) {
      logger.info('自动启动集成服务');
      integratedService.start();
    }
    
  } catch (error) {
    logger.error(`系统启动失败: ${error.message}`);
    process.exit(1);
  }
}

// 启动应用
init();
