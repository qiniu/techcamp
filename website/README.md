# 1024 TechCamp Website

这是 1024 实训营的官方网站，使用 [Docusaurus](https://docusaurus.io/) 构建。

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

此命令启动本地开发服务器并打开浏览器窗口。大多数更改会实时反映，无需重启服务器。

### 构建

```bash
npm run build
```

此命令将静态内容生成到 `build` 目录，可以使用任何静态内容托管服务提供服务。

## 部署

### GitHub Pages 自动部署

创建 `.github/workflows/deploy.yml` 文件（需要 workflow 权限）：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: website
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: website/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build website
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: website/build

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 手动部署

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

## 添加内容

### 添加博客文章

在 `blog/` 目录下创建新的 Markdown 文件：

```markdown
---
slug: my-post
title: 我的文章标题
authors: [techcamp]
tags: [tag1, tag2]
---

文章摘要

<!-- truncate -->

文章正文...
```

### 添加文档页面

在 `docs/` 目录下创建新的 Markdown 文件，并在 frontmatter 中指定位置：

```markdown
---
sidebar_position: 4
---

# 页面标题

页面内容...
```

## 许可证

Apache-2.0
