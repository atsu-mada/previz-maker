#!/usr/bin/env node
// previz-maker / scripts/render.mjs
// previz.html をフレーム単位で正確に mp4 へ書き出す（実時間録画ではないので、尺とフレーム数が SCENE と一致する）。
//
// 使い方:
//   node scripts/render.mjs <previz-dir> [--fps 24] [--size 1280x720] [--out <file.mp4>] [--html previz.html]
//                           [--chrome <Chrome の実行ファイル>] [--duration <秒>]
//
// 仕組み:
//   1. <previz-dir> を 127.0.0.1 の空きポートで配信する（Node 標準の http だけ）
//   2. ヘッドレス Chrome で previz.html を開き、window.previzSeek / window.previzInfo が用意されるまで待つ
//   3. フレーム i ごとに previzSeek(i / fps) を呼び、canvas を PNG で取り出す
//   4. PNG を ffmpeg にパイプし、H.264 / yuv420p の mp4 にする。フレーム数 = round(duration × fps)
//
// 必要なもの:
//   - Node.js 22 以上（標準の fetch と WebSocket を使う。npm パッケージは不要）
//   - Google Chrome または Chromium。見つからないときは --chrome か環境変数 CHROME_PATH で指定
//   - ffmpeg（PATH 上。無ければ環境変数 FFMPEG で指定）
//   - ネットワーク: previz.html は Three.js を jsDelivr から読み込む
//   - 任意: puppeteer-core または playwright が import できる場所にあれば、そちらでブラウザを動かす。
//     無ければ Chrome DevTools Protocol を直接使う（既定。追加インストール不要）
//
// 出力: 既定は <previz-dir>/previz.mp4。既存ファイルは上書きするので、確定版は別名で残すこと。

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ---------- 引数 ----------
function parseArgs(argv) {
  const o = { fps: 24, size: null, out: null, html: 'previz.html', chrome: process.env.CHROME_PATH || null, duration: null, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { if (i + 1 >= argv.length) die(`${a} には値が必要です`); return argv[++i]; };
    if (a === '--fps') o.fps = Number(next());
    else if (a === '--size') o.size = next();
    else if (a === '--out') o.out = next();
    else if (a === '--html') o.html = next();
    else if (a === '--chrome') o.chrome = next();
    else if (a === '--duration') o.duration = Number(next());
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a.startsWith('--')) die(`不明なオプション: ${a}`);
    else if (!o.dir) o.dir = a;
    else die(`余分な引数: ${a}`);
  }
  if (!o.dir) { usage(); process.exit(2); }
  if (!(o.fps > 0)) die('--fps は正の数');
  if (o.size && !/^\d+x\d+$/.test(o.size)) die('--size は 1280x720 の形式');
  return o;
}
function usage() { console.error('usage: node scripts/render.mjs <previz-dir> [--fps 24] [--size 1280x720] [--out file.mp4] [--html previz.html] [--chrome path] [--duration sec]'); }
function die(msg) { console.error(`render.mjs: ${msg}`); process.exit(1); }

