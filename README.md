# 在线双人五子棋

无需登录的双人在线五子棋游戏，支持创建 / 加入房间，30秒限时落子。

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
