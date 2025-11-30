# FlixPilot

🎬 私人流媒体管理中心 - Emby/Jellyfin 辅助管理工具

## 功能特性

- 📺 Emby/Jellyfin 用户管理
- 🎬 求片系统（对接 MoviePilot）
- 📊 播放统计与排行
- 🎫 工单系统
- 📢 公告系统
- 💳 充值卡系统
- 📱 设备管理
- 📚 知识库

## 快速开始

### Docker Compose 部署

```bash
mkdir flixpilot && cd flixpilot
```

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  flixpilot:
    image: huanhq99/flixpilot:latest
    container_name: flixpilot
    restart: always
    ports:
      - "3005:3005"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai

  redis:
    image: redis:alpine
    container_name: flixpilot-redis
    restart: always
    volumes:
      - ./redis:/data
```

启动服务：

```bash
docker compose up -d
```

访问 `http://your-ip:3005`

## 默认账号

首次启动会自动创建管理员账号：
- 用户名：`admin`
- 密码：`admin123`

> ⚠️ 请登录后立即修改密码

## 授权说明

FlixPilot 需要有效授权才能使用完整功能。

请在设置页面填写您的授权信息。

## 技术支持

- Telegram 群组：[FlixPilot 交流群](https://t.me/flixpilot)

## License

本项目仅供学习交流使用，请勿用于商业用途。
