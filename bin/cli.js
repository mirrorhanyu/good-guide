#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import open from "open";
import { startServer } from "../src/server/server.js";
import { scanImages, loadOrInitProject } from "../src/server/project.js";
import { exportAll } from "../src/server/exporter.js";

const HELP = `good-guide — 给图片加会动的小手 + 框框标注,逐张导出竖屏 mp4

用法:
  good-guide <输入目录> [选项]

  扫描 <输入目录> 里的图片(jpg/jpeg/png/webp/gif/bmp/tif/tiff),启动本地
  服务并打开浏览器编辑器:左侧拖动排序,选图后在 9:16 画板上添加「小手」和
  「框框」标注(可旋转/缩放/改色),配置实时自动保存,最后一键各导出一个 mp4。

选项:
  -o, --out <目录>   输出目录,存放 project.json 与导出的 mp4
                     (默认:<输入目录>/goodguide-out)
  -p, --port <端口>  本地服务端口(默认:4321)
      --no-open      不自动打开浏览器(自行访问打印出的网址)
      --export       无界面模式:直接复用 <输出目录> 里已保存的 project.json
                     批量导出全部 mp4,完成后退出(适合改完图重新导出 / 脚本化)
  -h, --help         显示本帮助

示例:
  good-guide ./shots                  # 打开编辑器开始标注
  good-guide ./shots -o ./out         # 指定输出目录
  good-guide ./shots -p 5000          # 换端口
  good-guide ./shots --no-open        # 只起服务,不开浏览器
  good-guide ./shots --export         # 不开界面,按上次配置重新导出

说明:
  - 导出为 H.264 mp4(1080x1920,可在编辑器里改时长/帧率/背景等)。
  - 需要系统已安装 ffmpeg;可用环境变量 FFMPEG_PATH 指定其路径。
`;

function parseArgs(argv) {
  const opts = { input: null, out: null, port: 4321, open: true, headless: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "-o" || a === "--out") opts.out = argv[++i];
    else if (a === "-p" || a === "--port") opts.port = parseInt(argv[++i], 10);
    else if (a === "--no-open") opts.open = false;
    else if (a === "--export") opts.headless = true;
    else if (a.startsWith("-")) { console.error(`Unknown option: ${a}`); process.exit(1); }
    else rest.push(a);
  }
  opts.input = rest[0] || null;
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }

  const inputDir = path.resolve(opts.input);
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }
  const outputDir = path.resolve(opts.out || path.join(inputDir, "goodguide-out"));

  const images = scanImages(inputDir);
  if (images.length === 0) {
    console.error(`No images found in ${inputDir} (looked for jpg/png/webp/gif/bmp/tiff).`);
    process.exit(1);
  }
  console.log(`Found ${images.length} image(s) in ${inputDir}`);
  console.log(`Output: ${outputDir}`);

  if (opts.headless) {
    const scene = loadOrInitProject(inputDir, outputDir);
    console.log(`Exporting ${scene.images.length} mp4(s)...`);
    let last = "";
    await exportAll(scene, {
      onProgress: (p) => {
        if (p.phase === "done") console.log(`  ✓ ${p.file} -> ${path.basename(p.outPath)}`);
        else if (p.phase === "frame") {
          const line = `  ${p.index + 1}/${p.total} ${p.file} ${p.frame}/${p.frames}`;
          if (line !== last) { process.stdout.write("\r" + line.padEnd(60)); last = line; }
        }
      },
    });
    process.stdout.write("\n");
    console.log("Done.");
    process.exit(0);
  }

  const { url } = await startServer({ inputDir, outputDir, port: opts.port });
  console.log(`\n  goodguide editor:  ${url}\n  Press Ctrl+C to stop.\n`);
  if (opts.open) open(url).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
