import { auth, db } from "./firebase.js";

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================
   GLOBAL
========================== */
let currentUser = null;
let timerInterval = null;
let seconds = 0;
let isRunning = false;

let totalToday = 0;
let totalWeek = 0;
let totalMonth = 0;
let totalYear = 0;
let streakDays = 0;

let otpSent = false;

/* ==========================
   STORAGE
========================== */
function saveData() {
  localStorage.setItem("studyData", JSON.stringify({
    totalToday,
    totalWeek,
    totalMonth,
    totalYear,
    streakDays,
    lastStudyDate: new Date().toDateString()
  }));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("studyData"));

  if (data) {
    totalToday = data.totalToday || 0;
    totalWeek = data.totalWeek || 0;
    totalMonth = data.totalMonth || 0;
    totalYear = data.totalYear || 0;
    streakDays = data.streakDays || 0;

    const today = new Date().toDateString();
    if (data.lastStudyDate !== today) totalToday = 0;
  }
}

/* ==========================
   INIT
========================== */
window.addEventListener("DOMContentLoaded", () => {
  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    { size: "invisible" }
  );

  loadData();
  loadTimer();
  updateStatsUI();
  setupEnterKeys();

  const savedMode = localStorage.getItem("mode") || "system";
  document.getElementById("modeSelect").value = savedMode;
  applyMode(savedMode);
});

/* ==========================
   AUTH
========================== */
window.sendOTP = async () => {
  const phone = document.getElementById("phone").value;

  if (!phone) return alert("Enter phone number");

  const btn = event.target;
  btn.innerText = "Sending...";
  btn.disabled = true;

  try {
    const result = await signInWithPhoneNumber(
      auth,
      phone,
      window.recaptchaVerifier
    );

    window.confirmationResult = result;
    otpSent = true;

    alert("✅ OTP sent!");
  } catch (err) {
    console.error(err);
    alert("❌ Failed to send OTP");
  }

  btn.innerText = "Send OTP";
  btn.disabled = false;
};

window.verifyOTP = async () => {
  const otp = document.getElementById("otp").value;

  if (!otp) return alert("Enter OTP");

  try {
    await window.confirmationResult.confirm(otp);
    alert("✅ Login successful!");
  } catch (err) {
    console.error(err);
    alert("❌ Invalid OTP");
  }

  document.getElementById("otp").value = "";
};

/* ==========================
   AUTH STATE
========================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    document.getElementById("authBox").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    // ✅ LOAD PROFILE FROM FIRESTORE
    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {
      const data = snap.data();

      if (data.name) {
        document.getElementById("welcomeText").innerText =
          `Welcome, ${data.name} 👋`;
      }

      if (data.photo) {
        document.getElementById("profileImage").src = data.photo;
      }

      document.getElementById("userInfo").innerText =
        user.phoneNumber;
    }
  } else {
    document.getElementById("authBox").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
  }
});
/* ==========================
   PROFILE
========================== */
async function loadProfile(user) {
  const snap = await getDoc(doc(db, "users", user.uid));

  document.getElementById("authBox").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  if (snap.exists()) {
    const data = snap.data();

    document.getElementById("welcomeText").innerText =
      `Welcome, ${data.name || "User"} 👋`;

    document.getElementById("userInfo").innerText = user.phoneNumber;

    if (data.photo) {
      document.getElementById("profileImage").src = data.photo;
    }
  }
}

window.saveProfile = async () => {
  const name = document.getElementById("nameInput").value;

  if (!name) return alert("Enter name");

  await setDoc(doc(db, "users", currentUser.uid), {
    name,
    phone: currentUser.phoneNumber
  });

  loadProfile(currentUser);
};

/* ==========================
   TIMER
========================== */
function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

window.startStudy = () => {
  if (isRunning) return;

  isRunning = true;
  updateStreak();

  timerInterval = setInterval(() => {
    seconds++;

    totalToday++;
    totalWeek++;
    totalMonth++;
    totalYear++;

    document.getElementById("timer").innerText = formatTime(seconds);

    updateStatsUI();
    saveData();
  }, 1000);
};

window.stopStudy = () => {
  clearInterval(timerInterval);
  isRunning = false;
};

window.resetTimer = () => {
  clearInterval(timerInterval);
  isRunning = false;
  seconds = 0;
  document.getElementById("timer").innerText = "00:00:00";
};

/* ==========================
   TIMER RECOVERY
========================== */
window.addEventListener("beforeunload", () => {
  localStorage.setItem("timerSeconds", seconds);
});

