import {
  auth, db, ref, onValue, get, set, runTransaction, IS_CONFIGURED,
  signInAnonymously
} from "./firebase.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const DEFAULT_SETTINGS = {
  schoolName: "体育館予約",
  version: 1,
  rules: [
    { id: "default-1", startMonth: "2026-01", endMonth: "2026-12", startTime: "10:00", endTime: "13:00" },
    { id: "default-2", startMonth: "2026-01", endMonth: "2026-12", startTime: "13:00", endTime: "18:00" }
  ]
};

const els = {
  schoolTitle: document.querySelector("#schoolTitle"),
  dateInput: document.querySelector("#dateInput"),
  dateHint: document.querySelector("#dateHint"),
  courtGroup: document.querySelector("#courtGroup"),
  slotGrid: document.querySelector("#slotGrid"),
  clubInput: document.querySelector("#clubInput"),
  reserveButton: document.querySelector("#reserveButton"),
  statusMessage: document.querySelector("#statusMessage"),
  modal: document.querySelector("#modal"),
  modalText: document.querySelector("#modalText"),
  modalClose: document.querySelector("#modalClose"),
  modalDone: document.querySelector("#modalDone"),
  summaryText: document.querySelector("#summaryText")
};

const state = {
  settings: loadLocalSettings(),
  court: "A",
  selectedSlot: null,
  reservations: {},
  unsubscribeDate: null,
  anonReady: false,
  busy: false
};

function loadLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem("gymSettings")) || structuredClone(DEFAULT_SETTINGS);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveLocalSettings(settings) {
  localStorage.setItem("gymSettings", JSON.stringify(settings));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatJPDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function monthOf(iso) {
  return iso.slice(0, 7);
}

function makeSlotId(start, end) {
  return `${start.replace(":", "")}_${end.replace(":", "")}`;
}

function getActiveSlots(dateISO) {
  const target = monthOf(dateISO);
  const rules = Array.isArray(state.settings.rules) ? state.settings.rules : [];
  const map = new Map();
  for (const rule of rules) {
    if (!rule || !rule.startMonth || !rule.endMonth || !rule.startTime || !rule.endTime) continue;
    if (rule.startMonth <= target && target <= rule.endMonth && rule.startTime < rule.endTime) {
      const id = makeSlotId(rule.startTime, rule.endTime);
      map.set(id, {
        id,
        startTime: rule.startTime,
        endTime: rule.endTime
      });
    }
  }
  return [...map.values()].sort((a,b) => a.startTime.localeCompare(b.startTime));
}

function setStatus(message, tone = "normal") {
  els.statusMessage.textContent = message;
  els.statusMessage.style.color = tone === "error" ? "#fda4af" : "#7dd3fc";
}

function updateSummary() {
  const date = els.dateInput.value;
  const slot = state.selectedSlot;
  if (!date || !slot) {
    els.summaryText.textContent = "利用日・面・時間を選択してください。";
    els.reserveButton.disabled = true;
    return;
  }
  els.summaryText.textContent = `${formatJPDate(date)} / ${state.court}面 / ${slot.startTime}〜${slot.endTime}`;
  els.reserveButton.disabled = !els.clubInput.value.trim() || state.busy || Boolean(state.reservations[slot.id]);
}

function renderSlots() {
  const slots = getActiveSlots(els.dateInput.value);
  if (!slots.length) {
    els.slotGrid.innerHTML = `<div class="empty-state">この月は予約可能な時間枠が設定されていません。<br>管理画面で時間枠ルールを追加してください。</div>`;
    state.selectedSlot = null;
    updateSummary();
    return;
  }

  if (state.selectedSlot && !slots.some(s => s.id === state.selectedSlot.id)) state.selectedSlot = null;

  els.slotGrid.innerHTML = slots.map(slot => {
    const taken = Boolean(state.reservations[slot.id]);
    const selected = state.selectedSlot?.id === slot.id;
    return `
      <button type="button"
        class="slot-button ${selected ? "selected" : ""} ${taken ? "unavailable" : ""}"
        data-slot-id="${slot.id}" ${taken ? "disabled" : ""}>
        <span class="time">${slot.startTime}〜${slot.endTime}</span>
        <span class="meta">${taken ? "予約済み" : "予約可能 · 1件まで"}</span>
      </button>`;
  }).join("");

  els.slotGrid.querySelectorAll(".slot-button:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = slots.find(s => s.id === btn.dataset.slotId);
      state.selectedSlot = slot || null;
      renderSlots();
      updateSummary();
    });
  });

  updateSummary();
}

function subscribeDate() {
  state.selectedSlot = null;
  if (state.unsubscribeDate) state.unsubscribeDate();
  state.reservations = {};
  const date = els.dateInput.value;

  if (!IS_CONFIGURED || !state.anonReady) {
    try {
      state.reservations = JSON.parse(localStorage.getItem(`gymReservations:${date}`)) || {};
    } catch {
      state.reservations = {};
    }
    renderSlots();
    return;
  }

  state.unsubscribeDate = onValue(
    ref(db, `reservations/${monthOf(date)}/${date}`),
    snap => {
      state.reservations = snap.val() || {};
      renderSlots();
    },
    error => {
      console.error(error);
      setStatus("予約状況を読み込めませんでした。通信設定を確認してください。", "error");
      renderSlots();
    }
  );
  renderSlots();
}

