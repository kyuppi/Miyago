import {
  auth, db, ref, onValue, get, set, remove, signInWithEmailAndPassword,
  signOut, IS_CONFIGURED
} from "./firebase.js";

const DEFAULT_SETTINGS = {
  schoolName: "体育館予約",
  version: 1,
  rules: [
    { id: "default-1", startMonth: "2026-01", endMonth: "2026-12", startTime: "10:00", endTime: "13:00" },
    { id: "default-2", startMonth: "2026-01", endMonth: "2026-12", startTime: "13:00", endTime: "18:00" }
  ]
};

const els = {
  loginPanel: document.querySelector("#loginPanel"),
  adminApp: document.querySelector("#adminApp"),
  adminEmail: document.querySelector("#adminEmail"),
  adminPassword: document.querySelector("#adminPassword"),
  loginButton: document.querySelector("#loginButton"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  adminMonth: document.querySelector("#adminMonth"),
  reservationList: document.querySelector("#reservationList"),
  monthReservationCount: document.querySelector("#monthReservationCount"),
  aCount: document.querySelector("#aCount"),
  bCount: document.querySelector("#bCount"),
  todayCount: document.querySelector("#todayCount"),
  connectionState: document.querySelector("#connectionState"),
  ruleForm: document.querySelector("#ruleForm"),
  ruleStartMonth: document.querySelector("#ruleStartMonth"),
  ruleEndMonth: document.querySelector("#ruleEndMonth"),
  ruleStartTime: document.querySelector("#ruleStartTime"),
  ruleEndTime: document.querySelector("#ruleEndTime"),
  ruleError: document.querySelector("#ruleError"),
  ruleList: document.querySelector("#ruleList"),
  schoolNameInput: document.querySelector("#schoolNameInput"),
  saveSiteButton: document.querySelector("#saveSiteButton"),
  siteMessage: document.querySelector("#siteMessage"),
  toast: document.querySelector("#toast")
};

const state = {
  settings: loadSettings(),
  reservations: {},
  unsubMonth: null,
  unsubSettings: null
};

function loadSettings() {
  try { return JSON.parse(localStorage.getItem("gymSettings")) || structuredClone(DEFAULT_SETTINGS); }
  catch { return structuredClone(DEFAULT_SETTINGS); }
}
function cacheSettings(settings) {
  localStorage.setItem("gymSettings", JSON.stringify(settings));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function currentMonth() { return todayISO().slice(0,7); }

els.adminMonth.value = currentMonth();
els.ruleStartMonth.value = currentMonth();
els.ruleEndMonth.value = currentMonth();
els.ruleStartTime.value = "10:00";
els.ruleEndTime.value = "13:00";

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.t);
  showToast.t = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}
function setError(el, message) { el.textContent = message || ""; }

