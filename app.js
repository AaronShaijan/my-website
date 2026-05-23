const STORAGE_KEY = "fitlog-workouts";

const charts = {};
let editingId = null;

const $ = (sel) => document.querySelector(sel);
const form = $("#workout-form");
const listEl = $("#workout-list");
const cancelBtn = $("#cancel-edit");
const submitBtn = $("#submit-btn");

document.getElementById("year").textContent = new Date().getFullYear();
$("#workout-date").valueAsDate = new Date();

function loadWorkouts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWorkouts(workouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  localStorage.setItem(STORAGE_KEY + "-updated", new Date().toISOString());
  notifySaved(workouts.length);
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

function renderList(workouts) {
  if (!workouts.length) {
    listEl.innerHTML =
      '<tr class="empty-row"><td colspan="5">No workouts yet. Add your first session above.</td></tr>';
    return;
  }

  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));

  listEl.innerHTML = sorted
    .map(
      (w) => `
    <tr data-id="${w.id}">
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

function updateStats(workouts) {
  const count = workouts.length;
  const totalCal = workouts.reduce((s, w) => s + w.calories, 0);
  const totalHrs = workouts.reduce((s, w) => s + w.hours, 0);

  $("#stat-count").textContent = count;
  $("#stat-calories").textContent = totalCal.toLocaleString();
  $("#stat-hours").textContent = totalHrs.toFixed(1);
  $("#stat-avg-cal").textContent = count ? Math.round(totalCal / count).toLocaleString() : "0";
}

function buildInsights(workouts) {
  const el = $("#insights");
  if (!workouts.length) {
    el.innerHTML = "";
    return;
  }

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
  const base = [
    "#c8f560",
    "#6eb5ff",
    "#ff8a6b",
    "#c77dff",
    "#ffd166",
    "#4dd4ac",
    "#f472b6",
  ];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function makeChart(id, config) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const styles = getComputedStyle(document.documentElement);
  const muted = styles.getPropertyValue("--muted").trim() || "#9a9a92";
  const text = styles.getPropertyValue("--text").trim() || "#f5f5f0";
  const border = styles.getPropertyValue("--border").trim() || "#2a2a2a";

  charts[id] = new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: text },
        },
      },
      scales: config.type === "doughnut" || config.type === "pie" ? undefined : {
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

function renderCharts(workouts) {
  if (!workouts.length) {
    ["chart-calories-time", "chart-hours-type", "chart-calories-type", "chart-sessions-type", "chart-weekly", "chart-weekday"].forEach(destroyChart);
    return;
  }

  const byDate = {};
  workouts.forEach((w) => {
    byDate[w.date] = (byDate[w.date] || 0) + w.calories;
  });
  const dates = Object.keys(byDate).sort();

  makeChart("chart-calories-time", {
    type: "line",
    data: {
      labels: dates.map(formatDay),
      datasets: [
        {
          label: "Calories",
          data: dates.map((d) => byDate[d]),
          borderColor: "#c8f560",
          backgroundColor: "rgba(200, 245, 96, 0.15)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
  });

  const types = [...new Set(workouts.map((w) => w.type))].sort();
  const hoursByType = types.map((t) =>
    workouts.filter((w) => w.type === t).reduce((s, w) => s + w.hours, 0)
  );
  const calByType = types.map((t) =>
    workouts.filter((w) => w.type === t).reduce((s, w) => s + w.calories, 0)
  );
  const sessionsByType = types.map((t) => workouts.filter((w) => w.type === t).length);
  const colors = chartColors(types.length);

  makeChart("chart-hours-type", {
    type: "bar",
    data: {
      labels: types,
      datasets: [{ label: "Hours", data: hoursByType, backgroundColor: colors }],
    },
  });

  makeChart("chart-calories-type", {
    type: "bar",
    data: {
      labels: types,
      datasets: [{ label: "Calories", data: calByType, backgroundColor: colors }],
    },
  });

  makeChart("chart-sessions-type", {
    type: "doughnut",
    data: {
      labels: types,
      datasets: [{ data: sessionsByType, backgroundColor: colors }],
    },
    options: { scales: undefined },
  });

  const byWeek = {};
  workouts.forEach((w) => {
    const wk = weekKey(w.date);
    byWeek[wk] = (byWeek[wk] || 0) + w.calories;
  });
  const weeks = Object.keys(byWeek).sort().slice(-8);

  makeChart("chart-weekly", {
    type: "bar",
    data: {
      labels: weeks.map((w) => `Week of ${formatDay(w)}`),
      datasets: [
        {
          label: "Calories",
          data: weeks.map((w) => byWeek[w]),
          backgroundColor: "#6eb5ff",
        },
      ],
    },
  });

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hrsByWeekday = weekdays.map((name) =>
    workouts
      .filter((w) => dayOfWeek(w.date) === name)
      .reduce((s, w) => s + w.hours, 0)
  );

  makeChart("chart-weekday", {
    type: "bar",
    data: {
      labels: weekdays.map((d) => d.slice(0, 3)),
      datasets: [
        {
          label: "Hours",
          data: hrsByWeekday,
          backgroundColor: "#4dd4ac",
        },
      ],
    },
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

function initTheme() {
  const root = document.documentElement;
  const btn = document.querySelector(".theme-toggle");
  const stored = localStorage.getItem("theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = stored || (prefersLight ? "light" : "dark");
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

function seedIfEmpty() {
  if (loadWorkouts().length) return;
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  saveWorkouts([
    { id: uid(), date: daysAgo(0), type: "Strength", calories: 420, hours: 1.25 },
    { id: uid(), date: daysAgo(1), type: "Cardio", calories: 580, hours: 0.75 },
    { id: uid(), date: daysAgo(3), type: "HIIT", calories: 510, hours: 1 },
    { id: uid(), date: daysAgo(5), type: "Yoga", calories: 180, hours: 1 },
    { id: uid(), date: daysAgo(7), type: "Strength", calories: 390, hours: 1.5 },
    { id: uid(), date: daysAgo(10), type: "Walk", calories: 220, hours: 2 },
  ]);
}

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
}

initTheme();
seedIfEmpty();
refresh();
initSaveStatus();
