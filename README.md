# previz-maker

情景の一文、またはショットリストから、AI 動画生成（Seedance など）に渡す「動く参照」＝ブロックプレビズを作るエージェントスキルです。Claude Code と Codex で使えます。

作者: あつまだ（ATSUFUMI KASHIMA） / GitHub [@atsu-mada](https://github.com/atsu-mada)

## できること

毎回、次の3ファイルを作ります。

| ファイル | 中身 |
| --- | --- |
| `previz.html` | 箱と球だけの Three.js プレビズ。ブラウザで再生し、webm として録画できます |
| `seedance-prompt.txt` | 録画したプレビズを参照動画として渡すためのプロンプト |
| `shots.md` | ビートごとの画角・動作・カメラ・終了状態の表 |

見た目の完成度は追わず、カメラ、動線、立ち位置、タイミングだけを伝えます。

確認が済んだら、同梱の `scripts/render.mjs` で `previz.mp4` を書き出します。ヘッドレス Chrome で `previzSeek(秒)` を1フレームずつ呼んで描くので、尺とフレーム数が SCENE と正確に一致します（実時間の webm 録画も予備として残っています）。

```bash
node scripts/render.mjs <previz フォルダ> [--fps 24] [--size 1280x720]
```

テンプレートは既存の SCENE をそのまま動かしたまま、次の任意項目を使えます: 描画距離 `SCENE.far`（大きな球は自動で滑らかに描画）、白フェード `white` / `white-hold`、照明なしの単色 `basic: true`、ビートごとの進み方 `curve`、全面の色板 `SCENE.veil`、回り込み用の関数カメラ `beat.cam(t)`、ビート間の空の色の補間 `skyBlend`（既定はハードカット）。回り込み、スケールリビール、色によるマッチ転換などの汎用技法は SKILL.md にあります。

できた previz はスイートに依存しません。選んだスイートオペレーター（例: magnific-operator、tapnow-chrome-operator）が `@Video 1` として参照に上げます。利用者が previz を見て OK を出すまで、有料の生成には進みません。

## インストール

### Claude Code（プラグイン）

```
/plugin marketplace add atsu-mada/previz-maker
/plugin install previz-maker@atsu-mada-previz-maker
```

`/previz-maker:previz-maker` で呼び出せます。

### Claude Code（手動）

```bash
git clone https://github.com/atsu-mada/previz-maker.git ~/.claude/skills/previz-maker
```

`/previz-maker` で呼び出せます。

### Codex

```bash
git clone https://github.com/atsu-mada/previz-maker.git ~/.codex/skills/previz-maker
```

`$previz-maker` で呼び出せます。

### 必要なもの

- モダンブラウザ。Three.js は CDN（jsDelivr）から読み込みます。
- 確認用に `python3 -m http.server` を使います。
- mp4 書き出し（`scripts/render.mjs`）には次が必要です。
  - Node.js 22 以上（標準の fetch と WebSocket を使うので npm パッケージは不要）
  - Google Chrome または Chromium（見つからないときは `--chrome <パス>` か環境変数 `CHROME_PATH`）
  - ffmpeg（PATH 上、または環境変数 `FFMPEG`）。コンタクトシートの時刻表示には drawtext（freetype 付きのビルド）
  - 任意: `puppeteer-core` か `playwright` が import できればそちらを使い、無ければ Chrome DevTools Protocol を直接使います

## 関連スキル

- [ai-video-production](https://github.com/atsu-mada/ai-video-production) — 企画、参照シート、絵コンテ、カットプロンプトを作る前工程
- [seedance-studio](https://github.com/atsu-mada/seedance-studio) — Seedance 2.5 のプロンプト作成（Emily2040/seedance-2.0 の改変フォーク）

## 制限

- プレビズとプロンプトを作るだけです。Seedance などへの投入や動画生成は行いません。
- 箱と球だけの動き参照です。完成映像の見た目は扱いません。

## ライセンス

[MIT](LICENSE) © 2026 atsu_mada (ATSUFUMI KASHIMA)

---

## English

An agent skill for Claude Code and Codex that turns a one-line scene or a shot list into a playable boxes-and-spheres Three.js previz (`previz.html`, recordable to webm), a Seedance reference prompt, and a shot table. It conveys camera, blocking, and timing only.

- `node scripts/render.mjs <previz-dir> [--fps 24] [--size 1280x720]` renders a frame-exact `previz.mp4` (headless Chrome + `previzSeek(t)` + ffmpeg). Needs Node.js 22+, Chrome/Chromium, and ffmpeg; uses puppeteer-core or playwright if importable, otherwise the Chrome DevTools Protocol directly.
- Optional template features (existing SCENE blocks keep working): `SCENE.far`, smoother large spheres, `white` / `white-hold` fades, unlit `basic: true` props, per-beat `curve`, full-screen `SCENE.veil`, function camera `beat.cam(t)` for orbits, and `skyBlend` sky-colour interpolation (hard cuts by default).
- Suite-neutral: the chosen suite operator uploads the previz as `@Video 1`. Paid generation waits for the user's visual approval of the previz.

- Claude Code plugin: `/plugin marketplace add atsu-mada/previz-maker`, then `/plugin install previz-maker@atsu-mada-previz-maker`.
- Manual: `git clone https://github.com/atsu-mada/previz-maker.git ~/.claude/skills/previz-maker` (or `~/.codex/skills/previz-maker` for Codex).

It never submits to Seedance or generates video. Skill instructions are written in Japanese. License: MIT.