function flattenMonthReservations(tree) {
  const items = [];
  for (const [date, courts] of Object.entries(tree || {})) {
    for (const [court, slots] of Object.entries(courts || {})) {
      for (const [slotId, reservation] of Object.entries(slots || {})) {
        if (!reservation) continue;
        items.push({ ...reservation, date, court, slotId });
      }
    }
  }
  return items.sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

function renderReservations() {
  const items = flattenMonthReservations(state.reservations);
  els.monthReservationCount.textContent = items.length;
  els.aCount.textContent = items.filter(x => x.court === "A").length;
  els.bCount.textContent = items.filter(x => x.court === "B").length;
  els.todayCount.textContent = items.filter(x => x.date === todayISO()).length;

  if (!items.length) {
    els.reservationList.innerHTML = `<div class="empty-state">この月の予約はまだありません。</div>`;
    return;
  }

  els.reservationList.innerHTML = items.map(item => `
    <article class="reservation-item">
      <div>
        <div class="main">${formatJPDate(item.date)}</div>
        <div class="sub">${item.startTime}〜${item.endTime}</div>
      </div>
      <div>
        <span class="pill">${escapeHTML(item.court)}面</span>
        <div class="sub">${escapeHTML(item.club || "名称未入力")}</div>
      </div>
      <div>
        <div class="main">${escapeHTML(item.club || "名称未入力")}</div>
        <div class="sub">予約済み · 1枠1件</div>
      </div>
      <div class="action">
        <button class="cancel-button" type="button" data-date="${item.date}" data-court="${item.court}" data-slot="${item.slotId}">予約を取り消す</button>
      </div>
    </article>
  `).join("");

  els.reservationList.querySelectorAll(".cancel-button").forEach(button => {
    button.addEventListener("click", () => cancelReservation(button.dataset));
  });
}

function formatJPDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function renderRules() {
  const rules = Array.isArray(state.settings.rules) ? [...state.settings.rules] : [];
  rules.sort((a,b) => `${a.startMonth}${a.startTime}`.localeCompare(`${b.startMonth}${b.startTime}`));

  if (!rules.length) {
    els.ruleList.innerHTML = `<div class="empty-state">時間枠ルールがありません。</div>`;
    return;
  }

  els.ruleList.innerHTML = rules.map(rule => `
    <div class="rule-item">
      <div>
        <div class="title">${escapeHTML(rule.startTime)}〜${escapeHTML(rule.endTime)}</div>
        <div class="sub">${escapeHTML(rule.startMonth)} 〜 ${escapeHTML(rule.endMonth)} の間だけ表示</div>
      </div>
      <button class="cancel-button" type="button" data-rule-id="${escapeHTML(rule.id)}">削除</button>
    </div>
  `).join("");

  els.ruleList.querySelectorAll("[data-rule-id]").forEach(button => {
    button.addEventListener("click", () => deleteRule(button.dataset.ruleId));
  });
}

async function deleteRule(id) {
  if (!confirm("この時間枠ルールを削除しますか？")) return;
  state.settings.rules = (state.settings.rules || []).filter(rule => rule.id !== id);
  await saveSettings();
  showToast("時間枠ルールを削除しました");
}

async function saveSettings() {
  state.settings.version = 1;
  cacheSettings(state.settings);
  if (!IS_CONFIGURED) return true;

  try {
    await set(ref(db, "settings"), state.settings);
    return true;
  } catch (error) {
    console.error(error);
    showToast("設定の保存に失敗しました。");
    return false;
  }
}

els.ruleForm.addEventListener("submit", async e => {
  e.preventDefault();
  setError(els.ruleError, "");

  const startMonth = els.ruleStartMonth.value;
  const endMonth = els.ruleEndMonth.value;
  const startTime = els.ruleStartTime.value;
  const endTime = els.ruleEndTime.value;

  if (!startMonth || !endMonth || !startTime || !endTime) {
    setError(els.ruleError, "開始月・終了月・開始時刻・終了時刻をすべて入力してください。");
    return;
  }
  if (startMonth > endMonth) {
    setError(els.ruleError, "終了月は開始月以降にしてください。");
    return;
  }
  if (startTime >= endTime) {
    setError(els.ruleError, "終了時刻は開始時刻より後にしてください。");
    return;
  }

  const duplicate = (state.settings.rules || []).some(r =>
    r.startMonth === startMonth && r.endMonth === endMonth &&
    r.startTime === startTime && r.endTime === endTime
  );
  if (duplicate) {
    setError(els.ruleError, "同じルールはすでに登録されています。");
    return;
  }

  state.settings.rules = [
    ...(state.settings.rules || []),
    {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      startMonth, endMonth, startTime, endTime
    }
  ];
  const ok = await saveSettings();
  if (ok) {
    e.target.reset();
    els.ruleStartMonth.value = currentMonth();
    els.ruleEndMonth.value = currentMonth();
    els.ruleStartTime.value = "10:00";
    els.ruleEndTime.value = "13:00";
    renderRules();
    showToast("時間枠ルールを追加しました");
  }
});

els.saveSiteButton.addEventListener("click", async () => {
  const name = els.schoolNameInput.value.trim();
  if (!name || name.length > 50) {
    els.siteMessage.textContent = "学校・施設名を1〜50文字で入力してください。";
    els.siteMessage.style.color = "#fda4af";
    return;
  }
  state.settings.schoolName = name;
  const ok = await saveSettings();
  if (ok) {
    els.siteMessage.textContent = "設定を保存しました。予約画面にも反映されます。";
    els.siteMessage.style.color = "#7dd3fc";
  }
});

async function cancelReservation({date,court,slot}) {
  if (!confirm(`${formatJPDate(date)} ${court}面 ${slot} の予約を取り消しますか？`)) return;
  try {
    await remove(ref(db, `reservations/${date.slice(0,7)}/${date}/${court}/${slot}`));
    showToast("予約を取り消しました");
  } catch (error) {
    console.error(error);
    showToast("予約の取り消しに失敗しました。");
  }
}

function connectDashboard() {
  if (state.unsubMonth) state.unsubMonth();
  const month = els.adminMonth.value || currentMonth();

  state.unsubMonth = onValue(
    ref(db, `reservations/${month}`),
    snap => {
      // monthノード直下を date -> court -> slot の形で持つ
      state.reservations = snap.val() || {};
      renderReservations();
      els.connectionState.innerHTML = `<span class="live-dot"></span>リアルタイム接続中 · ${month}`;
    },
    error => {
      console.error(error);
      els.connectionState.textContent = "リアルタイム接続エラー";
      showToast("予約一覧を更新できませんでした。");
    }
  );
}

function connectSettings() {
  if (state.unsubSettings) state.unsubSettings();
  state.unsubSettings = onValue(ref(db, "settings"), snap => {
    if (!snap.exists()) return;
    state.settings = { ...DEFAULT_SETTINGS, ...snap.val() };
    state.settings.rules = Array.isArray(snap.val().rules) ? snap.val().rules : [];
    cacheSettings(state.settings);
    els.schoolNameInput.value = state.settings.schoolName || "";
    renderRules();
  });
}

async function startAdmin(user) {
  els.loginPanel.classList.add("hidden");
  els.adminApp.classList.remove("hidden");
  els.schoolNameInput.value = state.settings.schoolName || "";
  renderRules();

  if (!IS_CONFIGURED) {
    els.connectionState.innerHTML = `<span class="live-dot"></span>デモモード`;
    await demoBoot();
    showToast("Firebase未設定のため管理画面もこの端末内モードです。");
    return;
  }
  if (user?.isAnonymous) {
    els.adminApp.classList.add("hidden");
    els.loginPanel.classList.remove("hidden");
    return;
  }
  connectDashboard();
  connectSettings();
}

async function handleLoginClick() {
  setError(els.loginError, "");
  if (!IS_CONFIGURED) {
    await startAdmin({ demo: true });
    return;
  }
  const email = els.adminEmail.value.trim();
  const password = els.adminPassword.value;
  if (!email || !password) {
    setError(els.loginError, "メールアドレスとパスワードを入力してください。");
    return;
  }
  els.loginButton.disabled = true;
  els.loginButton.textContent = "ログイン中…";
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await startAdmin(credential.user);
  } catch (error) {
    console.error(error);
    setError(els.loginError, "ログインに失敗しました。メールアドレス・パスワード・Firebase設定を確認してください。");
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = "ログイン";
  }
}