async function ensureAnonymousAuth() {
  if (!IS_CONFIGURED) {
    setStatus("デモモード：Firebase未設定のため、この端末内だけで保存されます。");
    state.anonReady = false;
    return;
  }
  try {
    await signInAnonymously(auth);
    state.anonReady = true;
    setStatus("リアルタイム接続済み。他の端末の予約も自動反映されます。");
  } catch (error) {
    console.error(error);
    state.anonReady = false;
    setStatus("共有サーバーへ接続できません。Firebaseの匿名認証設定を確認してください。", "error");
  }
}

async function reserve() {
  if (state.busy) return;
  const date = els.dateInput.value;
  const slot = state.selectedSlot;
  const club = els.clubInput.value.trim();

  if (!date || date < todayISO()) {
    setStatus("今日以降の日付を選択してください。", "error");
    return;
  }
  if (!slot) {
    setStatus("利用時間を選択してください。", "error");
    return;
  }
  if (!club || club.length > 40) {
    setStatus("部活動名を1〜40文字で入力してください。", "error");
    els.clubInput.focus();
    return;
  }

  state.busy = true;
  updateSummary();
  setStatus("空き状況を確認して予約しています…");

  if (!IS_CONFIGURED || !state.anonReady) {
    const key = `gymReservations:${date}`;
    let local = {};
    try { local = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    if (local[slot.id]) {
      setStatus("この時間枠はすでに予約されています。", "error");
      state.reservations = local;
      state.busy = false;
      renderSlots();
      return;
    }
    local[slot.id] = {
      id: slot.id,
      date, court: state.court,
      startTime: slot.startTime, endTime: slot.endTime,
      club, createdAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(local));
    state.reservations = local;
    state.busy = false;
    renderSlots();
    showModal({date, court: state.court, slot, club});
    return;
  }

  const month = monthOf(date);
  const slotRef = ref(db, `reservations/${month}/${date}/${state.court}/${slot.id}`);
  try {
    const result = await runTransaction(slotRef, current => {
      if (current !== null) return; // already reserved
      return {
        id: slot.id,
        date,
        court: state.court,
        startTime: slot.startTime,
        endTime: slot.endTime,
        club,
        createdAt: new Date().toISOString()
      };
    });

    if (!result.committed) {
      setStatus("この時間枠は他の端末で先に予約されました。", "error");
      return;
    }

    setStatus("予約が完了しました。");
    showModal({date, court: state.court, slot, club});
    state.selectedSlot = null;
  } catch (error) {
    console.error(error);
    setStatus("予約に失敗しました。通信状態またはFirebase Rulesを確認してください。", "error");
  } finally {
    state.busy = false;
    updateSummary();
  }
}

function showModal({date, court, slot, club}) {
  els.modalText.textContent = `【${court}面】${slot.startTime}〜${slot.endTime}\n${club}\n${formatJPDate(date)}`;
  els.modal.classList.remove("hidden");
  els.modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  els.modal.classList.add("hidden");
  els.modal.setAttribute("aria-hidden", "true");
}

async function loadSettings() {
  if (!IS_CONFIGURED) {
    state.settings = loadLocalSettings();
    els.schoolTitle.textContent = state.settings.schoolName || "体育館予約";
    return;
  }
  try {
    const snap = await get(ref(db, "settings"));
    if (snap.exists()) {
      state.settings = { ...DEFAULT_SETTINGS, ...snap.val(), rules: Array.isArray(snap.val().rules) ? snap.val().rules : [] };
      saveLocalSettings(state.settings);
      els.schoolTitle.textContent = state.settings.schoolName || "体育館予約";
    }
  } catch (error) {
    console.error(error);
    els.schoolTitle.textContent = state.settings.schoolName || "体育館予約";
    setStatus("設定の取得に失敗したため、保存済み設定を表示しています。", "error");
  }
}

els.dateInput.min = todayISO();
els.dateInput.value = todayISO();

els.courtGroup.addEventListener("click", e => {
  const button = e.target.closest(".court-button");
  if (!button) return;
  state.court = button.dataset.court;
  document.querySelectorAll(".court-button").forEach(b => {
    const active = b === button;
    b.classList.toggle("active", active);
    b.setAttribute("aria-checked", active ? "true" : "false");
  });
  subscribeDate();
});

els.dateInput.addEventListener("change", () => {
  if (els.dateInput.value < todayISO()) els.dateInput.value = todayISO();
  els.dateHint.textContent = els.dateInput.value ? `${formatJPDate(els.dateInput.value)} の空き時間を表示しています` : "";
  subscribeDate();
});
els.clubInput.addEventListener("input", updateSummary);
els.reserveButton.addEventListener("click", reserve);
els.modalClose.addEventListener("click", closeModal);
els.modalDone.addEventListener("click", closeModal);
els.modal.addEventListener("click", e => { if (e.target === els.modal) closeModal(); });

async function boot() {
  await loadSettings();
  await ensureAnonymousAuth();
  if (IS_CONFIGURED) {
    onValue(ref(db, "settings"), snap => {
      if (!snap.exists()) return;
      const next = { ...DEFAULT_SETTINGS, ...snap.val() };
      state.settings = next;
      saveLocalSettings(next);
      els.schoolTitle.textContent = next.schoolName || "体育館予約";
      renderSlots();
    });
  }
  els.dateHint.textContent = `${formatJPDate(els.dateInput.value)} の空き時間を表示しています`;
  subscribeDate();
}
boot();
