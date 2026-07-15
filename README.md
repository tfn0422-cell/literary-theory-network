# 西方现当代文论概念谱系网络

这是一个纯静态、无外部 JavaScript 依赖的网站，可直接部署到任意静态网站托管平台。

## 文件说明

- `index.html`：网站入口
- `styles.css`：全部样式
- `app.js`：交互逻辑与 Canvas 网络图
- `data.json`：概念节点、关系边与网络指标
- `404.html`：静态托管兼容页

## 本地预览

由于网站使用 `fetch("./data.json")`，推荐用本地静态服务器预览：

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## 部署

### GitHub Pages

1. 新建公开仓库
2. 把本文件夹内全部文件上传到仓库根目录
3. 在 Settings → Pages 中选择 `Deploy from a branch`
4. 选择 `main` 和 `/root`
5. 保存后获得公开网址

### Vercel / Netlify / 腾讯云静态网站

直接上传整个文件夹或压缩包即可，无需构建命令。

## 微信分享

部署成功后，把公开网址发送到微信即可。网站已针对手机宽度和微信内置浏览器进行响应式适配。

Deployment update
