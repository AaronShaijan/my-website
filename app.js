const STORAGE_KEY = "fitlog-workouts";
const CHART_IDS = [
  "chart-calories-time",
  "chart-hours-type",
  "chart-calories-type",
  "chart-sessions-type",
  "chart-weekly",
  "chart-weekday",
];

const CHART_TITLES = {
  "chart-calories-time": "Calories over time",
  "chart-hours-type": "Hours by workout type",
  "chart-calories-type": "Calories by type",
  "chart-sessions-type": "Sessions by type",
  "chart-weekly": "Weekly calories",
  "chart-weekday": "Hours by day of week",
};

const charts = {};
let editingId = null;
let modalChartId = null;

const $ = (sel) => document.querySelector(sel);
const form = $("#workout-form");
const listEl = $("#workout-list");
const cancelBtn = $("#cancel-edit");
const submitBtn = $("#submit-btn");

document.getElementById("year").textContent = new Date().getFullYear();
$("#workout-date").valueAsDate = new Date();

function storageWorks() {
  try {
    const test = "__fitlog_test__";
    localStorage.setItem(test, "1");
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function loadWorkouts() {
  if (!storageWorks()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveWorkouts(workouts, options = {}) {
  const { silent = false } = options;
  if (!storageWorks()) {
    showToast("Cannot save — browser storage is blocked");
    $("#storage-banner").hidden = false;
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
    localStorage.setItem(STORAGE_KEY + "-updated", new Date().toISOString());
    localStorage.setItem(STORAGE_KEY + "-saved-by-user", "1");
    if (!silent) notifySaved(workouts.length);
    return true;
  } catch {
    showToast("Save failed — storage may be full or blocked");
    return false;
  }
}

function saveAllNow() {
  const workouts = loadWorkouts();
  if (saveWorkouts(workouts)) {
    showToast(`Saved ${workouts.length} workout${workouts.length === 1 ? "" : "s"} on this device`);
  }
}

function clearAllWorkouts() {
  if (
    !confirm(
      "Delete ALL workouts from this device? This cannot be undone (unless you have a backup file)."
    )
  ) {
    return;
  }
  saveWorkouts([], { silent: true });
  localStorage.setItem(STORAGE_KEY + "-no-demo", "1");
  resetForm();
  refresh();
  showToast("All workouts cleared — add your own below");
}

function notifySaved(count) {
  const status = $("#save-status");
  const statusText = $("#save-status-text");
  const footer = $("#footer-saved");

  status.classList.add("is-saving");
  status.classList.remove("is-saved");
  statusText.textContent = "Saving…";

  clearTimeout(notifySaved._timer);
  notifySaved._timer = setTimeout(() => {
    status.classList.remove("is-saving");
    status.classList.add("is-saved");
    const when = formatSavedTime(localStorage.getItem(STORAGE_KEY + "-updated"));
    statusText.textContent = when ? `Saved ${when}` : "Saved on this device";
    footer.textContent = `${count} workout${count === 1 ? "" : "s"} saved on this laptop`;
    showToast(`Saved — ${count} workout${count === 1 ? "" : "s"} on this device`);
  }, 400);
}

function formatSavedTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 350);
  }, 2800);
}

function exportBackup() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    workouts: loadWorkouts(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fitlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Backup downloaded");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : data.workouts;
      if (!Array.isArray(list)) throw new Error("Invalid file");
      saveWorkouts(list);
      resetForm();
      refresh();
      showToast(`Restored ${list.length} workouts`);
    } catch {
      showToast("Could not read backup file");
    }
  };
  reader.readAsText(file);
}

function uid() {
  return crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
}

