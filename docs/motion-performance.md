# 动画场景与页面解耦

## 渲染边界

- `motion-controller.js` 只测量布局、收集输入、定位 DOM 彗星，并启动浏览器原生的 Head 平滑滚动。首页静止时不运行永久的主线程动画循环。
- `motion-layout.js` 在页面布局变化时读取当前语言的文字，按真实换行栅格化并转移 ImageBitmap。主线程不调用 getImageData、不采样粒子。
- `particle-worker.js` 用独立的 requestAnimationFrame 驱动整个场景。输入消息只传位置、指针和状态，主线程不再逐帧传送粒子数组。
- `motion-scene.js` 在 Worker 中完成星空、凝字、鼠标扰动、覆盖率和彗星历史计算。运动按经过时间积分，适用于不同刷新率。
- `scene-renderer.js` 用一张 WebGL2 画布绘制所有星点、字形和尾迹。完整字形只上传一次；动画中仅更新小尺寸的 alpha 蒙版。
- `scene-tail.js` 一次采样开场 SVG 曲线；离场尾迹共享中心轨迹，GPU 通过实例绘制展开全部细丝。前后两段使用一致的曲线进度，在缩放后的布局上也保持连接。

## 页面先可用，动画再增强

默认 HTML 文字和静态星空始终存在。仅在后台完整画面就绪后隐藏原生文字；Worker 下载失败、图形上下文丢失或浏览器不支持时恢复原生内容，不再转入更重的主线程 Canvas 动画回退。

启动期间的等待与淡入由有限时长的 CSS 动画完成。准备过晚时显示已经出现的正文，不在用户开始阅读后重新把文字拆散。暂停与减少动态停止循环；切走标签页时停止后台绘制。

不按浏览器型号或显卡名称做特殊处理，也不使用固定的 180Hz 分支。Worker 遵循浏览器显示时钟，并用 WebGL2 fence 的零超时查询确认上一帧 GPU 工作是否完成，避免堆积未完成的绘制。连续 GPU 压力只降低画布的背板分辨率（不低于一个 CSS 像素对应一个画布像素），保留所有星点和细丝；稳定后恢复。fence 完成仍不等同于屏幕呈现，所以不把渲染标签当作流畅度证明。

## 同配置生产包对比

2026-09-11，Edge 152.0.4191.66，2550 × 1275，DPR 1.25，中文、新浏览器页面。基线是提交 `9084a78`，从独立目录构建；候选版本使用同一套外部探针。依次采样开场约 6.2 秒和 Head 离场约 1.6 秒，不并行运行浏览器检查。

| 指标 | 基线 | 新场景 |
| --- | ---: | ---: |
| 开场主线程动画回调 P95 | 7.7 ms | 0.9 ms |
| 开场主线程动画回调最大值 | 26.3 ms | 3.1 ms |
| 开场主线程动画回调总时间 | 815.8 ms | 354.7 ms |
| Head 离场主线程回调 P95 | 4.1 ms | 3.0 ms |
| Head 离场主线程回调总时间 | 131.3 ms | 109.0 ms |
| Head 离场长任务 | 0 | 0 |
| 主线程字形像素读取 | 10 次 | 0 次 |
| 开场粒子数组跨线程传输 | 约 43 MB | 0 |
| 新场景 Head 离场脚本 scrollTo 调用 | — | 1 次 |

主线程样本覆盖所有 requestAnimationFrame 回调，包括旧版帧控制跳过的回调，不能据此直接宣称实际 FPS。新场景的 Worker 回调平均约 1.97 ms、P95 6.5 ms；原版本 Worker 没有独立显示循环，两者的 Worker 回调指标不能直接比较。首屏仍存在初始化长任务（该次采样 213→171 ms），此改动不声称完全消除所有机器上的卡顿。

## 有行为依据的检查

`scripts/check-motion-browser.mjs` 检查生产包：

- 实际读取 GPU 字形区域，确认文字存在、扰动时笔画减少、离开后恢复。
- 人为占用页面线程 220 ms，确认 Worker 继续出帧。
- 静止后页面线程不继续循环；像素读取和粒子数组传输保持为零。
- 原生 Head 离场、准确落点、彗星停靠、窗口变化和重播。
- 图形上下文丢失与恢复、Worker 不可用/下载失败、无 JavaScript 和减少动态的可读内容。
- 英文移动端粒子文字跟随真实换行，不超出屏幕。

探针仅在测试 HTTP 响应中注入，不随网站发布。GPU 像素读取只用于行为验证，不用于性能采样。

使用已安装的 Playwright；可通过 `PLAYWRIGHT_MODULE` 指定模块路径：

```sh
npm run build
node --test tests/*.test.js
node scripts/check-motion-browser.mjs
node scripts/check-i18n-browser.mjs
node scripts/profile-motion.mjs --output=motion-profile.json
node scripts/profile-motion.mjs --root=/path/to/baseline/dist
```
