# 在线双人五子棋

无需登录的双人在线五子棋游戏，支持创建 / 加入房间，30秒限时落子。

## 项目目录

```
my_gomoku/
├── package.json          # 项目依赖与启动脚本
├── server.js             # Node.js 服务端：WebSocket 通信、房间管理、对局逻辑、计时器
├── .gitignore            # Git 忽略配置（排除 node_modules）
├── README.md             # 项目说明文档
└── public/               # 前端静态资源目录（Express 自动托管）
    ├── index.html        # 游戏页面结构：首页、等待页、对战页
    ├── style.css         # 响应式样式：棋盘、棋子、计时器、自适应布局
    └── game.js           # 前端交互逻辑：Socket.io 通信、棋盘渲染、落子与计时同步
```

## 本地运行

```bash
npm install
npm start
```

打开浏览器访问 `http://localhost:3000`

## 部署到 Render

1. 将整个项目推送到 GitHub 仓库。
2. 在 [Render](https://render.com) 创建 **New Web Service**。
3. 连接你的 GitHub 仓库。
4. 设置：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 点击 **Create Web Service**。

服务启动后，Render 会提供一个公网 URL，双方打开同一 URL 即可开始游戏。

## 游戏规则

- 黑棋（玩家1）先手，双方轮流落子。
- 每步限时 **30秒**，超时则系统自动在随机空位落子。
- 先连成五子者获胜（横、竖、斜均可）。
- 棋盘布满且无人连五为平局。
