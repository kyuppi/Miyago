// Firebase設定
// ここを、Firebaseコンソール > プロジェクトの設定 > マイアプリ > Webアプリ
// で取得した値に置き換えてください。
// APIキーなどはFirebase Webアプリ用の公開設定です。ただしDatabase Rulesは必ず設定してください。

export firebaseConfig = {
  apiKey: "AIzaSyD0hHahdQ-46cv8QAq4xMvkafM5AV8swk0",
  authDomain: "miyago-94c27.firebaseapp.com",
  projectId: "miyago-94c27",
  storageBucket: "miyago-94c27.firebasestorage.app",
  messagingSenderId: "272758077767",
  appId: "1:272758077767:web:48adb4f7ad48014bc5f462",
  measurementId: "G-2BRSR2165J"
};

export const IS_CONFIGURED =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT" &&
  firebaseConfig.appId !== "YOUR_APP_ID";
