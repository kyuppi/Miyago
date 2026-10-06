// Firebase設定
// ここを、Firebaseコンソール > プロジェクトの設定 > マイアプリ > Webアプリ
// で取得した値に置き換えてください。
// APIキーなどはFirebase Webアプリ用の公開設定です。ただしDatabase Rulesは必ず設定してください。

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const IS_CONFIGURED =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT" &&
  firebaseConfig.appId !== "YOUR_APP_ID";
