# goodguide 👆

给一组图片加 **小手指示** 和 **框框标注**,逐张导出循环动画的竖屏 `mp4`。

- **CLI 启动**:指向一个图片文件夹,自动起本地服务并打开浏览器编辑器。
- **左侧图片列表**:缩略图预览,拖动排序。
- **9:16 画板**:默认 1080×1920,图片 contain 居中,背景用模糊底图(可切纯色)。
- **两种标注**:
  - 🖐 **小手** — 拖指尖到目标上;支持旋转、缩放、改色;动画沿手指方向缓缓前戳再回弹,无限循环。
  - ▭ **框框** — 圆角描边矩形,支持旋转、缩放、改色、线宽、圆角;轻微缩放脉冲。
- **自动保存**:所有配置实时写入输出目录的 `project.json`,重开自动恢复,不丢进度。
- **一键导出**:每张图片各生成一个 `mp4`(H.264 / yuv420p)。

## 安装

```bash
npm install
npm link        # 可选,获得全局 `goodguide` 命令
```

依赖系统已安装 **ffmpeg**(`brew install ffmpeg`)。可用 `FFMPEG_PATH` 环境变量指定路径。

## 使用

```bash
goodguide <输入目录> [选项]
# 或不 link 时:
node bin/cli.js <输入目录> [选项]
```

选项:

| 选项 | 说明 |
| --- | --- |
| `-o, --out <dir>` | 输出目录(默认 `<输入目录>/goodguide-out`) |
| `-p, --port <n>` | 服务端口(默认 4321) |
| `--no-open` | 不自动打开浏览器 |
| `--export` | 无界面:直接用已保存的 `project.json` 批量导出后退出 |
| `-h, --help` | 帮助 |

示例:

```bash
goodguide ./shots                 # 打开编辑器
goodguide ./shots -o ./out -p 5000
goodguide ./shots --export        # 复用上次配置,纯命令行重新导出
```

支持的图片格式:jpg / jpeg / png / webp / gif / bmp / tif / tiff。

## 工作流

1. `goodguide ./shots` → 浏览器打开编辑器。
2. 左侧选图、拖动排序。
3. 右侧「+ 小手 / + 框框」添加标注,在画板上拖拽/旋转/缩放,调颜色等参数。
4. 配置随时自动保存(右上角状态)。
5. 点「一键导出全部 mp4」,在输出目录得到每张图各自的 `mp4`。

## 结构

```
bin/cli.js              CLI 入口(扫描图片 / 起服务 / headless 导出)
src/server/server.js    本地服务:静态资源 + 配置读写 + SSE 导出进度
src/server/project.js   扫描图片、加载/保存 project.json(与磁盘文件对账)
src/server/exporter.js  逐帧渲染(@napi-rs/canvas)→ 管道喂 ffmpeg 编码
src/shared/draw.js      核心绘制(浏览器预览 / 导出共用,保证所见即所得)
src/shared/hand.js      小手 sprite(原生 Canvas2D 路径)
src/shared/anim.js      可无缝循环的戳动 / 脉冲动画曲线
public/                 编辑器前端(画板交互、拖拽排序、属性面板、导出)
```

预览端(浏览器)与导出端(Node)复用同一套 `src/shared/draw.js` 绘制代码,所以画板里看到的就是导出的 mp4 画面。