els.loginButton.addEventListener("click", handleLoginClick);

els.logoutButton.addEventListener("click", async () => {
  if (IS_CONFIGURED) await signOut(auth);
  location.reload();
});

els.adminMonth.addEventListener("change", connectDashboard);

async function demoBoot() {
  // デモモードでは、管理画面側のローカル予約データを簡易表示する
  const month = els.adminMonth.value;
  const all = {};
  for (let d = 1; d <= 31; d++) {
    const date = `${month}-${String(d).padStart(2,"0")}`;
    try {
      const local = JSON.parse(localStorage.getItem(`gymReservations:${date}`));
      if (local && Object.keys(local).length) {
        all[date] = { A:{}, B:{} };
        for (const [id,r] of Object.entries(local)) all[date][r.court][id] = r;
      }
    } catch {}
  }
  state.reservations = all;
  renderReservations();
}

async function boot() {
  if (!IS_CONFIGURED) {
    els.loginPanel.querySelector(".muted").textContent = "Firebase未設定のためデモモードです。同じ端末のlocalStorageを確認します。";
    return;
  }

  import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js").then(async ({ onAuthStateChanged }) => {
    onAuthStateChanged(auth, user => {
      if (user && !user.isAnonymous) startAdmin(user);
    });
  });
}

if (!IS_CONFIGURED) {
  els.loginButton.textContent = "デモモードで開く";
  els.adminMonth.addEventListener("change", demoBoot);
} else {
  boot();
}
