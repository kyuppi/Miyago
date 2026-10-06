体育館予約サイト
====================

このフォルダには予約画面と管理画面が入っています。

【重要】
別のスマホ・PCから予約して、開いている管理画面にリアルタイム反映するには、
Firebase Realtime Database を接続してください。

構成
----
index.html          … 生徒・部活動が使う予約画面
admin.html          … 管理者用ダッシュボード
app.js              … 予約側の処理
admin.js            … 管理側の処理
styles.css          … 共通デザイン
firebase.js         … Firebase接続
firebase-config.js  … Firebase設定（ここを自分の値に変更）
database.rules.json … Realtime DatabaseのRules例

1. Firebaseプロジェクトを作成
-----------------------------
Firebase Consoleで新しいプロジェクトを作成します。

2. Webアプリを追加
------------------
プロジェクトの設定 → マイアプリ → Webアプリを追加。
表示された firebaseConfig を firebase-config.js にコピーします。

3. Realtime Databaseを作成
--------------------------
Firebase Console → Realtime Database → データベースを作成。
database.rules.json の内容をRulesに設定してください。

4. 管理者ログインを作成
-----------------------
Firebase Console → Authentication → Sign-in method で
「メール/パスワード」を有効にします。
続けて管理者用ユーザーを1人作成します。

5. 予約利用者の匿名認証を有効化
-------------------------------
Firebase Console → Authentication → Sign-in method → Anonymous を有効にします。
予約画面ではこの匿名認証を自動で使います。

6. 公開
--------
GitHub Pages、Firebase Hosting、学校サーバーなど、
HTTPSで開ける場所へこのフォルダをアップロードします。

注意
----
・Firebase Webの設定値はWebページに含まれるため、APIキーそのものを秘密情報として扱う設計ではありません。
・ただしRealtime Database Rulesが重要です。上記Rulesでは、
  予約利用者（匿名）は「まだ存在しない予約枠への新規予約」のみ書き込み可能、
  管理者（メール/パスワード）は設定変更・予約取消が可能です。
・管理画面のURLを知っているだけでは、管理者アカウントでログインできません。
・ブラウザ通知、メール通知、プッシュ通知は実装していません。
・1つの「日付×A/B面×時間枠」はFirebaseのrunTransactionで1件だけ確保します。
  そのため同時に別端末から押された場合も、先に確保できた1件だけが成功します。

時間枠の使い方
--------------
管理画面 → 時間枠ルールから、例えば

開始月 2026-01
終了月 2026-03
開始時刻 10:00
終了時刻 13:00

を登録し、さらに

開始月 2026-01
終了月 2026-03
開始時刻 13:00
終了時刻 18:00

を登録すると、2026年1月〜3月の予約画面では
「10:00〜13:00」「13:00〜18:00」だけが選べます。

テスト
------
Firebaseをまだ設定していなくても、デモモードとして画面・入力・基本操作を確認できます。
ただしデモモードはlocalStorageなので、別端末との共有はできません。