// ---------- 静的サーバー ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
function serve(root) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, rel);
    if (rel === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---------- ブラウザ ----------
const CHROME_ARGS = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1600,1600'];

function findChrome(explicit) {
  const c = [explicit,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  return c.find(p => fs.existsSync(p)) || null;
}

async function tryImport(name) { try { return await import(name); } catch { return null; } }

// 共通インターフェース: { evaluate(expr) -> 値, close() }。onError(msg) にコンソールエラーを渡す
async function openPage(url, chromePath, onError) {
  const pptr = await tryImport('puppeteer-core');
  if (pptr && chromePath) {
    const browser = await (pptr.default ?? pptr).launch({ executablePath: chromePath, headless: true, args: CHROME_ARGS.filter(a => !a.startsWith('--headless')) });
    const page = await browser.newPage();
    page.on('console', m => m.type() === 'error' && onError(m.text()));
    page.on('pageerror', e => onError(String(e)));
    await page.goto(url);
    return { via: 'puppeteer-core', evaluate: expr => page.evaluate(expr), close: () => browser.close() };
  }
  const pw = await tryImport('playwright');
  if (pw) {
    const browser = await (pw.chromium ?? pw.default.chromium).launch({ executablePath: chromePath || undefined, headless: true, args: CHROME_ARGS.filter(a => !a.startsWith('--headless')) });
    const page = await browser.newPage();
    page.on('console', m => m.type() === 'error' && onError(m.text()));
    page.on('pageerror', e => onError(String(e)));
    await page.goto(url);
    return { via: 'playwright', evaluate: expr => page.evaluate(expr), close: () => browser.close() };
  }
  if (!chromePath) die('Chrome が見つかりません。--chrome か CHROME_PATH で指定してください');
  return openViaCdp(url, chromePath, onError);
}

// Chrome DevTools Protocol を直接使う（依存なし）
async function openViaCdp(url, chromePath, onError) {
  if (typeof WebSocket !== 'function') die('Node.js 22 以上が必要です（標準 WebSocket を使用）');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'previz-render-'));
  const proc = spawn(chromePath, [...CHROME_ARGS, '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome の起動待ちがタイムアウトしました')), 30000);
    proc.stderr.on('data', d => {
      buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', code => reject(new Error(`Chrome が終了しました (code ${code})`)));
  });
  const port = new URL(wsUrl).port;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURI(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails; onError(d.exception?.description || d.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      onError(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      onError(`${msg.params.entry.text} ${msg.params.entry.url ?? ''}`.trim());
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable');
  await send('Page.enable'); await send('Page.reload');   // enable 後に読み直して、読み込み時のエラーも拾う
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const close = async () => {
    try { ws.close(); } catch {}
    proc.kill();
    await new Promise(r => { if (proc.exitCode !== null) r(); else proc.once('exit', r); });
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { via: 'chrome-devtools-protocol', evaluate, close };
}

// ---------- 本体 ----------
async function main() {
  const o = parseArgs(process.argv.slice(2));
  const root = path.resolve(o.dir);
  if (!fs.existsSync(path.join(root, o.html))) die(`${path.join(root, o.html)} がありません`);
  const out = path.resolve(o.out ?? path.join(root, 'previz.mp4'));
  const ffmpegBin = process.env.FFMPEG || 'ffmpeg';

  const errors = [];
  const server = await serve(root);
  const url = `http://127.0.0.1:${server.address().port}/${o.html}`;
  let page;
  const cleanup = async () => { try { await page?.close(); } catch {} server.close(); };
  process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

  try {
    page = await openPage(url, findChrome(o.chrome), m => errors.push(m));
    const t0 = Date.now();
    let info = null;
    while (!info) {
      // previzInfo の無い古い previz.html でも、--duration があれば canvas の大きさで書き出す
      info = await page.evaluate(`(() => { if (typeof window.previzSeek !== 'function') return null;
        const c = document.querySelector('#stage canvas');
        return window.previzInfo ?? { slug: 'previz', duration: null, width: c.width, height: c.height }; })()`).catch(() => null);
      if (!info) {
        if (Date.now() - t0 > 30000) throw new Error(`previz の準備ができません（window.previzSeek が無い）。コンソール: ${errors.join(' | ') || 'なし'}`);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    const duration = o.duration ?? info.duration;
    if (!(duration > 0)) die('尺が分かりません。window.previzInfo の無い previz.html では --duration <秒> を指定してください');
    const frames = Math.round(duration * o.fps);
    const [ow, oh] = o.size ? o.size.split('x').map(Number) : [info.width, info.height];
    if (Math.abs(ow / oh - info.width / info.height) > 0.01) console.error(`注意: --size ${ow}x${oh} は previz の ${info.width}x${info.height} と縦横比が違うため引き伸ばされます`);
    console.error(`render: ${info.slug} ${duration}s × ${o.fps}fps = ${frames} frames, ${ow}x${oh}, via ${page.via}`);

    const ff = spawn(ffmpegBin, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(o.fps), '-c:v', 'png', '-i', '-',
      ...(ow !== info.width || oh !== info.height ? ['-vf', `scale=${ow}:${oh}:flags=lanczos`] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(o.fps), '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((r, j) => { ff.on('error', j); ff.on('exit', c => c === 0 ? r() : j(new Error(`ffmpeg が失敗しました (code ${c})`))); });

    for (let i = 0; i < frames; i++) {
      const b64 = await page.evaluate(`(() => { window.previzSeek(${i / o.fps}); return document.querySelector('#stage canvas').toDataURL('image/png').split(',')[1]; })()`);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (i % o.fps === 0) process.stderr.write(`\r  ${i}/${frames}`);
    }
    ff.stdin.end();
    await ffDone;
    process.stderr.write(`\r  ${frames}/${frames}\n`);
    if (errors.length) console.error(`コンソールエラー ${errors.length} 件:\n  ${errors.join('\n  ')}`);
    console.log(out);
  } finally {
    await cleanup();
  }
}

main().catch(e => { console.error(`render.mjs: ${e.message}`); process.exit(1); });
