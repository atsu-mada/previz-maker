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

## 3. previz.html の規則

- 人は箱の胴と球の頭だけ。手足、顔、服、テクスチャは作らない
- 場所は plane / box / ball のみ、合計20個まで。群衆（灰）と車（暗い灰の箱）は別枠
- 主要人物は彩度の高い色、それ以外は灰
- カメラは1ビートに1移動: 固定 / プッシュイン / 横追従 / 引き。前のビートの `to` と次の `from` を一致させる
- ビートは0秒から隙間なく尺の終わりまでつなぐ
- 動く小道具（乗り物、飛ぶ物、宙に浮く物）は `props`、座る・起きる・場所の瞬間移動は人の `keys` の足元y と位置で書く
- 暗転・フェードは beat の `fade`、カットごとの昼夜は beat の `sky`、ウィップパンは `whip: true`
- 望遠圧縮は `follow` + `viewHeight` で、下がりながら画角を狭める
- 「PREVIZ」表示と秒数は HTML の重ね表示だけ。WebGL に文字を描かない
- 再生・一時停止、秒数表示、canvas だけを webm にする「参照用に録画」を残す

## 4. seedance-prompt.txt の規則

- 日本語。見出しは `[参照の役割]` `[狙い]` `[出来事]` `[固定]` の4つだけ、この順
- 色と `@Image N` の番号は shots.md と一致させる
- 1ビートに主動作は1つ。各ビートに「終了状態」。次のビートは直前の終了から続ける
- `[固定]` に除外文を必ず入れる: プリビズの幾何形状（箱、球、単色の塊）を完成映像に残さない。字幕なし。BGMなし
- セリフと効果音はショットリストにあれば `[出来事]` の該当秒に書く。BGM は編集で付ける前提で生成には入れない
- ピン送り、表情、目線、文字など、箱と球で表せないものはプロンプトで補い、shots.md のメモに書く

## 5. 確認して終える

1. 出力フォルダで `python3 -m http.server` を立て、ブラウザで `previz.html` を開く
2. コンソールで `previzSeek(秒)` を使い、各ビートの境目と最後の1秒を目で確認する（頭切れ、人物の重なり、カメラの壁抜け）。`previzSeek` はその場で描画するので、ブラウザが非表示でも確認できる
3. 録画ボタンで webm が保存されることを確かめ、サーバーを止める。録画は実時間で進むため、タブが表示されている状態で行う
4. 利用者には、ビート表、色の対応、調整できる点だけを短く返す

Seedance への投入や生成は、このスキルでは行わない。