function loadTimer() {
  const saved = localStorage.getItem("timerSeconds");
  if (saved) {
    seconds = parseInt(saved);
    document.getElementById("timer").innerText = formatTime(seconds);
  }
}

/* ==========================
   STATS
========================== */
function formatStats(sec) {
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function updateStatsUI() {
  document.getElementById("todayTime").innerText = formatStats(totalToday);

  const range = document.getElementById("rangeSelect").value;

  let value = totalWeek;
  if (range === "month") value = totalMonth;
  if (range === "year") value = totalYear;

  document.getElementById("rangeTime").innerText = formatStats(value);
  document.getElementById("streak").innerText = `🔥 ${streakDays} days`;
}

window.changeRange = updateStatsUI;

/* ==========================
   STREAK
========================== */
function updateStreak() {
  const today = new Date().toDateString();
  const last = localStorage.getItem("lastActiveDate");

  const yesterday = new Date();
  yesterday.setDate(new Date().getDate() - 1);

  if (last === today) return;

  if (last === yesterday.toDateString()) {
    streakDays++;
  } else {
    streakDays = 1;
  }

  localStorage.setItem("lastActiveDate", today);
  saveData();
}

/* ==========================
   🔒 ADVANCED DND MODE (SMART)
========================== */
let dndInterval = null;
let dndSeconds = 0;
let dndActive = false;
let dndPaused = false;

let distractionCount = 0;
let distractionStart = null;
let totalDistractionTime = 0;

// 🚨 TAB SWITCH
document.addEventListener("visibilitychange", () => {
  if (!dndActive) return;

  if (document.hidden) {
    pauseDND();
  } else {
    resumeDND();
  }
});

// 🚨 WINDOW SWITCH
window.addEventListener("blur", () => {
  if (dndActive) pauseDND();
});

window.addEventListener("focus", () => {
  if (dndActive) resumeDND();
});

// ▶ START
window.startDND = async () => {
  if (dndActive) return;

  dndSeconds = parseInt(document.getElementById("dndTime").value);
  dndActive = true;
  dndPaused = false;

  distractionCount = 0;
  totalDistractionTime = 0;

  // 🔒 FULLSCREEN
  const el = document.documentElement;
  if (el.requestFullscreen) await el.requestFullscreen();

  document.getElementById("dndOverlay").style.display = "flex";

  startDNDTimer();
};

// ⏱ TIMER
function startDNDTimer() {
  clearInterval(dndInterval);

  dndInterval = setInterval(() => {
    if (!dndPaused) {
      dndSeconds--;
      updateDND();
    }

    if (dndSeconds <= 0) {
      completeDND();
    }
  }, 1000);
}

// 🔄 UPDATE UI
function updateDND() {
  const m = String(Math.floor(dndSeconds / 60)).padStart(2, "0");
  const s = String(dndSeconds % 60).padStart(2, "0");

  document.getElementById("dndRemaining").innerText = `${m}:${s}`;
  document.getElementById("dndTimer").innerText = `${m}:${s}`;
}

// ⏸ PAUSE
function pauseDND() {
  if (dndPaused) return;

  dndPaused = true;
  distractionCount++;
  distractionStart = Date.now();

  const warningText = `⚠️ Do not get distracted! (${distractionCount})`;

  // 🔥 SHOW WARNING ON SCREEN
  document.getElementById("dndRemaining").innerText = warningText;

  // 🔔 OPTIONAL ALERT (only once per distraction)
  setTimeout(() => {
    alert("⚠️ Do not get distracted!");
  }, 100);

  // ⏸ Pause study timer
  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;
  }
}

// ▶ RESUME
function resumeDND() {
  if (!dndPaused) return;

  dndPaused = false;

  // calculate distraction time
  if (distractionStart) {
    totalDistractionTime += Math.floor((Date.now() - distractionStart) / 1000);
    distractionStart = null;
  }

  updateDND();
}

// ✅ COMPLETE
async function completeDND() {
  clearInterval(dndInterval);
  dndActive = false;
  dndPaused = false;

  document.getElementById("dndOverlay").style.display = "none";

  // exit fullscreen
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }

  alert(
    `✅ Focus Complete!\n\nDistractions: ${distractionCount}\nLost Time: ${Math.floor(totalDistractionTime / 60)} min`
  );
}
/* ==========================
   SUBJECT → TOPIC
========================== */
const subjectTopics = {
  mathematics: ["Algebra","Calculus","Geometry"],
  science: ["Physics","Chemistry","Biology"],
  programming: ["JavaScript","Python","React"],
  commerce: ["Accounting","Economics"],
  humanities: ["History","Psychology"],
  languages: ["Grammar","Writing"],
  exams: ["UPSC","JEE"],
  skills: ["Focus","Time Management"],
  technology: ["Cyber Security"],
  design: ["UI Design"]
};

