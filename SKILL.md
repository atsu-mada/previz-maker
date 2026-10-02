---
name: previz-maker
description: Turn a one-sentence scene description or an existing shot list into playable Three.js block previz (boxes and spheres only), a Seedance/C-Dance reference prompt, and a shot table. Use when the user asks for a previz, プレビズ, プリビズ, camera blocking, or a motion reference video for AI video generation. Does not submit to Seedance or build full scenes.
---

# Previz Maker

情景の一文、またはカット割り済みのショットリストから、Seedance に渡す動く参照（プレビズ）を作る。見た目の完成度は追わない。カメラ、動線、立ち位置、タイミングだけを伝える。

## Skill Call Prefixes

- Claude Code: `/previz-maker`
- Codex: `$<previz-maker>`

## 1. 聞く（最大4問。未回答は既定値で進む）

| 項目 | 既定値 | 制約 |
| --- | --- | --- |
| 尺 | 15秒 | 整数秒、最大30秒 |
| 画面 | 16:9 | 16:9 / 9:16 / 1:1 |
| 登場 | 赤と青 | 名前と色、最大3体 |
| ビート | 情景から3〜5個 | 各ビートに「画角、動作、カメラ、終了状態」 |

ショットリストが渡されたら、質問は色の割り当てと作る範囲だけにする。30秒を超える台本はシーンごとに1本ずつ分け、カットをそのままビートにする（1本のビート数は5を超えてよい）。同じ構図を繰り返すループは、元シーンを `timeOffset` で流用して秒数まで一致させる。

## 2. 出力（毎回この3ファイル）

置き場所は作品フォルダ内の `previz/NN_<短い英小文字名>/`。番号は既存の続き。

- `previz.html` … `assets/previz-template.html` をコピーし、`SCENE` ブロックだけを書き換える
- `seedance-prompt.txt` … `assets/seedance-prompt-template.txt` の型と見出しを守る
- `shots.md` … 色と `@Image N` の対応表、ビート表（秒、画角、動作、カメラ、終了状態）

確認が済んだら `scripts/render.mjs` で `previz.mp4` と確認用のコンタクトシートも同じフォルダに書き出す（§5）。

## 3. previz.html の規則

- 人は箱の胴と球の頭だけ。手足、顔、服、テクスチャは作らない
- 場所は plane / box / ball のみ、合計20個まで。群衆（灰）と車（暗い灰の箱）は別枠
- 主要人物は彩度の高い色、それ以外は灰
- カメラは1ビートに1移動: 固定 / プッシュイン / 横追従 / 引き / 回り込み（`cam`、T4）。前のビートの `to` と次の `from` を一致させる
- ビートは0秒から隙間なく尺の終わりまでつなぐ
- 動く小道具（乗り物、飛ぶ物、宙に浮く物）は `props`、座る・起きる・場所の瞬間移動は人の `keys` の足元y と位置で書く
- 暗転・フェードは beat の `fade`（`in` / `out` / `black` / `white` / `white-hold`）、カットごとの昼夜は beat の `sky`、ウィップパンは `whip: true`
- 望遠圧縮は `follow` + `viewHeight` で、下がりながら画角を狭める
- 追加の任意項目（詳細は template 冒頭のコメント。既存の SCENE はそのまま動く）
  - `SCENE.far` 描画距離（惑星規模の引き）。半径50m超の ball は自動で滑らかに描く
  - props / location の `basic: true` 照明なしの単色（光る物、色合わせ用の面）
  - beat の `curve` 進み方（`linear` / `in` / `out` / 関数）、`cam: t => ({pos, target, fov})` 関数カメラ
  - `SCENE.veil = { c, keys:[[秒, 不透明度]] }` 全面の色板
  - 空の色は既定でハードカット。`skyBlend: true`（SCENE 全体または beat 単位、秒数も可）で直前ビートの色から補間し、`skyBlend: false` の beat だけハードに切り替える
- 「PREVIZ」表示と秒数は HTML の重ね表示だけ。WebGL に文字を描かない
- 再生・一時停止、秒数表示、canvas だけを webm にする「参照用に録画」を残す
- SCENE の上に補助関数を書くときは、エンジン側の名前（`ease` `V` `add` `mat` `pv*` など）と重ねない