function formatDay(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayOfWeek(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" });
}

function weekKey(iso) {
  const d = new Date(iso + "T12:00:00");
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function resetForm() {
  editingId = null;
  form.reset();
  $("#workout-id").value = "";
  $("#workout-date").valueAsDate = new Date();
  submitBtn.textContent = "Add workout";
  cancelBtn.hidden = true;
}

function readForm() {
  return {
    id: $("#workout-id").value || uid(),
    date: $("#workout-date").value,
    type: $("#workout-type").value,
    calories: Number($("#workout-calories").value),
    hours: Number($("#workout-hours").value),
  };
}

const EMPTY_TABLE_HTML = `
  <tr class="empty-row">
    <td colspan="5">
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">🏃</span>
        <p class="empty-title">No workouts yet</p>
        <p class="empty-desc">Log your first session above to unlock analytics and streaks.</p>
      </div>
    </td>
  </tr>
`;

function renderList(workouts) {
  if (!workouts.length) {
    listEl.innerHTML = EMPTY_TABLE_HTML;
    return;
  }

  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));

  listEl.innerHTML = sorted
    .map(
      (w, i) => `
    <tr data-id="${w.id}" style="animation: fade-in 0.4s ease ${i * 0.04}s backwards">
      <td>${formatDay(w.date)}</td>
      <td><span class="type-pill">${w.type}</span></td>
      <td>${w.calories.toLocaleString()} kcal</td>
      <td>${w.hours} h</td>
      <td class="row-actions">
        <button type="button" class="btn-icon edit-btn" data-id="${w.id}" aria-label="Edit">Edit</button>
        <button type="button" class="btn-icon delete-btn" data-id="${w.id}" aria-label="Delete">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function getWeeklyCalories(workouts) {
  const todayKey = weekKey(new Date().toISOString().slice(0, 10));
  return workouts
    .filter((w) => weekKey(w.date) === todayKey)
    .reduce((s, w) => s + w.calories, 0);
}

function getTodayCalories(workouts) {
  const today = new Date().toISOString().slice(0, 10);
  return workouts.filter((w) => w.date === today).reduce((s, w) => s + w.calories, 0);
}

function updateStats(workouts) {
  const count = workouts.length;
  const totalCal = workouts.reduce((s, w) => s + w.calories, 0);
  const totalHrs = workouts.reduce((s, w) => s + w.hours, 0);
  const weeklyCal = getWeeklyCalories(workouts);

  $("#stat-count").textContent = count;
  $("#stat-calories").textContent = totalCal.toLocaleString();
  $("#stat-hours").textContent = totalHrs.toFixed(1);
  $("#stat-avg-cal").textContent = count ? Math.round(totalCal / count).toLocaleString() : "0";
  $("#stat-weekly").textContent = weeklyCal.toLocaleString();
  const heroToday = $("#hero-today-cal");
  if (heroToday) heroToday.textContent = getTodayCalories(workouts).toLocaleString();
}

function updateEmptyStates(workouts) {
  const hasData = workouts.length > 0;
  const chartsGrid = $("#charts-grid");
  const analyticsEmpty = $("#analytics-empty");

  chartsGrid?.classList.toggle("is-empty", !hasData);
  if (analyticsEmpty) analyticsEmpty.hidden = hasData;

  document.querySelectorAll(".chart-empty").forEach((node) => {
    const id = node.dataset.chart;
    const canvas = document.getElementById(id);
    node.hidden = hasData;
    if (canvas) canvas.style.visibility = hasData ? "visible" : "hidden";
  });
}

function buildInsights(workouts) {
  const el = $("#insights");
  if (!workouts.length) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;

  const byType = {};
  workouts.forEach((w) => {
    if (!byType[w.type]) byType[w.type] = { cal: 0, hrs: 0, n: 0 };
    byType[w.type].cal += w.calories;
    byType[w.type].hrs += w.hours;
    byType[w.type].n += 1;
  });

  const topType = Object.entries(byType).sort((a, b) => b[1].cal - a[1].cal)[0];
  const topDay = [...workouts].sort((a, b) => b.calories - a.calories)[0];
  const calPerHour = workouts.reduce((s, w) => s + w.calories, 0) / workouts.reduce((s, w) => s + w.hours, 0);

  el.innerHTML = `
    <p><strong>Top burn type:</strong> ${topType[0]} (${topType[1].cal.toLocaleString()} kcal total)</p>
    <p><strong>Highest single session:</strong> ${topDay.calories.toLocaleString()} kcal on ${formatDay(topDay.date)} (${topDay.type})</p>
    <p><strong>Average intensity:</strong> ~${Math.round(calPerHour).toLocaleString()} kcal per hour across all sessions</p>
  `;
}

function chartColors(n) {
  const styles = getComputedStyle(document.documentElement);
  const base = [
    styles.getPropertyValue("--chart-1").trim(),
    styles.getPropertyValue("--chart-2").trim(),
    styles.getPropertyValue("--chart-3").trim(),
    styles.getPropertyValue("--chart-4").trim(),
    styles.getPropertyValue("--chart-5").trim(),
    styles.getPropertyValue("--chart-6").trim(),
    styles.getPropertyValue("--chart-7").trim(),
  ].filter(Boolean);
  const fallback = ["#39ff14", "#00e5ff", "#ff6b2c", "#a855f7", "#ffd60a", "#ff4757", "#2ed573"];
  const palette = base.length ? base : fallback;
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function makeChart(id, config, canvasId = id) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !config) return;
  const styles = getComputedStyle(document.documentElement);
  const muted = styles.getPropertyValue("--muted").trim() || "#9a9a92";
  const text = styles.getPropertyValue("--text").trim() || "#f5f5f0";
  const border = styles.getPropertyValue("--border").trim() || "#2a2a2a";

  charts[canvasId] = new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        legend: {
          labels: { color: text, font: { family: "'Inter', sans-serif", size: 11 } },
        },
      },
      scales:
        config.type === "doughnut" || config.type === "pie"
          ? undefined
          : {
              x: {
                ticks: { color: muted, maxRotation: 45 },
                grid: { color: border },
              },
              y: {
                ticks: { color: muted },
                grid: { color: border },
                beginAtZero: true,
              },
            },
      ...config.options,
    },
  });
}

function getChartConfig(chartId, workouts) {
  if (!workouts.length) return null;

  const green = getComputedStyle(document.documentElement).getPropertyValue("--accent-green").trim();
  const cyan = getComputedStyle(document.documentElement).getPropertyValue("--accent-cyan").trim();
  const types = [...new Set(workouts.map((w) => w.type))].sort();
  const colors = chartColors(types.length);

  if (chartId === "chart-calories-time") {
    const byDate = {};
    workouts.forEach((w) => {
      byDate[w.date] = (byDate[w.date] || 0) + w.calories;
    });
    const dates = Object.keys(byDate).sort();
    return {
      type: "line",
      data: {
        labels: dates.map(formatDay),
        datasets: [
          {
            label: "Calories",
            data: dates.map((d) => byDate[d]),
            borderColor: green || "#39ff14",
            backgroundColor: "rgba(57, 255, 20, 0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
    };
  }

  if (chartId === "chart-hours-type") {
    return {
      type: "bar",
      data: {
        labels: types,
        datasets: [
          {
            label: "Hours",
            data: types.map((t) =>
              workouts.filter((w) => w.type === t).reduce((s, w) => s + w.hours, 0)
            ),
            backgroundColor: colors,
          },
        ],
      },
    };
  }

  if (chartId === "chart-calories-type") {
    return {
      type: "bar",
      data: {
        labels: types,
        datasets: [
          {
            label: "Calories",
            data: types.map((t) =>
              workouts.filter((w) => w.type === t).reduce((s, w) => s + w.calories, 0)
            ),
            backgroundColor: colors,
          },
        ],
      },
    };
  }

  if (chartId === "chart-sessions-type") {
    return {
      type: "doughnut",
      data: {
        labels: types,
        datasets: [
          {
            data: types.map((t) => workouts.filter((w) => w.type === t).length),
            backgroundColor: colors,
          },
        ],
      },
      options: { scales: undefined },
    };
  }

  if (chartId === "chart-weekly") {
    const byWeek = {};
    workouts.forEach((w) => {
      const wk = weekKey(w.date);
      byWeek[wk] = (byWeek[wk] || 0) + w.calories;
    });
    const weeks = Object.keys(byWeek).sort().slice(-8);
    return {
      type: "bar",
      data: {
        labels: weeks.map((w) => `Week of ${formatDay(w)}`),
        datasets: [
          {
            label: "Calories",
            data: weeks.map((w) => byWeek[w]),
            backgroundColor: cyan || "#00e5ff",
          },
        ],
      },
    };
  }

  if (chartId === "chart-weekday") {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      type: "bar",
      data: {
        labels: weekdays.map((d) => d.slice(0, 3)),
        datasets: [
          {
            label: "Hours",
            data: weekdays.map((name) =>
              workouts
                .filter((w) => dayOfWeek(w.date) === name)
                .reduce((s, w) => s + w.hours, 0)
            ),
            backgroundColor: green || "#39ff14",
          },
        ],
      },
    };
  }

  return null;
}

function renderCharts(workouts) {
  updateEmptyStates(workouts);

  if (!workouts.length) {
    CHART_IDS.forEach(destroyChart);
    return;
  }

  CHART_IDS.forEach((id) => {
    const config = getChartConfig(id, workouts);
    if (config) makeChart(id, config);
    else destroyChart(id);
  });

  if (modalChartId && !$("#chart-modal").hidden) {
    const config = getChartConfig(modalChartId, workouts);
    if (config) makeChart(modalChartId, config, "chart-modal-canvas");
  }
}

function openChartModal(chartId) {
  const workouts = loadWorkouts();
  if (!workouts.length) {
    showToast("Add workouts first to view charts");
    return;
  }

  const config = getChartConfig(chartId, workouts);
  if (!config) return;

  modalChartId = chartId;
  const modal = $("#chart-modal");
  $("#chart-modal-title").textContent = CHART_TITLES[chartId] || "Chart";
  modal.hidden = false;
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    makeChart(chartId, config, "chart-modal-canvas");
  });
}

function closeChartModal() {
  destroyChart("chart-modal-canvas");
  modalChartId = null;
  const modal = $("#chart-modal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function initChartModal() {
  document.querySelectorAll(".chart-expand").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openChartModal(btn.dataset.chart);
    });
  });

  document.querySelectorAll(".chart-card").forEach((card) => {
    const btn = card.querySelector(".chart-expand");
    if (!btn) return;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".chart-expand")) return;
      openChartModal(btn.dataset.chart);
    });
    card.style.cursor = "pointer";
  });

  $("#chart-modal-close")?.addEventListener("click", closeChartModal);
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeChartModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#chart-modal").hidden) closeChartModal();
  });
}

function refresh() {
  const workouts = loadWorkouts();
  renderList(workouts);
  updateStats(workouts);
  buildInsights(workouts);
  renderCharts(workouts);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const entry = readForm();
  let workouts = loadWorkouts();

  if (editingId) {
    workouts = workouts.map((w) => (w.id === editingId ? { ...entry, id: editingId } : w));
  } else {
    workouts.push(entry);
  }

  saveWorkouts(workouts);
  resetForm();
  refresh();
});

cancelBtn.addEventListener("click", resetForm);

listEl.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".edit-btn");
  const deleteBtn = e.target.closest(".delete-btn");

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    if (confirm("Delete this workout?")) {
      saveWorkouts(loadWorkouts().filter((w) => w.id !== id));
      if (editingId === id) resetForm();
      refresh();
    }
    return;
  }

  if (editBtn) {
    const w = loadWorkouts().find((x) => x.id === editBtn.dataset.id);
    if (!w) return;
    editingId = w.id;
    $("#workout-id").value = w.id;
    $("#workout-date").value = w.date;
    $("#workout-type").value = w.type;
    $("#workout-calories").value = w.calories;
    $("#workout-hours").value = w.hours;
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    form.scrollIntoView({ behavior: "smooth" });
  }
});

function initReveal() {
  const reveals = document.querySelectorAll(".reveal");
  const show = () => reveals.forEach((el, i) => {
    setTimeout(() => el.classList.add("is-visible"), 80 + i * 100);
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    show();
  }
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initTheme() {
  const root = document.documentElement;
  const btn = document.querySelector(".theme-toggle");
  const stored = localStorage.getItem("theme");
  const theme = stored || "dark";
  root.setAttribute("data-theme", theme);
  btn.textContent = theme === "light" ? "☀" : "◐";

  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    btn.textContent = next === "light" ? "☀" : "◐";
    refresh();
  });
}

function initStorageCheck() {
  if (!storageWorks()) {
    $("#storage-banner").hidden = false;
    showToast("Warning: browser storage is blocked — data will not save");
  }
}

$("#save-all-btn")?.addEventListener("click", saveAllNow);
$("#save-all-btn-2")?.addEventListener("click", saveAllNow);
$("#clear-all-btn")?.addEventListener("click", clearAllWorkouts);
$("#export-btn")?.addEventListener("click", exportBackup);
$("#import-input")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importBackup(file);
  e.target.value = "";
});

function initSaveStatus() {
  const count = loadWorkouts().length;
  const status = $("#save-status");
  if (count > 0) {
    status.classList.add("is-saved");
    const when = formatSavedTime(localStorage.getItem(STORAGE_KEY + "-updated"));
    $("#save-status-text").textContent = when
      ? `Welcome back · ${count} saved`
      : `${count} workouts saved`;
    $("#footer-saved").textContent = `${count} workout${count === 1 ? "" : "s"} saved on this laptop`;
  }

  if (
    count >= 4 &&
    !localStorage.getItem(STORAGE_KEY + "-saved-by-user") &&
    !sessionStorage.getItem("fitlog-demo-hint")
  ) {
    sessionStorage.setItem("fitlog-demo-hint", "1");
    setTimeout(() => {
      showToast('Sample workouts? Use "Clear all workouts" then add your own.');
    }, 1200);
  }
}

initStorageCheck();
initTheme();
initNav();
initReveal();
initChartModal();
refresh();
initSaveStatus();
