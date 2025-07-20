# Twitter 监控分析系统

## 简介

这是一个基于 Node.js 构建的 Twitter 监控分析系统。它能够监控指定 Twitter 用户的推文内容，利用 Deepseek API 对推文进行情感分析、关键词提取和自动摘要，并通过 ntfy 服务将分析结果实时推送到您的手机。系统提供一个简单的 Web 界面，用于配置监控账号、查看推文和分析结果，以及管理系统设置。

## 功能特性

*   **多账号监控**：支持配置和监控多个 Twitter 账号的推文。
*   **实时推文获取**：自动获取并存储被监控账号的最新推文。
*   **Deepseek 内容分析**：
    *   **情感分析**：识别推文的情感倾向（积极、消极、中立）。
    *   **关键词提取**：从推文中提取关键信息点。
    *   **自动摘要**：生成推文内容的简洁摘要。
*   **ntfy 实时通知**：将新推文和分析结果实时推送到您的手机。
*   **Web 管理界面**：
    *   仪表盘：概览监控状态和最新分析结果。
    *   账号管理：添加、编辑和删除监控的 Twitter 账号。
    *   推文浏览：查看所有已获取推文及其分析结果。
    *   系统设置：配置 Deepseek API Key 和 ntfy 服务。
*   **SQLite 数据库**：轻量级数据库，用于存储账号信息、推文数据和分析结果。

## 系统架构

![系统架构图](/usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_1/system_architecture.png)

## 数据库设计

![数据库ER图](/usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_1/database_er_diagram.png)

### 数据库表结构

| 表名           | 字段                 | 类型      | 描述                               |
| :------------- | :------------------- | :-------- | :--------------------------------- |
| `twitter_accounts` | `id`                 | INTEGER   | 主键，自增                         |
|                | `username`           | TEXT      | Twitter 用户名                     |
|                | `twitter_user_id`    | TEXT      | Twitter 用户ID                     |
|                | `consumer_key`       | TEXT      | Twitter API Consumer Key           |
|                | `consumer_secret`    | TEXT      | Twitter API Consumer Secret        |
|                | `access_token`       | TEXT      | Twitter API Access Token           |
|                | `access_secret`      | TEXT      | Twitter API Access Secret          |
|                | `created_at`         | TIMESTAMP | 记录创建时间                       |
| `tweets`       | `id`                 | INTEGER   | 主键，自增                         |
|                | `tweet_id`           | TEXT      | 推文ID (唯一)                      |
|                | `account_id`         | INTEGER   | 关联的 Twitter 账号ID              |
|                | `author_username`    | TEXT      | 推文作者用户名                     |
|                | `text`               | TEXT      | 推文内容                           |
|                | `created_at`         | TIMESTAMP | 推文发布时间                       |
|                | `tweet_url`          | TEXT      | 推文链接                           |
| `tweet_analysis` | `id`                 | INTEGER   | 主键，自增                         |
|                | `tweet_id`           | TEXT      | 关联的推文ID (唯一)                |
|                | `sentiment`          | TEXT      | 情感分析结果                       |
|                | `keywords`           | TEXT      | 关键词 (JSON 字符串或逗号分隔)     |
|                | `summary`            | TEXT      | 自动摘要                           |
|                | `analysis_time`      | TIMESTAMP | 分析时间                           |
| `system_settings` | `key`                | TEXT      | 设置项的键 (唯一)                  |
|                | `value`              | TEXT      | 设置项的值                         |

## 安装指南

### 前提条件

*   Node.js (v14 或更高版本)
*   npm (Node.js 包管理器)
*   Twitter Developer Account 和 App (用于获取 API 凭据)
*   Deepseek API Key (用于内容分析)
*   ntfy 服务 (可选，用于手机通知)

### 步骤

1.  **克隆仓库**

    ```bash
    git clone <仓库地址>
    cd twitter-monitor-system
    ```

2.  **安装依赖**

    ```bash
    npm install
    ```

