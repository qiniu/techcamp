# 第二次任务书

## 任务时长

3 天（2025-07-21 到 2025-07-23）

## 任务概述

本次任务将继续深入实践 LLGo 工具链，重点解决 Python 环境的自动化配置问题。

## LLGo 工具链实践

- 编写更复杂的 Go 调用 Python 示例
- 试用 llpyg 工具，测试为一些库生成封装代码（可结合 llcppg 一起看）
- 记录使用体验和发现的问题

## Python 环境配置调研

- 调研在没有预装系统级 Python 环境（如通过 Homebrew 安装）的情况下，如何自动配置 Python 环境
- 重点关注能否适配 LLGo 构建流程，以及多平台支持

## Cursor 工具体验（可选）

- 下载试用 Cursor 编辑器
- 体验 AI 辅助功能：项目分析、需求理解、代码编写等
- 记录是否有帮助，不强制要求

## 预期成果

- 2 个复杂的 Go 调用 Python 示例
- llpyg 试用报告
- Python 环境配置方案调研总结
- 简短的任务总结：哪些方案可行，哪些还不成熟，下一步建议

## 相关链接

- llpyg：https://github.com/goplus/llgo/tree/5eb833a9845681c586956fc3026c585adb26da9b/chore/llpyg
- llcppg：https://github.com/goplus/llcppg
