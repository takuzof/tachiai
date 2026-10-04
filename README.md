# HANDOFF 退去立会依頼 PWA V0.4
## GitHub共通マスター版

この版では、物件マスターと立会業者マスターを `data/masters.json` から読み込みます。
GitHub Pagesで公開すれば、iPhone・PCなど複数端末が同じマスターを利用できます。

### マスター登録方法
GitHubリポジトリで `data/masters.json` を開き、編集ボタン（鉛筆）から内容を登録して Commit してください。

例:

```json
{
  "properties": [
    {
      "name": "コンチェルト平塚",
      "address": "東京都品川区..."
    }
  ],
  "vendors": [
    {
      "name": "○○立会サービス",
      "person": "山田",
      "email": "yamada@example.com",
      "phone": "090-1234-5678"
    }
  ]
}
```

Commit後、HANDOFFの「⚙ マスター管理」→「最新マスターを再読込」で反映できます。

### 注意
GitHub Pagesは静的サイトのため、アプリ画面からGitHubへ直接書き込む機能は入れていません。
ブラウザにGitHubトークンを埋め込む方式は安全ではないためです。