3.  **配置环境变量**

    复制 `.env.example` 文件并重命名为 `.env`：

    ```bash
    cp .env.example .env
    ```

    编辑 `.env` 文件，填入您的 API 凭据和设置：

    ```ini
    # Twitter API Credentials
    TWITTER_CONSUMER_KEY=YOUR_TWITTER_CONSUMER_KEY
    TWITTER_CONSUMER_SECRET=YOUR_TWITTER_CONSUMER_SECRET
    TWITTER_ACCESS_TOKEN=YOUR_TWITTER_ACCESS_TOKEN
    TWITTER_ACCESS_SECRET=YOUR_TWITTER_ACCESS_SECRET

    # Deepseek API Key
    DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY

    # ntfy Notification Settings (Optional)
    NTFY_SERVER=https://ntfy.sh # 或您自建的 ntfy 服务器地址
    NTFY_TOPIC=my_twitter_alerts # 您自定义的 ntfy 主题

    # Database Configuration
    DATABASE_PATH=./data/database.sqlite

    # Server Port
    PORT=3000

    # Monitoring Interval in milliseconds (e.g., 3600000 for 1 hour)
    MONITOR_INTERVAL=3600000
    ```

    *   **Twitter API 凭据**：您需要前往 [Twitter Developer Portal](https://developer.twitter.com/) 创建一个项目和应用，并获取 Consumer Key, Consumer Secret, Access Token 和 Access Secret。确保您的应用具有“读写”权限。
    *   **Deepseek API Key**：从 [Deepseek 官网](https://www.deepseek.com/) 获取您的 API Key。
    *   **ntfy 设置**：如果您想接收手机通知，请配置 ntfy 服务器地址和主题。您可以选择使用公共的 ntfy.sh 服务，也可以搭建自己的 ntfy 服务器。

4.  **初始化数据库**

    系统启动时会自动初始化 SQLite 数据库文件（如果不存在）。

## 使用方法

1.  **启动系统**

    ```bash
    npm start
    ```

    或者，如果您安装了 `nodemon` (用于开发环境热重载)：

    ```bash
    npm run dev
    ```

    系统启动后，您将在控制台看到类似以下输出：

    ```
    [INFO] Server is running on http://localhost:3000
    [INFO] Access the dashboard at /
    ```

2.  **访问 Web 界面**

    在浏览器中打开 `http://localhost:3000` (如果您的端口是 3000)。

3.  **配置监控账号**

    *   进入“账号管理”页面。
    *   点击“添加新账号”按钮。
    *   填写您要监控的 Twitter 账号的用户名、Twitter 用户 ID 以及对应的 Twitter API 凭据。
    *   点击“保存账号”。

4.  **启动监控**

    *   回到“仪表盘”页面。
    *   点击“开始监控”按钮。系统将开始获取推文并进行分析。
    *   **注意**：目前系统设计为手动触发一次监控循环。如果您需要持续监控，可以考虑在 `src/app.js` 中集成 `node-cron` 等库来设置定时任务。

5.  **查看推文和分析结果**

    *   进入“推文浏览”页面。
    *   您可以选择查看所有账号的推文，或通过下拉菜单选择特定账号的推文。
    *   表格将显示推文内容、作者、发布时间以及 Deepseek 分析结果（情感、关键词、摘要）。
    *   点击“查看详情”可以查看推文的完整内容和分析结果。

6.  **配置系统设置**

    *   进入“系统设置”页面。
    *   在这里您可以修改 Deepseek API Key 和 ntfy 通知设置。
    *   保存设置后，可以点击“测试通知”按钮来验证 ntfy 服务是否正常工作。

## 项目结构

```
twitter-monitor-system/
├── src/
│   ├── api/
│   │   ├── deepseek.js         # Deepseek API 客户端
│   │   └── twitter.js         # Twitter API 客户端
│   ├── db/
│   │   └── database.js        # SQLite 数据库连接和操作
│   ├── public/                # 静态文件 (CSS, JS)
│   │   ├── css/
│   │   └── js/
│   ├── services/
│   │   ├── account-manager.js # 账号管理服务
│   │   ├── analysis-service.js# 推文分析服务 (Deepseek)
│   │   ├── integrated-service.js# 整合监控、分析和通知的核心服务
│   │   ├── monitor-service.js # Twitter 推文监控服务
│   │   └── notification-service.js # ntfy 通知服务
│   ├── utils/
│   │   ├── config.js          # 配置管理工具
│   │   └── logger.js          # 日志工具
│   ├── views/
│   │   └── index.html         # 前端 HTML 界面
│   └── app.js                 # Express 应用主入口，定义路由和启动服务
├── .env.example               # 环境变量配置示例
├── package.json               # 项目依赖和脚本
├── start.sh                   # 启动脚本
├── README.md                  # 项目说明文档
└── data/                      # 数据库文件存放目录 (自动创建)
    └── database.sqlite
```

## 许可证

本项目采用 MIT 许可证。

## 贡献

欢迎提交 Pull Request 或报告 Bug。

## 鸣谢

*   [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api)
*   [Deepseek API](https://www.deepseek.com/)
*   [ntfy](https://ntfy.sh/)
*   [Node.js](https://nodejs.org/)
*   [Express.js](https://expressjs.com/)
*   [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
*   [axios](https://axios-http.com/)
*   [dotenv](https://github.com/motdotla/dotenv)
*   [nodemon](https://nodemon.io/)