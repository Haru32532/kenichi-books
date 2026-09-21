# iPhoneで使う方法
この版はPWA対応です。ZIPをiPhoneで直接起動するのではなく、Vercel等へHTTPS公開したURLをSafariで開きます。

## 公開
1. このフォルダをGitHubリポジトリへアップロード。
2. Vercelで New Project → Import。
3. Framework Preset: Other → Deploy。
4. ChatGPT機能を使う場合、VercelのEnvironment Variablesに `OPENAI_API_KEY` を追加して再Deploy。
5. 発行された `https://...vercel.app` をiPhoneのSafariで開く。

## ホーム画面
Safari → 共有 → ホーム画面に追加 → Webアプリとして開く → 追加。

## 家族共有
`supabase.sql` をSupabaseで実行し、アプリの共有画面へProject URL / anon key / ログイン情報を入力します。

## 注意
カメラ利用はHTTPS公開が前提です。BarcodeDetector非対応環境ではISBN/JANの13桁手入力が使えます。
