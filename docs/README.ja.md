<div align="center">

# Ambient Tonnetz

### 六角形キーボードで、ブラウザだけでアンビエント音楽を。

六角グリッドを押すだけでコードが*成立する*。音楽理論も、インストールも、アカウントも不要。ループを重ね、波形をブレンドし、リバーブに沈めて、そのままWAVで書き出せます。

**[▶ ライブデモ tonnetz.sora16bit.com](https://tonnetz.sora16bit.com)**

[![Live demo](https://img.shields.io/badge/demo-tonnetz.sora16bit.com-2563eb.svg)](https://tonnetz.sora16bit.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](../LICENSE)
[![Built with Vite](https://img.shields.io/badge/Vite-vanilla%20JS-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-no%20dependencies-black.svg)](https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-black.svg)](#コントリビュート)

[English](../README.md) · 日本語

[![YouTubeでデモを見る](https://img.youtube.com/vi/gcY16DrP3cQ/maxresdefault.jpg)](https://youtu.be/gcY16DrP3cQ)

<sub>▶ *クリックでYouTubeのデモを再生*</sub>

![Ambient Tonnetz — 六角形のTonnetzキーボード、波形スライダー、エフェクト、レイヤーキューがブラウザ上で動作している様子](media/app-preview.png)

<sub>*この六角グリッドはTonnetz（音網）。隣り合う音が協和音程になっているので、近くを押すだけで気持ちよく響きます。左下のレイヤーキューでループを重ね、スライダーで音を作り込む。全てWeb Audio APIで動き、バックエンドはありません。*</sub>

</div>

---

## 目次

- [なぜ作ったか](#なぜ作ったか)
- [できること](#できること)
- [クイックスタート](#クイックスタート)
- [仕組み](#仕組み)
- [技術スタック](#技術スタック)
- [コントリビュート](#コントリビュート)
- [ライセンス](#ライセンス)

## なぜ作ったか

ほとんどの音楽ツールは「音楽を知っている」前提で作られています。ピアノロールと調号と空のタイムラインを渡され、どの音が合うのか分からなければ、始める前に手が止まる。

**Tonnetz（音網）** は、理論ではなく幾何でこれを解決します。隣接＝協和になるように音を六角グリッドへ配置するので、隣り合う音は協和音程、三角形はコードになる。だからグリッドをさまよって近くを押すだけで、意図したように響く。Ambient Tonnetz はそのグリッドを演奏可能な楽器にして、漂うようなループ主体のアンビエント — 配信や作業の裏、あるいは何もしない時間に流すような音楽 — を作れるようにしたものです。

## できること

- **🎹 Tonnetzを演奏** — クリック・タップ・キーボードで。隣り合う六角は協和するので「外す」音がありません。スケールとルート音でさらに絞り込めます。
- **🔁 ループを重ねる** — 演奏を独立したループレイヤーに録音し、好きなだけ重ねて、変化し続けるアンビエントの音像を作れます。
- **🎛️ 音を作り込む** — オシレーターの波形をブレンドし、BPMを決め、リバーブ・ディレイ・アタック/リリースをリアルタイムに調整。
- **🤖 オートモード** — 自動演奏に任せて、ハンズフリーで自己進化するアンビエントを生成。
- **💾 プリセット** — 音色設定を保存・リネーム・JSONエクスポート。URLでパッチ共有も可能。
- **📤 WAV書き出し** — 任意のレイヤーを `.wav` に書き出し。
- **🌍 日英対応** — English / 日本語をヘルプパネルから切替。

アカウント・バックエンド・インストールは一切なし。すべてブラウザのクライアント側で動き、プリセットはあなた自身の `localStorage` に保存されます。

## クイックスタート

一番速いのは **[ライブデモ](https://tonnetz.sora16bit.com)** — インストール不要です。PC推奨（モバイルは横向き限定の簡易版）。六角をいくつか押して、レイヤーで録音し、その上にもう一つループを重ねてみてください。

ローカルで動かす場合（Node.js 20+）:

```bash
git clone https://github.com/sora16bit/ambient-tonnetz.git
cd ambient-tonnetz
npm install
npm run dev
```

ブラウザで <http://localhost:5173> を開きます。

```bash
npm run build    # dist/ に本番ビルド
npm test         # vitest を実行
```

## 仕組み

```
ポインタ / キーボード / オートモード
            │
            ▼
   src/main.js  (入力 → 状態 → 描画ループ)
            │
   ┌────────┴─────────┐
   ▼                  ▼
src/audio/         src/ui/
  engine.js          canvas.js   ← 描画はすべて <canvas> に手描き
  drone.js           layerqueue.js
  recorder.js        presetpanel.js
            │
            ▼
     Web Audio API  (オシレーター・畳み込みリバーブ・ディレイ・ゲインエンベロープ)
            │
            ▼
   MediaRecorder → WAV書き出し
```

- **描画** は単一の `<canvas>` 2D描画ループ。六角グリッド・スライダー・レイヤーカード・オーバーレイはすべて手描き（`src/ui/`）で、DOMフレームワークは不使用。
- **音** は純粋なWeb Audio。ボイスごとのオシレーター、畳み込みリバーブ、フィードバックディレイ、ノートごとのアタック/リリースエンベロープ（`src/audio/`）。
- **状態** は `src/core/state.js` の単一プレーンオブジェクト。入力ハンドラがそれを書き換え、描画ループが読む。
- **永続化** はプリセットと言語を `localStorage` に保存。パッチは共有可能なURLにエンコードもできる（`src/pro/url-share.js`）。

## 技術スタック

| レイヤー | 採用 |
|---|---|
| ビルド | Vite（バニラJS、ES2020、フレームワークなし） |
| 音声 | Web Audio API（オシレーター・畳み込みリバーブ・ディレイ・エンベロープ） |
| 録音 | MediaRecorder → 自作WAVエンコーダ |
| 描画 | Canvas 2D、手描きUI |
| i18n | 自作の文字列テーブル（`src/i18n/strings.js`） |
| テスト | Vitest + jsdom |
| ホスティング | Cloudflare Pages（静的） |

## コントリビュート

IssueとPRを歓迎します。小規模・依存の少ないバニラJSなので、コードを覗くのにも向いています。PRを出す前に `npm test` を実行してください。

## ライセンス

[MIT](../LICENSE)
