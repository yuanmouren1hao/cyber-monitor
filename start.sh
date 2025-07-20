#!/bin/bash

# 定义项目根目录
PROJECT_ROOT="/usr/local/app/workspace/plan_1f0ec8ac1ae3e7e00c0f05bdfe1b450e/stage_5"

# 进入项目根目录
cd "$PROJECT_ROOT" || { echo "Error: Could not change to project directory."; exit 1; }

echo "Starting Twitter Monitor System setup..."

# 检查并安装 Node.js 依赖
echo "Installing Node.js dependencies..."
npm install

# 检查 .env 文件是否存在，如果不存在则从 .env.example 创建
if [ ! -f .env ]; then
    echo "'.env' file not found. Creating from '.env.example'."
    cp .env.example .env
    echo "Please edit the '.env' file with your actual API keys and settings."
    echo "You can find the .env file at: $PROJECT_ROOT/.env"
    exit 0 # 退出，让用户配置 .env 文件
fi

# 启动 Node.js 应用
echo "Starting Node.js application..."
npm start