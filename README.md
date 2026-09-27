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

## 関連スキル

- [ai-video-production](https://github.com/atsu-mada/ai-video-production) — 企画、参照シート、絵コンテ、カットプロンプトを作る前工程
- [seedance-2.0](https://github.com/atsu-mada/seedance-2.0) — Seedance のプロンプト作成（Emily2040/seedance-2.0 の改変フォーク）

## 制限

- プレビズとプロンプトを作るだけです。Seedance などへの投入や動画生成は行いません。
- 箱と球だけの動き参照です。完成映像の見た目は扱いません。

## ライセンス

[MIT](LICENSE) © 2026 atsu_mada (ATSUFUMI KASHIMA)

---

## English

An agent skill for Claude Code and Codex that turns a one-line scene or a shot list into a playable boxes-and-spheres Three.js previz (`previz.html`, recordable to webm), a Seedance reference prompt, and a shot table. It conveys camera, blocking, and timing only.

- Claude Code plugin: `/plugin marketplace add atsu-mada/previz-maker`, then `/plugin install previz-maker@atsu-mada-previz-maker`.
- Manual: `git clone https://github.com/atsu-mada/previz-maker.git ~/.claude/skills/previz-maker` (or `~/.codex/skills/previz-maker` for Codex).

It never submits to Seedance or generates video. Skill instructions are written in Japanese. License: MIT.