window.loadTopics = () => {
  const subject = document.getElementById("subjectSelect").value;
  const topicSelect = document.getElementById("topicSelect");

  topicSelect.innerHTML = `<option value="">Select Topic</option>`;

  if (!subjectTopics[subject]) return;

  subjectTopics[subject].forEach(topic => {
    const opt = document.createElement("option");
    opt.value = topic;
    opt.textContent = topic;
    topicSelect.appendChild(opt);
  });
};

window.fillTopicInput = () => {
  document.getElementById("topicInput").value =
    document.getElementById("topicSelect").value;
};

/* ==========================
   RECOMMENDATION
========================== */
window.getRecommendations = () => {
  const subject = document.getElementById("subjectSelect").value;
  const topic = document.getElementById("topicInput").value;
  const level = document.getElementById("levelSelect").value;

  if (!topic) return alert("Enter topic");

  // 🔥 Build smarter query
  const query = `${topic} ${level} ${subject}`;

  const encodedQuery = encodeURIComponent(query);

  const youtubeLink = `https://www.youtube.com/results?search_query=${encodedQuery}`;
  const articleLink = `https://www.google.com/search?q=${encodeURIComponent(query + " tutorial explanation notes")}`;

  document.getElementById("recommendResults").innerHTML = `
    <div class="resultCard">
      <h4>🎥 YouTube (${level || "All Levels"})</h4>
      <a target="_blank" href="${youtubeLink}">
        Watch ${level || ""} videos on ${topic}
      </a>
    </div>

    <div class="resultCard">
      <h4>📄 Articles (${level || "All Levels"})</h4>
      <a target="_blank" href="${articleLink}">
        Read ${level || ""} articles on ${topic}
      </a>
    </div>
  `;
};

/* ==========================
   MODE + CLOCK
========================== */
window.changeMode = () => {
  const mode = document.getElementById("modeSelect").value;
  localStorage.setItem("mode", mode);
  applyMode(mode);
};

function applyMode(mode) {
  document.body.classList.toggle("light", mode === "light");
}

setInterval(() => {
  const now = new Date();
  document.getElementById("clock").innerText =
    now.toLocaleTimeString();
}, 1000);

/* ==========================
   UTIL
========================== */
function setDailyQuote() {
  const quotes = [
    "Discipline beats motivation.",
    "Stay consistent.",
    "Focus now, win later."
  ];
  document.getElementById("quoteText").innerText =
    quotes[new Date().getDate() % quotes.length];
}

window.logout = () => signOut(auth);

function setupEnterKeys() {
  document.getElementById("phone")?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendOTP();
  });

  document.getElementById("otp")?.addEventListener("keypress", e => {
    if (e.key === "Enter") verifyOTP();
  });
}
window.toggleProfileEdit = () => {
  const box = document.getElementById("profileEditBox");
  box.style.display = box.style.display === "none" ? "block" : "none";
};
document.getElementById("photoInput")?.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const preview = document.getElementById("previewImage");
    preview.src = e.target.result;
    preview.style.display = "block";
  };

  reader.readAsDataURL(file);
});
window.saveProfile = async () => {
  const name = document.getElementById("nameInput").value;
  const file = document.getElementById("photoInput").files[0];

  if (!name) return alert("Enter name");

  let photoURL = "";

  if (file) {
    const reader = new FileReader();

    reader.onloadend = async () => {
      photoURL = reader.result;

      await setDoc(doc(db, "users", currentUser.uid), {
        name,
        photo: photoURL,
        phone: currentUser.phoneNumber
      });

      updateProfileUI(name, photoURL);
    };

    reader.readAsDataURL(file);
  } else {
    await setDoc(doc(db, "users", currentUser.uid), {
      name,
      phone: currentUser.phoneNumber
    });

    updateProfileUI(name, "");
  }
};
function updateProfileUI(name, photo) {
  document.getElementById("welcomeText").innerText =
    `Welcome, ${name} 👋`;

  if (photo) {
    document.getElementById("profileImage").src = photo;
  }

  document.getElementById("profileEditBox").style.display = "none";
}