### 技法（汎用）

- T1 共有の色・質感によるマッチ転換: 画面を一色（または一つの質感）で満たし、引くと別の場所・別のスケールの物だったと分かる。`SCENE.veil` か `basic` の大きな面で同じ色を作り、その色の中で場面を入れ替える
- T2 スケールリビール: 極端な寄りから切らずに連続で引き、全体を見せる。1ビートの `from`/`to`（または `curve`）で一続きにし、途中でカットしない
- T3 空間アンカーの連続性: 一つの物体は一つの場所に一つだけ置く。画面上の位置はカメラの動きで変え、別の場所から出し直さない。大きな背景物（地面、惑星、建物）も同じ座標のまま使い続ける
- T4 関数カメラによる回り込み: 被写体の周りを回る動きは `from`/`to` の直線補間だと被写体を突き抜ける。`beat.cam` で角度を補間する円弧を書き、次ビートの `from` は `cam(境目の秒)` と一致させる

## 4. seedance-prompt.txt の規則

- 日本語。見出しは `[参照の役割]` `[狙い]` `[出来事]` `[固定]` の4つだけ、この順
- 色と `@Image N` の番号は shots.md と一致させる
- 1ビートに主動作は1つ。各ビートに「終了状態」。次のビートは直前の終了から続ける
- `[固定]` に除外文を必ず入れる: プリビズの幾何形状（箱、球、単色の塊）を完成映像に残さない。字幕なし。BGMなし
- T5 代用形状の転写リスク: 光の球や箱で記号的に描いた物は、形のまま写されやすい。記号で描いた物は `[出来事]` と `[固定]` で本来の形を書く（例: 「光る球で示した分身は、最後まで人の形のまま。泡や球にしない」）
- セリフと効果音はショットリストにあれば `[出来事]` の該当秒に書く。BGM は編集で付ける前提で生成には入れない
- ピン送り、表情、目線、文字など、箱と球で表せないものはプロンプトで補い、shots.md のメモに書く

## 5. 確認して終える

1. 出力フォルダで `python3 -m http.server` を立て、ブラウザで `previz.html` を開く
2. コンソールで `previzSeek(秒)` を使い、各ビートの境目と最後の1秒を目で確認する（頭切れ、人物の重なり、カメラの壁抜け）。`previzSeek` はその場で描画するので、ブラウザが非表示でも確認できる
3. `node scripts/render.mjs <出力フォルダ> [--fps 24] [--size 1280x720]` で `previz.mp4` を書き出す。フレーム単位で描くので尺とフレーム数が SCENE と一致する（Node 22 以上、Chrome、ffmpeg が必要。コンソールエラーがあれば最後に表示される）。`ffprobe` で尺を確かめ、確定版は別名で残して上書きしない。実時間の webm 録画ボタンは予備として残す（タブを表示したまま行う）
4. 確認用のコンタクトシート（0.5秒ごと、時刻入り）を作る
   ```bash
   ffmpeg -i previz.mp4 -vf "select='not(mod(n\,12))',scale=480:-2,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x4:padding=4" -fps_mode vfr -frames:v 1 contact.png
   ```
   `12` は 24fps で0.5秒。`tile=6x4` は12秒分なので、尺に合わせて列数・行数か間隔を変える。`fps` フィルタは近いフレームを拾い時刻とずれるので `select` を使う。drawtext にフォントが無いと言われたら `fontfile=` を足す
5. 利用者には、`previz.mp4`、コンタクトシート、ビート表、色の対応、調整できる点だけを短く返す。**利用者が previz を見て OK を出すまで、有料の生成には進まない**

## スイートとの関係

このスキルはスイートに依存しない。できた `previz.mp4` は、選んだスイートオペレーター（例: `magnific-operator`、`tapnow-chrome-operator`）が `@Video 1` として参照に上げる。受け渡しと各スイートの手順は ai-video-production の [suite-operators](https://github.com/atsu-mada/ai-video-production/blob/main/references/core/suite-operators.html) を参照。

Seedance などへの投入や生成は、このスキルでは行わない。
