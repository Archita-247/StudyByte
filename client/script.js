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
let quizLevel = localStorage.getItem("quizLevel") || "Beginner";


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

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible"
      }
    );
  }

  loadData();
  loadTimer();
  updateStatsUI();
  setupEnterKeys();
  renderSmartPlanner();

  const savedMode = localStorage.getItem("mode") || "system";
  document.getElementById("modeSelect").value = savedMode;
  applyMode(savedMode);

  // ✅ ALSO HIDE SIDEBAR INITIALLY
  document.getElementById("sidebar").style.display = "none";
  document.getElementById("menuBtn").style.display = "none";
  const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

// OPEN sidebar when hovering ☰
menuBtn.addEventListener("mouseenter", () => {
  sidebar.classList.add("active");
});

// KEEP open inside sidebar
sidebar.addEventListener("mouseenter", () => {
  sidebar.classList.add("active");
});

// CLOSE when mouse leaves both
document.addEventListener("mousemove", (e) => {
  const isOverMenu = menuBtn.contains(e.target);
  const isOverSidebar = sidebar.contains(e.target);

  if (!isOverMenu && !isOverSidebar) {
    sidebar.classList.remove("active");
  }
});
const otpInput = document.getElementById("otp");
const toggleOtp = document.getElementById("toggleOtp");

if (toggleOtp) {
  toggleOtp.addEventListener("click", () => {
    if (otpInput.type === "password") {
      otpInput.type = "text";
      toggleOtp.textContent = "🙈";
    } else {
      otpInput.type = "password";
      toggleOtp.textContent = "👁";
    }
  });
}
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

    // ✅ MARK OTP SENT
    otpSent = true;

    // ✅ SHOW OTP SECTION
    document.getElementById("otpSection").style.display = "block";

    alert("✅ OTP sent!");

  } catch (err) {
    console.error(err);
    alert("❌ Failed to send OTP");
  }

  btn.innerText = "Send OTP";
  btn.disabled = false;
};


window.verifyOTP = async () => {
  if (!otpSent) return alert("Send OTP first");

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
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");

  if (user) {
    currentUser = user;

    // ✅ SHOW dashboard
    document.getElementById("authBox").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    // ✅ SHOW sidebar + menu button
    sidebar.style.display = "block";
    menuBtn.style.display = "block";

    // LOAD PROFILE
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
    // ❌ HIDE dashboard
    document.getElementById("authBox").style.display = "block";
    document.getElementById("dashboard").style.display = "none";

    // ❌ HIDE sidebar + menu button
    sidebar.style.display = "none";
    menuBtn.style.display = "none";
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
  mathematics: [
    "Algebra", "Linear Algebra", "Calculus", "Trigonometry", "Geometry",
    "Coordinate Geometry", "Probability", "Statistics", "Number System",
    "Differential Equations", "Discrete Mathematics", "Matrices"
  ],
  science: [
    "Scientific Method", "Matter", "Atoms and Molecules", "Energy",
    "Forces", "Motion", "Earth Science", "Environment", "Space Science"
  ],
  physics: [
    "Mechanics", "Kinematics", "Laws of Motion", "Work Energy Power",
    "Gravitation", "Thermodynamics", "Waves", "Optics", "Electricity",
    "Magnetism", "Modern Physics", "Semiconductors"
  ],
  chemistry: [
    "Atomic Structure", "Periodic Table", "Chemical Bonding", "Stoichiometry",
    "Acids Bases Salts", "Organic Chemistry", "Hydrocarbons", "Electrochemistry",
    "Thermodynamics", "Chemical Kinetics", "Coordination Compounds"
  ],
  biology: [
    "Cell Biology", "Genetics", "Evolution", "Human Physiology",
    "Plant Physiology", "Ecology", "Biotechnology", "Microbiology",
    "Reproduction", "Nutrition", "Diseases and Immunity"
  ],
  programming: [
    "JavaScript", "Python", "React", "Node.js", "HTML CSS",
    "Data Structures", "Algorithms", "Object Oriented Programming",
    "Databases", "APIs", "Git and GitHub", "Debugging"
  ],
  computer_science: [
    "Operating Systems", "Computer Networks", "DBMS", "SQL",
    "Compiler Design", "Software Engineering", "Cloud Computing",
    "Artificial Intelligence", "Machine Learning", "Cyber Security"
  ],
  commerce: [
    "Accounting", "Economics", "Business Studies", "Marketing",
    "Finance", "Banking", "Taxation", "Auditing", "Entrepreneurship",
    "Business Law", "Management"
  ],
  humanities: [
    "History", "Geography", "Political Science", "Sociology",
    "Psychology", "Philosophy", "Civics", "World History",
    "Indian Constitution", "International Relations"
  ],
  languages: [
    "English Grammar", "Writing Skills", "Reading Comprehension",
    "Vocabulary", "Essay Writing", "Letter Writing", "Public Speaking",
    "Hindi Grammar", "Creative Writing"
  ],
  exams: [
    "UPSC", "JEE", "NEET", "GATE", "CAT", "CUET", "SSC",
    "Banking Exams", "Railway Exams", "CLAT", "IELTS", "TOEFL"
  ],
  skills: [
    "Focus", "Time Management", "Note Taking", "Memory Techniques",
    "Revision Planning", "Productivity", "Communication", "Critical Thinking",
    "Problem Solving", "Presentation Skills"
  ],
  technology: [
    "Cyber Security", "Artificial Intelligence", "Machine Learning",
    "Data Science", "Web Development", "App Development", "Blockchain",
    "Internet of Things", "Cloud Computing", "DevOps"
  ],
  design: [
    "UI Design", "UX Design", "Graphic Design", "Color Theory",
    "Typography", "Wireframing", "Design Systems", "Figma",
    "User Research", "Prototyping"
  ],
  arts: [
    "Drawing", "Painting", "Music Theory", "Photography", "Film Studies",
    "Animation", "Theatre", "Creative Process", "Art History"
  ],
  health: [
    "Anatomy", "Nutrition", "Mental Health", "First Aid", "Fitness",
    "Public Health", "Yoga", "Sleep Science", "Stress Management"
  ],
  general_knowledge: [
    "Current Affairs", "Indian Polity", "World Geography", "Sports",
    "Awards", "Books and Authors", "Important Days", "Science GK",
    "Indian Economy", "Static GK"
  ]
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

window.getRecommendations = () => {
  const subject = document.getElementById("subjectSelect").value || "general";
  const topic = document.getElementById("topicInput").value.trim();
  const level = document.getElementById("levelSelect").value || "Beginner";

  if (!topic) return alert("Enter topic");

  const query = `${topic} ${level} ${subject}`;
  const encodedQuery = encodeURIComponent(query);
  const safeTopic = topic
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const plans = {
    Beginner: {
      priority: "Build the foundation first",
      time: "35 min",
      steps: ["Watch one clear intro lesson", "Write 8-10 key points", "Solve 5 easy examples"]
    },
    Intermediate: {
      priority: "Move from understanding to application",
      time: "50 min",
      steps: ["Review core rules", "Solve 10 mixed questions", "Explain each mistake in your own words"]
    },
    Hard: {
      priority: "Master advanced problems and exam-style traps",
      time: "75 min",
      steps: ["Review edge cases and advanced concepts", "Solve 15 timed hard questions", "Redo every mistake without looking at the solution"]
    }
  };
  const plan = plans[level] || plans.Beginner;
  const youtubeLink = `https://www.youtube.com/results?search_query=${encodedQuery}+explained`;
  const articleLink = `https://www.google.com/search?q=${encodeURIComponent(query + " tutorial explanation notes")}`;
  const practiceLink = `https://www.google.com/search?q=${encodeURIComponent(query + " practice questions with answers")}`;
  const flashcardLink = `https://www.google.com/search?q=${encodeURIComponent(query + " flashcards key points")}`;

  document.getElementById("recommendResults").innerHTML = `
    <div class="recommendHero">
      <div>
        <span>Recommended path</span>
        <h4>${safeTopic}</h4>
        <p>${plan.priority}</p>
      </div>
      <div class="recommendTime">
        <b>${plan.time}</b>
        <span>focused sprint</span>
      </div>
    </div>

    <div class="recommendImpactGrid">
      <div class="recommendPlanCard">
        <h4>Study plan</h4>
        ${plan.steps.map((item, index) => `
          <div class="recommendStep">
            <b>${index + 1}</b>
            <span>${item}</span>
          </div>
        `).join("")}
      </div>

      <div class="recommendResourceCard">
        <h4>Best resources</h4>
        <a target="_blank" href="${youtubeLink}">Video lesson</a>
        <a target="_blank" href="${articleLink}">Clear notes</a>
        <a target="_blank" href="${practiceLink}">Practice set</a>
        <a target="_blank" href="${flashcardLink}">Flashcards</a>
      </div>

      <div class="recommendFocusCard">
        <h4>How to use this</h4>
        <p>Start with one resource, then test yourself immediately. Practice beats collecting links.</p>
        <div>
          <span>Level <b>${level}</b></span>
          <span>Subject <b>${subject}</b></span>
        </div>
      </div>
    </div>
  `;
};

/* ==========================
   SMART STUDY PLANNER
========================== */
function getSmartPlanner() {
  try {
    return JSON.parse(localStorage.getItem("smartStudyPlanner") || "null");
  } catch {
    return null;
  }
}

function setSmartPlanner(plan) {
  localStorage.setItem("smartStudyPlanner", JSON.stringify(plan));
}

function escapePlannerHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPlannerDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getPlannerFocusSteps(mode, level) {
  const focusSteps = {
    balanced: ["Learn", "Practice", "Revise", "Check progress"],
    revision: ["Revise notes", "Recall without notes", "Fix weak points", "Mini test"],
    practice: ["Review examples", "Timed practice", "Mistake analysis", "Retest"],
    exam: ["High-weight topic", "Timed questions", "Error log", "Exam recap"]
  };

  const levelAddOn = {
    Beginner: "Keep notes simple and build confidence.",
    Intermediate: "Connect ideas and solve mixed questions.",
    Advanced: "Use timed work and focus on edge cases."
  };

  return {
    steps: focusSteps[mode] || focusSteps.balanced,
    note: levelAddOn[level] || levelAddOn.Beginner
  };
}

window.loadPlannerTopics = () => {
  const subject = document.getElementById("plannerSubject").value;
  const topicSelect = document.getElementById("plannerTopic");

  topicSelect.innerHTML = `<option value="">Select Topic</option>`;

  const topics = subjectTopics[subject] || [];

  topics.forEach(topic => {
    const opt = document.createElement("option");
    opt.value = topic;
    opt.textContent = topic;
    topicSelect.appendChild(opt);
  });
};

window.fillPlannerTopicInput = () => {
  document.getElementById("plannerCustomTopic").value =
    document.getElementById("plannerTopic").value;
};

window.generateSmartPlanner = () => {
  const preparingFor = document.getElementById("plannerPreparingFor").value;
  const subjectValue = document.getElementById("plannerSubject").value;
  const subjectLabel = document.getElementById("plannerSubject").selectedOptions[0]?.textContent || "";
  const topic = document.getElementById("plannerCustomTopic").value.trim();
  const level = document.getElementById("plannerLevel").value || "Beginner";
  const days = Math.max(1, Math.min(90, parseInt(document.getElementById("plannerDuration").value) || 7));
  const dailyMinutes = Math.max(30, Math.min(360, parseInt(document.getElementById("plannerDailyTime").value) || 120));
  const target = document.getElementById("plannerTarget").value.trim() || "Complete the planned study target";
  const focus = document.getElementById("plannerFocus").value || "balanced";

  if (!preparingFor) {
    alert("Choose what you are preparing for");
    return;
  }

  if (!subjectValue) {
    alert("Choose a subject");
    return;
  }

  if (!topic) {
    alert("Choose or type a topic");
    return;
  }

  const totalMinutes = dailyMinutes;
  const blocksPerDay = Math.min(4, Math.max(2, Math.ceil(totalMinutes / 45)));
  const baseMinutes = Math.floor(totalMinutes / blocksPerDay);
  const { steps, note } = getPlannerFocusSteps(focus, level);
  const startDate = new Date();
  const tasks = [];
  const milestones = ["Foundation", "Deep study", "Practice", "Revision", "Test readiness"];

  for (let day = 1; day <= days; day++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day - 1);
    const milestone = milestones[Math.min(milestones.length - 1, Math.floor(((day - 1) / days) * milestones.length))];

    for (let block = 0; block < blocksPerDay; block++) {
      const step = steps[(day + block - 1) % steps.length];
      const minutes = block === blocksPerDay - 1
        ? totalMinutes - (baseMinutes * (blocksPerDay - 1))
        : baseMinutes;

      tasks.push({
        id: `${Date.now()}-${day}-${block}`,
        day,
        date: getPlannerDateKey(date),
        subject: subjectLabel,
        topic,
        milestone,
        focus: step,
        minutes,
        detail: `${step}: ${topic}. ${note}`,
        completed: false,
        completedAt: null
      });
    }
  }

  const plan = {
    id: Date.now().toString(),
    preparingFor,
    goal: `${preparingFor} - ${topic}`,
    subject: subjectLabel,
    topic,
    level,
    target,
    days,
    dailyMinutes,
    focus,
    createdAt: new Date().toISOString(),
    tasks
  };

  setSmartPlanner(plan);
  renderSmartPlanner();
};

window.togglePlannerTask = (taskId) => {
  const plan = getSmartPlanner();
  if (!plan) return;

  plan.tasks = plan.tasks.map(task => {
    if (task.id !== taskId) return task;

    const completed = !task.completed;
    return {
      ...task,
      completed,
      completedAt: completed ? new Date().toISOString() : null
    };
  });

  setSmartPlanner(plan);
  renderSmartPlanner();
};

window.completeNextPlannerTask = () => {
  const plan = getSmartPlanner();
  if (!plan) return;

  const nextTask = plan.tasks.find(task => !task.completed);
  if (!nextTask) {
    alert("All planner tasks are already complete");
    return;
  }

  nextTask.completed = true;
  nextTask.completedAt = new Date().toISOString();
  setSmartPlanner(plan);
  renderSmartPlanner();
};

window.clearSmartPlanner = () => {
  localStorage.removeItem("smartStudyPlanner");
  renderSmartPlanner();
};

window.openSmartPlanner = () => {
  document.getElementById("dashboard").style.display = "block";
  document.getElementById("smartPlannerSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

function renderSmartPlanner() {
  const progressEl = document.getElementById("plannerProgress");
  const resultsEl = document.getElementById("plannerResults");
  if (!progressEl || !resultsEl) return;

  const plan = getSmartPlanner();
  if (!plan) {
    progressEl.innerHTML = "";
    resultsEl.innerHTML = `
      <div class="plannerEmpty">
        <h4>No schedule yet</h4>
        <p>Enter a goal, add subjects, and generate a plan. Your progress will be saved here.</p>
      </div>
    `;
    return;
  }

  const totalTasks = plan.tasks.length;
  const completedTasks = plan.tasks.filter(task => task.completed).length;
  const totalMinutes = plan.tasks.reduce((sum, task) => sum + task.minutes, 0);
  const completedMinutes = plan.tasks
    .filter(task => task.completed)
    .reduce((sum, task) => sum + task.minutes, 0);
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todayKey = getPlannerDateKey(new Date());
  const todayTasks = plan.tasks.filter(task => task.date === todayKey);
  const remainingToday = todayTasks.filter(task => !task.completed).length;
  const overdueTasks = plan.tasks.filter(task => task.date < todayKey && !task.completed);
  const nextTask = plan.tasks.find(task => !task.completed);
  const completedToday = todayTasks.filter(task => task.completed).length;
  const remainingMinutes = plan.tasks
    .filter(task => !task.completed)
    .reduce((sum, task) => sum + task.minutes, 0);
  const milestoneStats = [...new Set(plan.tasks.map(task => task.milestone || "Study"))]
    .map(milestone => {
      const milestoneTasks = plan.tasks.filter(task => (task.milestone || "Study") === milestone);
      const done = milestoneTasks.filter(task => task.completed).length;
      return {
        milestone,
        done,
        total: milestoneTasks.length,
        percent: milestoneTasks.length ? Math.round((done / milestoneTasks.length) * 100) : 0
      };
    });
  const plannerAdvice = overdueTasks.length
    ? "Clear overdue work first, then continue today's schedule."
    : remainingToday
      ? "Finish today's blocks before adding extra study."
      : progress >= 100
        ? "Plan complete. Generate a harder revision cycle when ready."
        : "You are clear for today. Keep the next block ready.";
  const days = [...new Set(plan.tasks.map(task => task.date))];

  progressEl.innerHTML = `
    <div class="plannerProgressCard">
      <div class="plannerProgressTop">
        <div>
          <span>Current plan</span>
          <h4>${escapePlannerHTML(plan.goal)}</h4>
          <p>${escapePlannerHTML(plan.subject || "Subject")} | Target: ${escapePlannerHTML(plan.target || "Complete plan")}</p>
        </div>
        <div class="plannerRing" style="--planner-progress:${progress}">
          <b>${progress}%</b>
        </div>
      </div>

      <div class="plannerStats">
        <span>Completed <b>${completedTasks}/${totalTasks}</b></span>
        <span>Study record <b>${formatStats(completedMinutes * 60)} / ${formatStats(totalMinutes * 60)}</b></span>
        <span>Today left <b>${remainingToday}</b></span>
        <span>Level <b>${escapePlannerHTML(plan.level)}</b></span>
      </div>

      <div class="plannerInsights">
        <section class="plannerInsightMain">
          <span>Next best action</span>
          <h4>${nextTask ? escapePlannerHTML(nextTask.focus) : "Plan complete"}</h4>
          <p>${nextTask
            ? `${escapePlannerHTML(nextTask.topic || plan.topic)} | ${nextTask.minutes} min | ${escapePlannerHTML(nextTask.milestone || "Study")}`
            : "Every task in this plan is marked done."}</p>
          <button class="smallBtn" onclick="completeNextPlannerTask()">Complete Next Task</button>
        </section>

        <section class="plannerInsightPanel">
          <span>Plan health</span>
          <h4>${overdueTasks.length ? `${overdueTasks.length} overdue` : "On track"}</h4>
          <p>${escapePlannerHTML(plannerAdvice)}</p>
        </section>

        <section class="plannerInsightPanel">
          <span>Today</span>
          <h4>${completedToday}/${todayTasks.length || 0} done</h4>
          <p>${formatStats(remainingMinutes * 60)} remaining in this plan.</p>
        </section>
      </div>

      <div class="plannerMilestones">
        ${milestoneStats.map(item => `
          <div class="plannerMilestoneRow">
            <span>${escapePlannerHTML(item.milestone)}</span>
            <div><i style="width:${item.percent}%"></i></div>
            <b>${item.done}/${item.total}</b>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  resultsEl.innerHTML = `
    <div class="plannerSchedule">
      ${days.map((dateKey, index) => {
        const dayTasks = plan.tasks.filter(task => task.date === dateKey);
        const completed = dayTasks.filter(task => task.completed).length;
        const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric"
        });

        return `
          <section class="plannerDay">
            <div class="plannerDayHeader">
              <div>
                <span>Day ${index + 1}</span>
                <h4>${dateLabel}</h4>
              </div>
              <b>${completed}/${dayTasks.length}</b>
            </div>

            ${dayTasks.map(task => `
              <div class="plannerTask ${task.completed ? "done" : ""}">
                <button onclick="togglePlannerTask('${task.id}')" title="Mark progress">
                  ${task.completed ? "Done" : "Todo"}
                </button>
                <div>
                  <strong>${escapePlannerHTML(task.subject)}</strong>
                  <p>${escapePlannerHTML(task.milestone || "Study")} | ${escapePlannerHTML(task.detail)}</p>
                </div>
                <span>${task.minutes} min</span>
              </div>
            `).join("")}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

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
// ===== SIDEBAR SMART HOVER FIX =====
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");

  if (!menuBtn || !sidebar) return;

  let isPinned = false; // for click behavior

  // 🔹 OPEN
  const openSidebar = () => {
    sidebar.classList.add("active");
  };

  // 🔹 CLOSE
  const closeSidebar = () => {
    if (!isPinned) {
      sidebar.classList.remove("active");
    }
  };

  // 🔹 CLICK → PIN / UNPIN
  menuBtn.addEventListener("click", () => {
    isPinned = !isPinned;

    if (isPinned) {
      sidebar.classList.add("active");
    } else {
      sidebar.classList.remove("active");
    }
  });

  // 🔹 HOVER BUTTON → OPEN
  menuBtn.addEventListener("mouseenter", openSidebar);

  // 🔹 MOVE INTO SIDEBAR → KEEP OPEN
  sidebar.addEventListener("mouseenter", openSidebar);

  // 🔹 LEAVE SIDEBAR → CLOSE (only if not pinned)
  sidebar.addEventListener("mouseleave", closeSidebar);
});
// ===== REPORT ISSUE FEATURE =====

// OPEN MODAL
window.openIssueModal = () => {
  document.getElementById("issueModal").style.display = "flex";
};

// CLOSE MODAL
window.closeIssueModal = () => {
  document.getElementById("issueModal").style.display = "none";
};

// SUBMIT ISSUE
window.submitIssue = async () => {
  const text = document.getElementById("issueText").value;

  if (!text) return alert("Please describe your issue");

  try {
    await setDoc(doc(db, "issues", Date.now().toString()), {
      text,
      user: currentUser?.phoneNumber || "unknown",
      createdAt: new Date().toISOString()
    });

    alert("✅ Issue submitted!");

    document.getElementById("issueText").value = "";
    closeIssueModal();

  } catch (err) {
    console.error(err);
    alert("❌ Failed to submit issue");
  }
};
// ===== AI SUMMARY =====

// OPEN
window.openAISummary = () => {
  document.getElementById("aiSummarySection").style.display = "block";
};

// CLOSE
window.closeAISummary = () => {
  document.getElementById("aiSummarySection").style.display = "none";
  document.getElementById("summaryOutput").innerHTML = "";
};
window.generateSummary = async () => {
  const text = document.getElementById("summaryInput").value;
  const file = document.getElementById("fileInput").files[0];
  const youtube = document.getElementById("youtubeInput").value;

  const output = document.getElementById("summaryOutput");
  output.innerHTML = "⏳ Processing...";

  try {
    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    }

    if (youtube) {
      formData.append("youtube", youtube);
    }

    if (text) {
      formData.append("text", text);
    }

    const res = await fetch("https://studybyte-ssuq.onrender.com/api/summary", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.summary) {
      output.innerHTML = "❌ Failed";
      return;
    }

    output.innerHTML = `<div class="resultCard">${data.summary}</div>`;

  } catch (err) {
    console.error(err);
    output.innerHTML = "❌ Error";
  }
};


// ===== AI SUMMARY =====

// OPEN
window.openAISummary = () => {
  document.getElementById("aiSummarySection").style.display = "block";
};

// CLOSE
window.closeAISummary = () => {
  document.getElementById("aiSummarySection").style.display = "none";
  document.getElementById("summaryOutput").innerHTML = "";
  resetSummaryForm();
};

function resetSummaryForm() {
  document.getElementById("summaryInput").value = "";
  document.getElementById("fileInput").value = "";
  document.getElementById("youtubeInput").value = "";
}

// GENERATE
window.generateSummary = async () => {
  const text = document.getElementById("summaryInput").value.trim();
  const file = document.getElementById("fileInput").files[0];
  const youtube = document.getElementById("youtubeInput").value.trim();

  const output = document.getElementById("summaryOutput");

  // 🚨 VALIDATION
  if (!text && !file && !youtube) {
    alert("Please enter text, upload a file, or provide a YouTube link");
    return;
  }

  output.innerHTML = "⏳ Processing...";

  try {
    const formData = new FormData();

    // PRIORITY: file > youtube > text
    if (file) {
      formData.append("file", file);
    } else if (youtube) {
      formData.append("youtube", youtube);
    } else {
      formData.append("text", text);
    }

    const res = await fetch("https://studybyte-ssuq.onrender.com/api/summary", {
      method: "POST",
      body: formData
    });

    // 🔴 ERROR HANDLING
    if (!res.ok) {
      const err = await res.text();
      console.error("API Error:", err);
      output.innerHTML = "❌ Failed to generate summary";
      return;
    }

    const data = await res.json();

    if (!data.summary) {
      output.innerHTML = "❌ No summary returned";
      return;
    }

    // ✅ FORMAT OUTPUT
    const formatted = data.summary.replace(/\n/g, "<br>");

    output.innerHTML = `
      <div class="resultCard">
        <h4>📌 Summary</h4>
        <p>${formatted}</p>
      </div>
    `;

    resetSummaryForm();

  } catch (err) {
    console.error("CLIENT ERROR:", err);
    output.innerHTML = "❌ Something went wrong";
  }
};

// ===== AI SUMMARY PREMIUM UPGRADE =====

let lastSummaryResult = null;

function summaryEscapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSavedSummaries() {
  try {
    return JSON.parse(localStorage.getItem("savedSummaries") || "[]");
  } catch {
    return [];
  }
}

function setSavedSummaries(items) {
  localStorage.setItem("savedSummaries", JSON.stringify(items));
}

function ensureSummaryPremiumUI() {
  const section = document.getElementById("aiSummarySection");
  if (!section || section.querySelector(".summary-shell")) return;

  section.innerHTML = `
    <div class="summary-shell">
      <div class="summary-header">
        <div>
          <h2>AI Summary</h2>
          <p>Turn notes, files, images, or YouTube topics into focused study material.</p>
        </div>
        <button onclick="closeAISummary()" style="background:#444;">Close</button>
      </div>

      <div class="summary-control-grid">
        <label>
          Summary mode
          <select id="summaryMode">
            <option value="study">Study Notes</option>
            <option value="exam">Exam Prep</option>
            <option value="flashcards">Flashcards</option>
            <option value="simplify">Simplify</option>
          </select>
        </label>

        <label>
          Length
          <select id="summaryLength">
            <option value="medium">Medium</option>
            <option value="short">Short</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
      </div>

      <div class="summary-input-grid">
        <div class="summary-input-card">
          <label for="fileInput">Upload source</label>
          <input type="file" id="fileInput" accept=".txt,.pdf,.docx,image/*" />
        </div>

        <div class="summary-input-card">
          <label for="youtubeInput">YouTube source</label>
          <input type="text" id="youtubeInput" placeholder="Paste YouTube link..." />
        </div>
      </div>

      <textarea id="summaryInput" placeholder="Paste your notes or text here..."></textarea>

      <div class="summary-actions">
        <button id="generateSummaryBtn" onclick="generateSummary()">Generate Summary</button>
        <button onclick="viewSavedSummaries()" style="background:#444;">Saved</button>
        <button onclick="clearSummaryWorkspace()" style="background:#444;">Clear</button>
      </div>

      <div id="summaryOutput"></div>
    </div>
  `;
}

function getSummaryStats(text = "") {
  const words = (text.match(/\S+/g) || []).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  const keyPoints = (text.match(/\n[-*•]/g) || []).length;
  return { words, minutes, keyPoints };
}

function formatSummaryOutput(text = "") {
  return summaryEscapeHTML(text)
    .replace(/^### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^## (.*)$/gm, "<h4>$1</h4>")
    .replace(/^# (.*)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
}

function renderSummaryResult(result) {
  const output = document.getElementById("summaryOutput");
  const stats = getSummaryStats(result.summary);
  const sourceLabel = result.source || "Text";

  output.innerHTML = `
    <div class="summary-result-card">
      <div class="summary-result-head">
        <div>
          <h3>${summaryEscapeHTML(result.title || "Generated Summary")}</h3>
          <p>${summaryEscapeHTML(result.modeLabel)} | ${summaryEscapeHTML(sourceLabel)}</p>
        </div>
        <div class="summary-score-ring">
          <span>${stats.minutes}m</span>
        </div>
      </div>

      <div class="summary-stats">
        <span>Words <b>${stats.words}</b></span>
        <span>Read time <b>${stats.minutes} min</b></span>
        <span>Key points <b>${stats.keyPoints || "Auto"}</b></span>
      </div>

      <div class="summary-output-body">${formatSummaryOutput(result.summary)}</div>

      <div class="summary-actions">
        <button onclick="copySummary()">Copy</button>
        <button onclick="downloadSummary()" style="background:#444;">Download</button>
        <button onclick="saveSummary()" style="background:#444;">Save</button>
      </div>
    </div>
  `;
}

function getSummarySourceLabel(file, youtube, text) {
  if (file) return file.name;
  if (youtube) return "YouTube";
  if (text) return "Pasted text";
  return "Source";
}

window.openAISummary = () => {
  const section = document.getElementById("aiSummarySection");
  section.style.display = "block";
  ensureSummaryPremiumUI();
};

window.closeAISummary = () => {
  document.getElementById("aiSummarySection").style.display = "none";
  lastSummaryResult = null;
};

window.clearSummaryWorkspace = () => {
  ensureSummaryPremiumUI();
  document.getElementById("summaryInput").value = "";
  document.getElementById("fileInput").value = "";
  document.getElementById("youtubeInput").value = "";
  document.getElementById("summaryOutput").innerHTML = "";
  lastSummaryResult = null;
};

window.generateSummary = async () => {
  ensureSummaryPremiumUI();

  const text = document.getElementById("summaryInput").value.trim();
  const file = document.getElementById("fileInput").files[0];
  const youtube = document.getElementById("youtubeInput").value.trim();
  const mode = document.getElementById("summaryMode").value;
  const length = document.getElementById("summaryLength").value;
  const modeLabel = document.getElementById("summaryMode").selectedOptions[0].textContent;
  const output = document.getElementById("summaryOutput");

  if (!text && !file && !youtube) {
    alert("Please enter text, upload a file, or provide a YouTube link");
    return;
  }

  output.innerHTML = `
    <div class="summary-loading">
      <div></div>
      <b>Building your summary...</b>
      <span>Extracting key ideas, structure, and study points.</span>
    </div>
  `;

  try {
    const formData = new FormData();
    formData.append("summaryMode", mode);
    formData.append("summaryLength", length);

    if (file) {
      formData.append("file", file);
    } else if (youtube) {
      formData.append("youtube", youtube);
    } else {
      formData.append("text", text);
    }

    const res = await fetch("https://studybyte-ssuq.onrender.com/api/summary", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("API Error:", err);
      output.innerHTML = `<div class="summary-error">Failed to generate summary.</div>`;
      return;
    }

    const data = await res.json();

    if (!data.summary) {
      output.innerHTML = `<div class="summary-error">No summary returned.</div>`;
      return;
    }

    lastSummaryResult = {
      title: modeLabel,
      mode,
      modeLabel,
      length,
      source: getSummarySourceLabel(file, youtube, text),
      summary: data.summary,
      createdAt: new Date().toISOString()
    };

    renderSummaryResult(lastSummaryResult);
  } catch (err) {
    console.error("CLIENT ERROR:", err);
    output.innerHTML = `<div class="summary-error">Something went wrong.</div>`;
  }
};

window.copySummary = async () => {
  if (!lastSummaryResult) return;
  await navigator.clipboard.writeText(lastSummaryResult.summary);
  alert("Summary copied");
};

window.downloadSummary = () => {
  if (!lastSummaryResult) return;

  const blob = new Blob([lastSummaryResult.summary], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `study-summary-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

window.saveSummary = () => {
  if (!lastSummaryResult) return;

  const saved = getSavedSummaries();
  saved.unshift({
    id: Date.now().toString(),
    ...lastSummaryResult
  });
  setSavedSummaries(saved.slice(0, 30));
  alert("Summary saved");
};

window.viewSavedSummaries = () => {
  ensureSummaryPremiumUI();
  const output = document.getElementById("summaryOutput");
  const saved = getSavedSummaries();

  if (!saved.length) {
    output.innerHTML = `<div class="summary-error">No saved summaries yet.</div>`;
    return;
  }

  output.innerHTML = `
    <div class="summary-saved-list">
      <h3>Saved Summaries</h3>
      ${saved.map(item => `
        <div class="summary-saved-item">
          <div>
            <b>${summaryEscapeHTML(item.title || "Summary")}</b>
            <span>${summaryEscapeHTML(item.source || "Source")} | ${new Date(item.createdAt).toLocaleString()}</span>
          </div>
          <button onclick="openSavedSummary('${item.id}')">Open</button>
        </div>
      `).join("")}
    </div>
  `;
};

window.openSavedSummary = (id) => {
  const item = getSavedSummaries().find(summary => summary.id === id);
  if (!item) return;
  lastSummaryResult = item;
  renderSummaryResult(item);
};

// ===== BRAINSTORM SYSTEM =====

// OPEN
window.openBrainstorm = () => {
  document.getElementById("brainstormSection").style.display = "block";
  window.renderBrainstormHome();
};

// CLOSE
window.closeBrainstorm = () => {
  document.getElementById("brainstormSection").style.display = "none";
  document.getElementById("gameArea").innerHTML = "";
};

// HOME (CATEGORY UI)
window.renderBrainstormHome = function () {
  const gameArea = document.getElementById("gameArea");

  gameArea.innerHTML = `
    <div class="card">
      <h3>Select Category</h3>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="smallBtn" onclick="openGameCategory('memory')">🧠 Memory</button>
        <button class="smallBtn" onclick="openGameCategory('focus')">🎯 Focus</button>
        <button class="smallBtn" onclick="openGameCategory('logic')">🧩 Logic</button>
        <button class="smallBtn" onclick="openGameCategory('speed')">⚡ Speed</button>
      </div>
    </div>
  `;
};

// CATEGORY → GAME LIST
window.openGameCategory = (type) => {
  const gameArea = document.getElementById("gameArea");

 const games = {
  memory: [{ name: "Memory Match", fn: "loadMemoryGame" }],
  focus: [{ name: "Reaction Timer", fn: "loadReactionGame" }],
  logic: [{ name: "Number Sequence", fn: "loadLogicGame" }],
  speed: [{ name: "Typing Speed", fn: "loadTypingGame" }]
};

  const selectedGames = games[type] || [];

  gameArea.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between;">
        <h3>${type.toUpperCase()} GAMES</h3>
        <button class="smallBtn" onclick="renderBrainstormHome()">⬅ Back</button>
      </div>

      <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
        ${selectedGames.map(g => `
          <button onclick="${g.fn}()" class="smallBtn">
            ${g.name}
          </button>
        `).join("")}
      </div>
    </div>
  `;
};



// ===== MEMORY GAME =====

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;

window.loadMemoryGame = function () {
  const gameArea = document.getElementById("gameArea");

  // RESET STATE
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  moves = 0;

  const emojis = ["🍎","🍌","🍇","🍓","🍍","🥝"];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);

  gameArea.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between;">
        <h3>🧠 Memory Match</h3>
        <button class="smallBtn" onclick="renderBrainstormHome()">⬅ Back</button>
      </div>

      <p>Moves: <span id="moveCount">0</span></p>

      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:20px;">
        ${cards.map(item => `
          <div class="memoryCard" data-value="${item}" onclick="flipCard(this)">
            <div class="inner">
              <div class="front">?</div>
              <div class="back">${item}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
};

window.flipCard = (card) => {
  if (
    lockBoard ||
    card.classList.contains("flipped") ||
    card === firstCard
  ) return;

  card.classList.add("flipped");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  document.getElementById("moveCount").innerText = moves;

  const match = firstCard.dataset.value === secondCard.dataset.value;

  if (!match) {
    lockBoard = true;

    setTimeout(() => {
      firstCard.classList.remove("flipped");
      secondCard.classList.remove("flipped");
      resetTurn();
    }, 800);
  } else {
    resetTurn();
  }
};

function resetTurn() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  checkWin();
}

function checkWin() {
  const cards = document.querySelectorAll(".memoryCard");

  if ([...cards].every(c => c.classList.contains("flipped"))) {
    setTimeout(() => {
      alert(`🎉 Completed in ${moves} moves!`);
    }, 300);
  }
}



// ===== REACTION GAME =====

let reactionStart = 0;
let reactionTimeout = null;
let ready = false;

window.loadReactionGame = function () {
  const gameArea = document.getElementById("gameArea");

  gameArea.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="display:flex; justify-content:space-between;">
        <h3>🎯 Reaction Timer</h3>
        <button class="smallBtn" onclick="renderBrainstormHome()">⬅ Back</button>
      </div>

      <p id="status">Click Start</p>

      <button class="smallBtn" onclick="startReaction()">Start</button>

      <div id="reactionBox" style="
        margin-top:20px;
        height:120px;
        border-radius:10px;
        background:#444;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
      " onclick="clickReaction()">WAIT</div>

      <p id="result"></p>
    </div>
  `;
};

window.startReaction = () => {
  const box = document.getElementById("reactionBox");
  const result = document.getElementById("result");

  ready = false;
  result.innerText = "";

  box.style.background = "#444";
  box.innerText = "WAIT";

  reactionTimeout = setTimeout(() => {
    box.style.background = "green";
    box.innerText = "CLICK!";
    reactionStart = Date.now();
    ready = true;
  }, Math.random() * 3000 + 2000);
};

window.clickReaction = () => {
  const result = document.getElementById("result");

  if (!ready) {
    clearTimeout(reactionTimeout);
    result.innerText = "❌ Too early!";
    return;
  }

  result.innerText = `⚡ ${Date.now() - reactionStart} ms`;
  ready = false;
};
// ===== LOGIC GAME =====

let correctAnswer = 0;

window.loadLogicGame = function () {
  const gameArea = document.getElementById("gameArea");

  generateSequence();

  gameArea.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <h3>🧩 Number Sequence</h3>
        <button class="smallBtn" onclick="renderBrainstormHome()">⬅ Back</button>
      </div>

      <p id="sequenceText" style="margin-top:20px; font-size:18px;"></p>

      <input id="logicInput" placeholder="Enter next number" style="max-width:200px; margin:15px auto; display:block;" />

      <button class="smallBtn" onclick="checkLogic()">Submit</button>

      <p id="logicResult"></p>
    </div>
  `;
};

function generateSequence() {
  const start = Math.floor(Math.random() * 10) + 1;
  const step = Math.floor(Math.random() * 5) + 1;

  const seq = [start, start + step, start + step*2];

  correctAnswer = start + step*3;

  setTimeout(() => {
    document.getElementById("sequenceText").innerText =
      `${seq.join(", ")}, ?`;
  }, 100);
}

window.checkLogic = () => {
  const input = document.getElementById("logicInput").value;
  const result = document.getElementById("logicResult");

  if (parseInt(input) === correctAnswer) {
    result.innerText = "✅ Correct!";
  } else {
    result.innerText = `❌ Wrong! Answer: ${correctAnswer}`;
  }
};
// ===== SPEED GAME =====

let typingStart = 0;
let currentText = "";

window.loadTypingGame = function () {
  const gameArea = document.getElementById("gameArea");

  const texts = [
    "focus builds success",
    "practice makes perfect",
    "stay consistent daily"
  ];

  currentText = texts[Math.floor(Math.random() * texts.length)];

  gameArea.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <h3>⚡ Typing Speed</h3>
        <button class="smallBtn" onclick="renderBrainstormHome()">⬅ Back</button>
      </div>

      <p style="margin-top:20px;">Type this:</p>
      <p style="font-weight:bold;">"${currentText}"</p>

      <input id="typingInput" placeholder="Start typing..." 
        style="max-width:300px; margin:15px auto; display:block;"
        onfocus="startTyping()" />

      <button class="smallBtn" onclick="checkTyping()">Done</button>

      <p id="typingResult"></p>
    </div>
  `;
};

window.startTyping = () => {
  typingStart = Date.now();
};

window.checkTyping = () => {
  const input = document.getElementById("typingInput").value;
  const result = document.getElementById("typingResult");

  const time = (Date.now() - typingStart) / 1000;

  if (input.trim() === currentText) {
    const speed = Math.round(currentText.length / time);
    result.innerText = `⚡ ${speed} chars/sec`;
  } else {
    result.innerText = "❌ Text mismatch!";
  }
};
// ===== BRAINSTORM PREMIUM UPGRADE =====

let brainstormDifficulty = localStorage.getItem("brainstormDifficulty") || "normal";
let brainstormStartedAt = null;
let brainstormTimerInterval = null;
let brainstormActiveGame = "";
let brainstormMemoryFirst = null;
let brainstormMemorySecond = null;
let brainstormMemoryLocked = false;
let brainstormMemoryMoves = 0;
let brainstormMemoryMatches = 0;
let brainstormReactionStart = 0;
let brainstormReactionTimeout = null;
let brainstormReactionReady = false;
let brainstormCorrectAnswer = 0;
let brainstormTypingText = "";
let brainstormTypingStartedAt = 0;
let brainstormPattern = [];
let brainstormPatternInput = [];
let brainstormTargetScore = 0;
let brainstormTargetRound = 0;
let brainstormMathScore = 0;
let brainstormMathRound = 0;
let brainstormMathAnswer = 0;
let brainstormScrambleAnswer = "";
let brainstormGameFinished = false;
let brainstormLastResult = null;

function getBrainstormConfig() {
  const configs = {
    easy: {
      label: "Easy",
      memoryPairs: 4,
      memoryColumns: 4,
      reactionMin: 1800,
      reactionMax: 3600,
      logicTerms: 3,
      logicStepMax: 4,
      patternLength: 4,
      targetRounds: 8,
      mathRounds: 5,
      mathMax: 12,
      typingTexts: ["focus wins", "daily practice", "calm mind"]
    },
    normal: {
      label: "Normal",
      memoryPairs: 6,
      memoryColumns: 4,
      reactionMin: 1200,
      reactionMax: 3000,
      logicTerms: 4,
      logicStepMax: 7,
      patternLength: 5,
      targetRounds: 10,
      mathRounds: 7,
      mathMax: 24,
      typingTexts: ["focus builds success", "practice makes perfect", "stay consistent daily"]
    },
    hard: {
      label: "Hard",
      memoryPairs: 8,
      memoryColumns: 4,
      reactionMin: 700,
      reactionMax: 2200,
      logicTerms: 5,
      logicStepMax: 11,
      patternLength: 7,
      targetRounds: 14,
      mathRounds: 10,
      mathMax: 45,
      typingTexts: [
        "discipline turns effort into skill",
        "deep work improves memory and speed",
        "small consistent wins create mastery"
      ]
    }
  };

  return configs[brainstormDifficulty] || configs.normal;
}

function formatBrainstormTime(totalSeconds = 0) {
  const secondsValue = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(secondsValue / 60);
  const secondsPart = secondsValue % 60;
  return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
}

function getBrainstormHistory() {
  try {
    return JSON.parse(localStorage.getItem("brainstormHistory") || "[]");
  } catch {
    return [];
  }
}

function saveBrainstormResult(result) {
  const history = getBrainstormHistory();
  history.unshift({
    id: Date.now().toString(),
    game: brainstormActiveGame,
    difficulty: brainstormDifficulty,
    createdAt: new Date().toISOString(),
    ...result
  });
  localStorage.setItem("brainstormHistory", JSON.stringify(history.slice(0, 30)));
}

function stopBrainstormTimer() {
  if (brainstormTimerInterval) {
    clearInterval(brainstormTimerInterval);
    brainstormTimerInterval = null;
  }
  if (brainstormReactionTimeout) {
    clearTimeout(brainstormReactionTimeout);
    brainstormReactionTimeout = null;
  }
}

function startBrainstormTimer(gameName) {
  stopBrainstormTimer();
  brainstormActiveGame = gameName;
  brainstormStartedAt = Date.now();
  brainstormGameFinished = false;
  brainstormLastResult = null;
  brainstormTimerInterval = setInterval(() => {
    const timer = document.getElementById("brainstormTimer");
    if (!timer || !brainstormStartedAt) return;
    timer.innerText = formatBrainstormTime((Date.now() - brainstormStartedAt) / 1000);
  }, 1000);
}

function finishBrainstormGame(extra = {}) {
  if (brainstormGameFinished) {
    return brainstormLastResult || { timeTaken: 0, ...extra };
  }

  const timeTaken = brainstormStartedAt
    ? Math.round((Date.now() - brainstormStartedAt) / 1000)
    : 0;
  stopBrainstormTimer();

  const result = { timeTaken, ...extra };
  brainstormGameFinished = true;
  brainstormLastResult = result;
  saveBrainstormResult(result);
  return result;
}

function getBrainstormScore(item = {}) {
  if (item.game === "Reaction Timer") return `${item.reactionMs || 0} ms`;
  if (item.game === "Typing Speed") return `${item.speed || 0} cps`;
  if (item.game === "Memory Match") return `${item.moves || 0} moves`;
  if (item.game === "Pattern Flash") return `${item.correct || 0}/${item.total || 0}`;
  if (item.game === "Target Tap") return `${item.score || 0} hits`;
  if (item.game === "Math Rush") return `${item.score || 0}/${item.total || 0}`;
  if (item.game === "Word Scramble") return item.correct ? "Solved" : "Practice";
  if (item.game === "Number Sequence") return item.correct ? "Correct" : "Practice";
  return formatBrainstormTime(item.timeTaken || 0);
}

function renderBrainstormResult(result, message) {
  const panel = document.getElementById("brainstormResultPanel");
  if (!panel) return;

  panel.innerHTML = `
    <div class="brainstorm-result">
      <b>${message}</b>
      <span>Time taken: ${formatBrainstormTime(result.timeTaken)}</span>
      <span>Difficulty: ${getBrainstormConfig().label}</span>
    </div>
  `;
}

function renderBrainstormShell(title, body, hint = "") {
  const config = getBrainstormConfig();
  const best = getBrainstormHistory()
    .filter(item => item.game === title && item.difficulty === brainstormDifficulty)[0];

  return `
    <div class="card brainstorm-card">
      <div class="brainstorm-topbar">
        <div>
          <h3>${title}</h3>
          <span>${config.label} mode</span>
        </div>
        <button class="smallBtn" onclick="renderBrainstormHome()">Back</button>
      </div>

      <div class="brainstorm-metrics">
        <span>Time <b id="brainstormTimer">0:00</b></span>
        <span>Difficulty <b>${config.label}</b></span>
        <span>Last run <b>${best ? getBrainstormScore(best) : "New"}</b></span>
      </div>

      ${hint ? `<p class="brainstorm-hint">${hint}</p>` : ""}
      ${body}
      <div id="brainstormResultPanel"></div>
    </div>
  `;
}

window.setBrainstormDifficulty = (level) => {
  brainstormDifficulty = level;
  localStorage.setItem("brainstormDifficulty", level);
  renderBrainstormHome();
};

window.openBrainstorm = () => {
  document.getElementById("brainstormSection").style.display = "block";
  renderBrainstormHome();
};

window.closeBrainstorm = () => {
  stopBrainstormTimer();
  document.getElementById("brainstormSection").style.display = "none";
  document.getElementById("gameArea").innerHTML = "";
};

window.renderBrainstormHome = function () {
  stopBrainstormTimer();
  brainstormStartedAt = null;
  brainstormTypingStartedAt = 0;

  const gameArea = document.getElementById("gameArea");
  const history = getBrainstormHistory().slice(0, 4);

  gameArea.innerHTML = `
    <div class="card brainstorm-card">
      <div class="brainstorm-topbar">
        <div>
          <h3>Brainstorm Training</h3>
          <span>Choose a brain game and difficulty</span>
        </div>
      </div>

      <div class="brainstorm-difficulty">
        ${["easy", "normal", "hard"].map(level => `
          <button class="smallBtn ${brainstormDifficulty === level ? "active" : ""}" onclick="setBrainstormDifficulty('${level}')">
            ${level.toUpperCase()}
          </button>
        `).join("")}
      </div>

      <div class="brainstorm-game-grid">
        <button class="brainstorm-game-tile" onclick="openGameCategory('memory')">
          <b>Memory</b><span>Match pairs and replay patterns</span>
        </button>
        <button class="brainstorm-game-tile" onclick="openGameCategory('focus')">
          <b>Focus</b><span>Reaction speed and target control</span>
        </button>
        <button class="brainstorm-game-tile" onclick="openGameCategory('logic')">
          <b>Logic</b><span>Patterns and quick math</span>
        </button>
        <button class="brainstorm-game-tile" onclick="openGameCategory('speed')">
          <b>Speed</b><span>Typing and word solving</span>
        </button>
      </div>

      <div class="brainstorm-history">
        <h4>Recent runs</h4>
        ${history.length ? history.map(item => `
          <div>
            <span>${item.game}</span>
            <b>${formatBrainstormTime(item.timeTaken || 0)} | ${getBrainstormScore(item)}</b>
          </div>
        `).join("") : `<p>No runs yet.</p>`}
      </div>
    </div>
  `;
};

window.openGameCategory = (type) => {
  const games = {
    memory: [
      { name: "Memory Match", fn: "loadMemoryGame" },
      { name: "Pattern Flash", fn: "loadPatternFlashGame" }
    ],
    focus: [
      { name: "Reaction Timer", fn: "loadReactionGame" },
      { name: "Target Tap", fn: "loadTargetTapGame" }
    ],
    logic: [
      { name: "Number Sequence", fn: "loadLogicGame" },
      { name: "Math Rush", fn: "loadMathRushGame" }
    ],
    speed: [
      { name: "Typing Speed", fn: "loadTypingGame" },
      { name: "Word Scramble", fn: "loadWordScrambleGame" }
    ]
  };

  const selectedGames = games[type] || [];
  document.getElementById("gameArea").innerHTML = `
    <div class="card brainstorm-card">
      <div class="brainstorm-topbar">
        <div>
          <h3>${type.toUpperCase()} GAMES</h3>
          <span>${getBrainstormConfig().label} difficulty selected</span>
        </div>
        <button class="smallBtn" onclick="renderBrainstormHome()">Back</button>
      </div>

      <div class="brainstorm-game-list">
        ${selectedGames.map(game => `
          <button onclick="${game.fn}()" class="smallBtn">${game.name}</button>
        `).join("")}
      </div>
    </div>
  `;
};

window.loadMemoryGame = function () {
  const config = getBrainstormConfig();
  const symbols = ["A","B","C","D","E","F","G","H","I","J"];
  const cards = [...symbols.slice(0, config.memoryPairs), ...symbols.slice(0, config.memoryPairs)]
    .sort(() => Math.random() - 0.5);

  brainstormMemoryFirst = null;
  brainstormMemorySecond = null;
  brainstormMemoryLocked = false;
  brainstormMemoryMoves = 0;
  brainstormMemoryMatches = 0;

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Memory Match",
    `
      <div class="brainstorm-live-row">
        <span>Moves <b id="moveCount">0</b></span>
        <span>Matched <b id="matchCount">0/${config.memoryPairs}</b></span>
      </div>

      <div class="brainstorm-memory-grid" style="grid-template-columns:repeat(${config.memoryColumns},1fr);">
        ${cards.map(item => `
          <div class="memoryCard" data-value="${item}" onclick="flipCard(this)">
            <div class="inner">
              <div class="front">?</div>
              <div class="back">${item}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `,
    "Match every pair. Hard mode gives you more cards."
  );
  startBrainstormTimer("Memory Match");
};

window.flipCard = (card) => {
  if (brainstormGameFinished) return;

  if (
    brainstormMemoryLocked ||
    card.classList.contains("flipped") ||
    card === brainstormMemoryFirst
  ) return;

  card.classList.add("flipped");

  if (!brainstormMemoryFirst) {
    brainstormMemoryFirst = card;
    return;
  }

  brainstormMemorySecond = card;
  brainstormMemoryMoves++;
  document.getElementById("moveCount").innerText = brainstormMemoryMoves;

  if (brainstormMemoryFirst.dataset.value !== brainstormMemorySecond.dataset.value) {
    brainstormMemoryLocked = true;
    setTimeout(() => {
      brainstormMemoryFirst.classList.remove("flipped");
      brainstormMemorySecond.classList.remove("flipped");
      brainstormMemoryFirst = null;
      brainstormMemorySecond = null;
      brainstormMemoryLocked = false;
    }, 700);
    return;
  }

  brainstormMemoryMatches++;
  document.getElementById("matchCount").innerText = `${brainstormMemoryMatches}/${getBrainstormConfig().memoryPairs}`;
  brainstormMemoryFirst = null;
  brainstormMemorySecond = null;

  if (brainstormMemoryMatches === getBrainstormConfig().memoryPairs) {
    const result = finishBrainstormGame({ moves: brainstormMemoryMoves });
    renderBrainstormResult(result, `Completed in ${brainstormMemoryMoves} moves.`);
  }
};

window.loadPatternFlashGame = function () {
  const config = getBrainstormConfig();
  const colors = ["green", "blue", "yellow", "red"];
  brainstormPattern = Array.from({ length: config.patternLength }, () =>
    colors[Math.floor(Math.random() * colors.length)]
  );
  brainstormPatternInput = [];

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Pattern Flash",
    `
      <div class="brainstorm-live-row">
        <span>Pattern <b>${config.patternLength} steps</b></span>
        <span>Entered <b id="patternCount">0/${config.patternLength}</b></span>
      </div>
      <div class="brainstorm-pattern-board">
        ${colors.map(color => `
          <button class="pattern-pad ${color}" data-color="${color}" onclick="pressPatternPad('${color}')" disabled></button>
        `).join("")}
      </div>
      <button class="smallBtn" onclick="startPatternFlash()">Show Pattern</button>
    `,
    "Watch the flashing sequence, then repeat it in the same order."
  );
  startBrainstormTimer("Pattern Flash");
};

window.startPatternFlash = () => {
  const pads = document.querySelectorAll(".pattern-pad");
  pads.forEach(pad => pad.disabled = true);
  brainstormPatternInput = [];
  document.getElementById("patternCount").innerText = `0/${brainstormPattern.length}`;

  brainstormPattern.forEach((color, index) => {
    setTimeout(() => {
      const pad = document.querySelector(`.pattern-pad.${color}`);
      if (!pad) return;
      pad.classList.add("flash");
      setTimeout(() => pad.classList.remove("flash"), 360);
    }, index * 620);
  });

  setTimeout(() => {
    pads.forEach(pad => pad.disabled = false);
  }, brainstormPattern.length * 620 + 120);
};

window.pressPatternPad = (color) => {
  if (brainstormGameFinished) return;

  brainstormPatternInput.push(color);
  document.getElementById("patternCount").innerText = `${brainstormPatternInput.length}/${brainstormPattern.length}`;

  const index = brainstormPatternInput.length - 1;
  if (brainstormPattern[index] !== color) {
    document.querySelectorAll(".pattern-pad").forEach(pad => pad.disabled = true);
    const result = finishBrainstormGame({
      correct: index,
      total: brainstormPattern.length
    });
    renderBrainstormResult(result, `Pattern broke at step ${index + 1}.`);
    return;
  }

  if (brainstormPatternInput.length === brainstormPattern.length) {
    document.querySelectorAll(".pattern-pad").forEach(pad => pad.disabled = true);
    const result = finishBrainstormGame({
      correct: brainstormPattern.length,
      total: brainstormPattern.length
    });
    renderBrainstormResult(result, "Perfect sequence replay.");
  }
};

window.loadReactionGame = function () {
  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Reaction Timer",
    `
      <p id="status">Click Start</p>
      <button class="smallBtn" onclick="startReaction()">Start</button>
      <div id="reactionBox" class="brainstorm-reaction-box" onclick="clickReaction()">WAIT</div>
      <p id="result"></p>
    `,
    "Wait for green, then click as fast as possible."
  );
  brainstormReactionReady = false;
  startBrainstormTimer("Reaction Timer");
};

window.startReaction = () => {
  const box = document.getElementById("reactionBox");
  const result = document.getElementById("result");
  const config = getBrainstormConfig();

  clearTimeout(brainstormReactionTimeout);
  brainstormReactionReady = false;
  result.innerText = "";
  box.style.background = "#444";
  box.innerText = "WAIT";

  brainstormReactionTimeout = setTimeout(() => {
    box.style.background = "#25c06d";
    box.innerText = "CLICK!";
    brainstormReactionStart = Date.now();
    brainstormReactionReady = true;
  }, Math.random() * (config.reactionMax - config.reactionMin) + config.reactionMin);
};

window.clickReaction = () => {
  const result = document.getElementById("result");

  if (!brainstormReactionReady) {
    clearTimeout(brainstormReactionTimeout);
    result.innerText = "Too early!";
    return;
  }

  const reactionMs = Date.now() - brainstormReactionStart;
  const final = finishBrainstormGame({ reactionMs });
  result.innerText = `${reactionMs} ms`;
  renderBrainstormResult(final, `Reaction time: ${reactionMs} ms.`);
  brainstormReactionReady = false;
};

function renderTargetTapRound() {
  const arena = document.getElementById("targetArena");
  const score = document.getElementById("targetScore");
  const round = document.getElementById("targetRound");
  const config = getBrainstormConfig();

  if (!arena || brainstormTargetRound >= config.targetRounds) {
    if (arena) arena.innerHTML = "";
    const result = finishBrainstormGame({
      score: brainstormTargetScore,
      total: config.targetRounds
    });
    renderBrainstormResult(result, `Hit ${brainstormTargetScore} of ${config.targetRounds} targets.`);
    return;
  }

  brainstormTargetRound++;
  score.innerText = brainstormTargetScore;
  round.innerText = `${brainstormTargetRound}/${config.targetRounds}`;

  const size = brainstormDifficulty === "hard" ? 38 : brainstormDifficulty === "easy" ? 58 : 48;
  const left = Math.floor(Math.random() * Math.max(1, arena.clientWidth - size));
  const top = Math.floor(Math.random() * Math.max(1, arena.clientHeight - size));

  arena.innerHTML = `
    <button
      class="target-dot"
      style="width:${size}px; height:${size}px; left:${left}px; top:${top}px;"
      onclick="hitTargetTap(event)"
    ></button>
  `;
}

window.loadTargetTapGame = function () {
  const config = getBrainstormConfig();
  brainstormTargetScore = 0;
  brainstormTargetRound = 0;

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Target Tap",
    `
      <div class="brainstorm-live-row">
        <span>Hits <b id="targetScore">0</b></span>
        <span>Round <b id="targetRound">0/${config.targetRounds}</b></span>
      </div>
      <div id="targetArena" class="target-arena"></div>
    `,
    "Tap the moving targets as quickly and accurately as possible."
  );
  startBrainstormTimer("Target Tap");
  setTimeout(renderTargetTapRound, 120);
};

window.hitTargetTap = (event) => {
  if (brainstormGameFinished) return;

  event.stopPropagation();
  brainstormTargetScore++;
  renderTargetTapRound();
};

window.loadLogicGame = function () {
  const config = getBrainstormConfig();
  const start = Math.floor(Math.random() * 10) + 1;
  const step = Math.floor(Math.random() * config.logicStepMax) + 1;
  const sequence = Array.from({ length: config.logicTerms }, (_, index) => start + step * index);
  brainstormCorrectAnswer = start + step * config.logicTerms;

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Number Sequence",
    `
      <p id="sequenceText" class="brainstorm-sequence">${sequence.join(", ")}, ?</p>
      <input id="logicInput" placeholder="Enter next number" style="max-width:220px; margin:15px auto; display:block;" />
      <button class="smallBtn" onclick="checkLogic()">Submit</button>
      <p id="logicResult"></p>
    `,
    "Find the step pattern and enter the next number."
  );
  startBrainstormTimer("Number Sequence");
};

window.checkLogic = () => {
  if (brainstormGameFinished) return;

  const input = document.getElementById("logicInput").value;
  const result = document.getElementById("logicResult");
  const correct = parseInt(input, 10) === brainstormCorrectAnswer;
  const final = finishBrainstormGame({ correct, answer: brainstormCorrectAnswer });

  result.innerText = correct ? "Correct!" : `Wrong. Answer: ${brainstormCorrectAnswer}`;
  renderBrainstormResult(final, correct ? "Pattern solved correctly." : `Answer was ${brainstormCorrectAnswer}.`);
};

function makeMathRushProblem() {
  const config = getBrainstormConfig();
  const a = Math.floor(Math.random() * config.mathMax) + 1;
  const b = Math.floor(Math.random() * config.mathMax) + 1;
  const ops = brainstormDifficulty === "easy" ? ["+"] : ["+", "-", "x"];
  const op = ops[Math.floor(Math.random() * ops.length)];

  if (op === "+") {
    brainstormMathAnswer = a + b;
  } else if (op === "-") {
    brainstormMathAnswer = Math.max(a, b) - Math.min(a, b);
  } else {
    brainstormMathAnswer = a * Math.min(b, brainstormDifficulty === "hard" ? 12 : 9);
  }

  const left = op === "-" ? Math.max(a, b) : a;
  const right = op === "-" ? Math.min(a, b) : op === "x" ? Math.min(b, brainstormDifficulty === "hard" ? 12 : 9) : b;
  document.getElementById("mathProblem").innerText = `${left} ${op} ${right} = ?`;
  document.getElementById("mathInput").value = "";
  document.getElementById("mathRound").innerText = `${brainstormMathRound + 1}/${config.mathRounds}`;
  document.getElementById("mathScore").innerText = brainstormMathScore;
}

window.loadMathRushGame = function () {
  const config = getBrainstormConfig();
  brainstormMathScore = 0;
  brainstormMathRound = 0;

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Math Rush",
    `
      <div class="brainstorm-live-row">
        <span>Score <b id="mathScore">0</b></span>
        <span>Round <b id="mathRound">1/${config.mathRounds}</b></span>
      </div>
      <p id="mathProblem" class="brainstorm-sequence"></p>
      <input id="mathInput" placeholder="Answer" style="max-width:180px; margin:15px auto; display:block;" onkeydown="if(event.key==='Enter') submitMathRush()" />
      <button class="smallBtn" onclick="submitMathRush()">Submit</button>
    `,
    "Solve each problem quickly. Hard mode adds more rounds and larger numbers."
  );
  startBrainstormTimer("Math Rush");
  makeMathRushProblem();
};

window.submitMathRush = () => {
  if (brainstormGameFinished) return;

  const input = parseInt(document.getElementById("mathInput").value, 10);
  if (input === brainstormMathAnswer) brainstormMathScore++;
  brainstormMathRound++;

  if (brainstormMathRound >= getBrainstormConfig().mathRounds) {
    const result = finishBrainstormGame({
      score: brainstormMathScore,
      total: getBrainstormConfig().mathRounds
    });
    renderBrainstormResult(result, `Solved ${brainstormMathScore} of ${getBrainstormConfig().mathRounds}.`);
    return;
  }

  makeMathRushProblem();
};

window.loadTypingGame = function () {
  const config = getBrainstormConfig();
  brainstormTypingText = config.typingTexts[Math.floor(Math.random() * config.typingTexts.length)];
  brainstormTypingStartedAt = 0;

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Typing Speed",
    `
      <p style="margin-top:20px;">Type this:</p>
      <p class="brainstorm-type-text">"${brainstormTypingText}"</p>
      <input id="typingInput" placeholder="Start typing..." style="max-width:360px; margin:15px auto; display:block;" onfocus="startTyping()" />
      <button class="smallBtn" onclick="checkTyping()">Done</button>
      <p id="typingResult"></p>
    `,
    "Type the sentence exactly. Timer starts when you focus the input."
  );
  startBrainstormTimer("Typing Speed");
};

window.startTyping = () => {
  if (!brainstormTypingStartedAt) brainstormTypingStartedAt = Date.now();
};

window.checkTyping = () => {
  if (brainstormGameFinished) return;

  const input = document.getElementById("typingInput").value;
  const result = document.getElementById("typingResult");
  const typingTime = brainstormTypingStartedAt
    ? (Date.now() - brainstormTypingStartedAt) / 1000
    : 1;

  if (input.trim() === brainstormTypingText) {
    const speed = Math.round(brainstormTypingText.length / typingTime);
    const final = finishBrainstormGame({ speed });
    result.innerText = `${speed} chars/sec`;
    renderBrainstormResult(final, `Typing speed: ${speed} chars/sec.`);
  } else {
    const final = finishBrainstormGame({ speed: 0 });
    result.innerText = "Text mismatch!";
    renderBrainstormResult(final, "Accuracy first. Try another run.");
  }
};

function shuffleBrainstormWord(word) {
  const letters = word.split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const shuffled = letters.join("");
  return shuffled === word ? shuffleBrainstormWord(word) : shuffled;
}

window.loadWordScrambleGame = function () {
  const words = {
    easy: ["focus", "brain", "learn", "calm"],
    normal: ["memory", "reason", "typing", "pattern"],
    hard: ["discipline", "attention", "strategy", "precision"]
  };
  const pool = words[brainstormDifficulty] || words.normal;
  brainstormScrambleAnswer = pool[Math.floor(Math.random() * pool.length)];
  const scrambled = shuffleBrainstormWord(brainstormScrambleAnswer);

  document.getElementById("gameArea").innerHTML = renderBrainstormShell(
    "Word Scramble",
    `
      <p class="brainstorm-hint">Unscramble this word:</p>
      <p class="brainstorm-scramble">${scrambled}</p>
      <input id="scrambleInput" placeholder="Correct word" style="max-width:280px; margin:15px auto; display:block;" onkeydown="if(event.key==='Enter') checkWordScramble()" />
      <button class="smallBtn" onclick="checkWordScramble()">Check</button>
      <p id="scrambleResult"></p>
    `,
    "Rebuild the word as quickly as you can."
  );
  startBrainstormTimer("Word Scramble");
};

window.checkWordScramble = () => {
  if (brainstormGameFinished) return;

  const input = document.getElementById("scrambleInput").value.trim().toLowerCase();
  const correct = input === brainstormScrambleAnswer;
  const final = finishBrainstormGame({ correct, answer: brainstormScrambleAnswer });
  document.getElementById("scrambleResult").innerText = correct
    ? "Solved!"
    : `Answer: ${brainstormScrambleAnswer}`;
  renderBrainstormResult(final, correct ? "Word solved correctly." : "Good try. Build the word again.");
};

 // ===== AI QUIZ MODAL CONTROL =====

// OPEN
window.openQuizModal = () => {
  document.getElementById("quizModal").style.display = "block";
};

// CLOSE
window.closeQuizModal = () => {
  document.getElementById("quizModal").style.display = "none";
  document.getElementById("quizArea").innerHTML = "";
};
// ===== AI QUIZ COMPLETE SYSTEM =====

let currentQuestions = [];

// START QUIZ
window.startQuiz = async () => {
  const subject = document.getElementById("quizSubject")?.value || "";
  const topicInput = document.getElementById("quizTopic")?.value || "";
  const selectedLevel = document.getElementById("quizLevel")?.value;
const level = selectedLevel || quizLevel;
  const count = parseInt(document.getElementById("quizCount")?.value) || 5;

  const topic = topicInput || subject;

  if (!topic) {
    alert("Please select or enter a topic");
    return;
  }

  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `<p>⏳ Generating quiz...</p>`;

  try {
    const res = await fetch("https://studybyte-ssuq.onrender.com/api/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ topic, level, count })
    });

    const data = await res.json();

    if (!data.questions) {
  console.error("API ERROR:", data);
  quizArea.innerHTML = `❌ Error: ${data.error || "Invalid response"}`;
  return;
}

    currentQuestions = data.questions;

    // RENDER QUESTIONS
    quizArea.innerHTML = `
      ${currentQuestions.map((q, i) => `
        <div style="margin-bottom:20px; padding:15px; background:#1e222b; border-radius:10px;">
          
          <p><b>Q${i + 1}. ${q.question}</b></p>

          ${q.options.map(opt => `
            <label style="display:block; margin:5px 0;">
              <input type="radio" name="q${i}" value="${opt}">
              ${opt}
            </label>
          `).join("")}

        </div>
      `).join("")}

      <button onclick="submitQuiz()">Submit Quiz</button>
    `;

  } catch (err) {
    console.error(err);
    quizArea.innerHTML = "❌ Error loading quiz";
  }
};


// SUBMIT QUIZ
window.submitQuiz = () => {
  let score = 0;

  currentQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);

    if (selected && selected.value === q.answer) {
      score++;
    }
  });

  const total = currentQuestions.length;

  const quizArea = document.getElementById("quizArea");
  let attempted = 0;

currentQuestions.forEach((q, i) => {
  const selected = document.querySelector(`input[name="q${i}"]:checked`);

  if (selected) {
    attempted++;
    if (selected.value === q.answer) score++;
  }
});

if (attempted === 0) {
  alert("Please answer at least one question");
  return;
}
function analyzeWeakAreas(answers) {
  const weak = [];

  answers.forEach(item => {
    if (!item.isCorrect) {
      weak.push(item.question.question);
    }
  });

  return weak;
}

  // 🔒 prevent multiple submissions
  if (document.getElementById("finalScore")) return;

  quizArea.innerHTML += `
    <div id="finalScore" style="margin-top:20px; padding:15px; background:#111; border-radius:10px;">
      <h3>🎯 Your Score: ${score} / ${total}</h3>
    </div>
  `;
};

// ===== AI QUIZ UPGRADE =====

let quizPastedImageFile = null;
let currentQuizMeta = null;
let lastQuizResult = null;
let currentQuizIndex = 0;
let quizSessionAnswers = [];
let quizStartedAt = null;
let quizQuestionStartedAt = null;
let quizTimerInterval = null;

function escapeQuizHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSavedQuizzes() {
  try {
    return JSON.parse(localStorage.getItem("savedQuizzes") || "[]");
  } catch {
    return [];
  }
}

function setSavedQuizzes(quizzes) {
  localStorage.setItem("savedQuizzes", JSON.stringify(quizzes));
}

function formatQuizTime(totalSeconds = 0) {
  const secondsValue = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(secondsValue / 60);
  const secondsPart = secondsValue % 60;
  return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
}

function normalizeQuizAnswer(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function getQuestionTypeLabel(type = "mcq") {
  const labels = {
    mcq: "MCQ",
    true_false: "True/False",
    fill_blank: "Fill in the Blank",
    match: "Match the Following",
    mixed: "Mixed"
  };

  return labels[type] || "MCQ";
}

function formatQuizAnswer(answer) {
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    return Object.entries(answer)
      .map(([left, right]) => `${left} -> ${right}`)
      .join(", ");
  }

  return String(answer || "");
}

function isQuizAnswerCorrect(question, selectedAnswer) {
  if (!selectedAnswer) return false;

  if (question.type === "fill_blank") {
    return normalizeQuizAnswer(selectedAnswer) === normalizeQuizAnswer(question.answer);
  }

  if (question.type === "match") {
    if (!question.answer || typeof question.answer !== "object") return false;

    return Object.entries(question.answer).every(([left, right]) =>
      normalizeQuizAnswer(selectedAnswer[left]) === normalizeQuizAnswer(right)
    );
  }

  return selectedAnswer === question.answer;
}

function hasQuizAnswer(selectedAnswer) {
  if (!selectedAnswer) return false;
  if (typeof selectedAnswer === "object") {
    return Object.values(selectedAnswer).some(Boolean);
  }
  return Boolean(String(selectedAnswer).trim());
}

function getSelectedQuizAnswer(question, index) {
  if (question.type === "fill_blank") {
    return document.getElementById(`fillAnswer${index}`)?.value.trim() || "";
  }

  if (question.type === "match") {
    return (question.leftItems || []).reduce((matches, left, itemIndex) => {
      matches[left] = document.getElementById(`matchAnswer${index}_${itemIndex}`)?.value || "";
      return matches;
    }, {});
  }

  return document.querySelector(`input[name="q${index}"]:checked`)?.value || "";
}

function stopQuizTimer() {
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
}

function startQuizTimer() {
  stopQuizTimer();
  quizStartedAt = Date.now();
  quizQuestionStartedAt = Date.now();
  quizTimerInterval = setInterval(() => {
    const timer = document.getElementById("quizTimer");
    if (!timer || !quizStartedAt) return;
    timer.innerText = formatQuizTime((Date.now() - quizStartedAt) / 1000);
  }, 1000);
}

function recordCurrentQuizAnswer() {
  const q = currentQuestions[currentQuizIndex];
  if (!q) return;

  const selectedAnswer = getSelectedQuizAnswer(q, currentQuizIndex);
  const confidence = document.querySelector(`select[name="confidence${currentQuizIndex}"]`)?.value || "sure";
  const previous = quizSessionAnswers[currentQuizIndex] || {};
  const timeSpent = previous.timeSpent || 0;
  const newTime = quizQuestionStartedAt ? (Date.now() - quizQuestionStartedAt) / 1000 : 0;
  const finalAnswer = hasQuizAnswer(selectedAnswer) ? selectedAnswer : previous.selectedAnswer || "";

  quizSessionAnswers[currentQuizIndex] = {
    question: q,
    selectedAnswer: finalAnswer,
    isCorrect: isQuizAnswerCorrect(q, finalAnswer),
    confidence,
    flagged: previous.flagged || false,
    timeSpent: Math.round(timeSpent + newTime)
  };

  quizQuestionStartedAt = Date.now();
}

function updateQuizLevel(score, total) {
  const percent = (score / total) * 100;

  if (percent >= 80) {
    quizLevel = "Advanced";
  } else if (percent >= 50) {
    quizLevel = "Intermediate";
  } else {
    quizLevel = "Beginner";
  }

  localStorage.setItem("quizLevel", quizLevel);
}

function getQuizConcepts(question = "", topic = "") {
  const stopWords = new Set([
    "which", "what", "when", "where", "why", "how", "does", "from", "with",
    "this", "that", "these", "those", "about", "correct", "following", "true",
    "false", "best", "most", "least", "used", "called", "into", "between",
    "question", "answer", "option", "define", "explain", "study", "topic"
  ]);

  const source = `${topic} ${question}`.toLowerCase();
  const words = source.match(/[a-z0-9]+/g) || [];
  const concepts = words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 4);

  return concepts.length ? [...new Set(concepts)] : ["core concepts"];
}

function buildQuizAnalytics(answers, meta = {}) {
  const conceptMap = {};
  const confidenceStats = {
    sure: { total: 0, correct: 0 },
    unsure: { total: 0, correct: 0 },
    guess: { total: 0, correct: 0 }
  };

  answers.forEach(item => {
    const confidence = item.confidence || "unsure";
    confidenceStats[confidence].total += 1;
    if (item.isCorrect) confidenceStats[confidence].correct += 1;

    getQuizConcepts(item.question?.question, meta.topic).forEach(concept => {
      if (!conceptMap[concept]) {
        conceptMap[concept] = { concept, total: 0, correct: 0, missed: [] };
      }

      conceptMap[concept].total += 1;
      if (item.isCorrect) {
        conceptMap[concept].correct += 1;
      } else {
        conceptMap[concept].missed.push(item.question?.question || "Question");
      }
    });
  });

  const zones = Object.values(conceptMap)
    .map(zone => ({
      ...zone,
      accuracy: Math.round((zone.correct / zone.total) * 100)
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

  const weakZones = zones.filter(zone => zone.accuracy < 70).slice(0, 4);
  const strongZones = zones.filter(zone => zone.accuracy >= 70).reverse().slice(0, 4);
  const confidentMisses = answers.filter(item => item.confidence === "sure" && !item.isCorrect);
  const luckyCorrect = answers.filter(item => item.confidence === "guess" && item.isCorrect);
  const attempted = answers.filter(item => item.selectedAnswer).length;
  const totalTime = answers.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
  const slowestQuestion = answers.reduce((slowest, item, index) => {
    if (!slowest || (item.timeSpent || 0) > (slowest.timeSpent || 0)) {
      return { ...item, index };
    }
    return slowest;
  }, null);

  return {
    attempted,
    weakZones,
    strongZones,
    confidenceStats,
    confidentMisses,
    luckyCorrect,
    totalTime,
    averageTime: answers.length ? Math.round(totalTime / answers.length) : 0,
    slowestQuestion
  };
}

function getQuizRecommendation(result) {
  const weak = result.analytics?.weakZones?.[0]?.concept;
  const confidentMisses = result.analytics?.confidentMisses?.length || 0;

  if (result.percentage >= 85 && confidentMisses === 0) {
    return "You are ready to increase the difficulty or try a timed challenge on this topic.";
  }

  if (confidentMisses > 0) {
    return "Review the questions you felt sure about but missed. Those are the highest-value fixes.";
  }

  if (weak) {
    return `Spend 15 minutes revising ${weak}, then retake only the missed questions.`;
  }

  if (result.percentage >= 60) {
    return "You have a usable base. Do one mixed revision pass and focus on explanations for missed answers.";
  }

  return "Rebuild the basics first: read a short summary, make 5 flashcards, then retake this quiz.";
}

function buildStudyMaterials(result) {
  const weakConcepts = result.analytics?.weakZones?.map(zone => zone.concept) || [];
  const baseTopic = result.topic || "study topic";
  const targets = (weakConcepts.length ? weakConcepts : [baseTopic]).slice(0, 3);

  return targets.map(target => {
    const query = `${baseTopic} ${target} ${result.level || ""}`.trim();
    const encoded = encodeURIComponent(query);

    return {
      title: target,
      youtube: `https://www.youtube.com/results?search_query=${encoded}+tutorial`,
      notes: `https://www.google.com/search?q=${encoded}+study+notes`,
      practice: `https://www.google.com/search?q=${encoded}+practice+questions`
    };
  });
}

function renderStudyMaterials(result) {
  const materials = buildStudyMaterials(result);

  return `
    <section class="quiz-insight-panel quiz-insight-wide">
      <h4>Recommended study material</h4>
      <div class="quiz-material-list">
        ${materials.map(item => `
          <div class="quiz-material-card">
            <b>${escapeQuizHTML(item.title)}</b>
            <div>
              <a href="${item.youtube}" target="_blank" rel="noopener">YouTube lessons</a>
              <a href="${item.notes}" target="_blank" rel="noopener">Study notes</a>
              <a href="${item.practice}" target="_blank" rel="noopener">Practice questions</a>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function getQuizHistoryStats() {
  const quizzes = getSavedQuizzes();
  const completed = quizzes.filter(quiz => Number.isFinite(quiz.percentage));
  const recent = completed.slice(0, 6).reverse();
  const average = completed.length
    ? Math.round(completed.reduce((sum, quiz) => sum + quiz.percentage, 0) / completed.length)
    : 0;
  const best = completed.length ? Math.max(...completed.map(quiz => quiz.percentage)) : 0;

  return { recent, average, best, total: completed.length };
}

function renderMiniBarChart(items, labelKey, valueKey) {
  if (!items.length) {
    return `<p class="quiz-muted">No data yet.</p>`;
  }

  return `
    <div class="quiz-bar-chart">
      ${items.map(item => {
        const value = Math.max(0, Math.min(100, Number(item[valueKey]) || 0));
        const label = escapeQuizHTML(String(item[labelKey] || "Quiz"));
        const color = escapeQuizHTML(item.color || "#18a66a");
        const displayValue = escapeQuizHTML(item.displayValue || `${value}%`);

        return `
          <div class="quiz-bar-row">
            <span>${label}</span>
            <div class="quiz-bar-track">
              <div class="quiz-bar-fill" style="width:${value}%; --bar-color:${color}"></div>
            </div>
            <b>${displayValue}</b>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderConfidenceChart(stats) {
  const rows = [
    { label: "Sure", key: "sure", color: "#25c06d" },
    { label: "Unsure", key: "unsure", color: "#f7b731" },
    { label: "Guess", key: "guess", color: "#ff6b6b" }
  ].map(row => {
    const item = stats[row.key] || { total: 0, correct: 0 };
    const accuracy = item.total ? Math.round((item.correct / item.total) * 100) : 0;
    return { label: row.label, accuracy, total: item.total, color: row.color };
  });

  return renderMiniBarChart(rows, "label", "accuracy");
}

function renderZoneList(zones, emptyText) {
  if (!zones.length) {
    return `<p class="quiz-muted">${emptyText}</p>`;
  }

  return zones.map(zone => `
    <div class="quiz-zone-pill">
      <span>${escapeQuizHTML(zone.concept)}</span>
      <b>${zone.accuracy}%</b>
    </div>
  `).join("");
}

function getQuizAnswers() {
  recordCurrentQuizAnswer();

  return currentQuestions.map((q, i) => {
    const saved = quizSessionAnswers[i] || {};
    return {
      question: q,
      selectedAnswer: saved.selectedAnswer || "",
      isCorrect: isQuizAnswerCorrect(q, saved.selectedAnswer),
      confidence: saved.confidence || "sure",
      flagged: saved.flagged || false,
      timeSpent: saved.timeSpent || 0
    };
  });
}

function renderQuizQuestions(index = currentQuizIndex) {
  const quizArea = document.getElementById("quizArea");
  if (!currentQuestions.length) return;

  currentQuizIndex = Math.max(0, Math.min(index, currentQuestions.length - 1));
  quizQuestionStartedAt = Date.now();

  const q = currentQuestions[currentQuizIndex];
  const saved = quizSessionAnswers[currentQuizIndex] || {};
  const answeredCount = quizSessionAnswers.filter(item => item?.selectedAnswer).length;
  const progress = Math.round(((currentQuizIndex + 1) / currentQuestions.length) * 100);
  const questionType = q.type || "mcq";
  const options = questionType === "true_false" ? ["True", "False"] : (q.options || []);
  const answerMarkup = questionType === "fill_blank"
    ? `<input id="fillAnswer${currentQuizIndex}" class="quiz-fill-input" value="${escapeQuizHTML(saved.selectedAnswer || "")}" placeholder="Type your answer" />`
    : questionType === "match"
      ? `
        <div class="quiz-match-list">
          ${(q.leftItems || []).map((left, itemIndex) => `
            <div class="quiz-match-row">
              <span>${escapeQuizHTML(left)}</span>
              <select id="matchAnswer${currentQuizIndex}_${itemIndex}">
                <option value="">Choose match</option>
                ${(q.rightItems || []).map(right => `
                  <option value="${escapeQuizHTML(right)}" ${saved.selectedAnswer?.[left] === right ? "selected" : ""}>${escapeQuizHTML(right)}</option>
                `).join("")}
              </select>
            </div>
          `).join("")}
        </div>
      `
      : options.map(opt => `
        <label class="quiz-option ${saved.selectedAnswer === opt ? "selected" : ""}">
          <input type="radio" name="q${currentQuizIndex}" value="${escapeQuizHTML(opt)}" ${saved.selectedAnswer === opt ? "checked" : ""}>
          ${escapeQuizHTML(opt)}
        </label>
      `).join("");

  quizArea.innerHTML = `
    <div class="quiz-live-header">
      <div>
        <b>Question ${currentQuizIndex + 1} of ${currentQuestions.length}</b>
        <span>${answeredCount}/${currentQuestions.length} answered</span>
      </div>
      <div class="quiz-timer-pill">Time <b id="quizTimer">${formatQuizTime(quizStartedAt ? (Date.now() - quizStartedAt) / 1000 : 0)}</b></div>
    </div>

    <div class="quiz-progress-track">
      <div class="quiz-progress-fill" style="width:${progress}%"></div>
    </div>

    <div class="quiz-jump-row">
      ${currentQuestions.map((_, i) => `
        <button
          class="quiz-jump-dot ${i === currentQuizIndex ? "active" : ""} ${quizSessionAnswers[i]?.selectedAnswer ? "answered" : ""} ${quizSessionAnswers[i]?.flagged ? "flagged" : ""}"
          onclick="goToQuizQuestion(${i})"
          title="Question ${i + 1}"
        >${i + 1}</button>
      `).join("")}
    </div>

    <div class="quiz-card quiz-focus-card">
      <div class="quiz-type-badge">${getQuestionTypeLabel(questionType)}</div>
      <p><b>Q${currentQuizIndex + 1}. ${escapeQuizHTML(q.question)}</b></p>

      ${answerMarkup}

      <div class="quiz-confidence-row">
        <label for="confidence${currentQuizIndex}">Confidence</label>
        <select id="confidence${currentQuizIndex}" name="confidence${currentQuizIndex}">
          <option value="sure" ${(saved.confidence || "sure") === "sure" ? "selected" : ""}>Sure</option>
          <option value="unsure" ${saved.confidence === "unsure" ? "selected" : ""}>Unsure</option>
          <option value="guess" ${saved.confidence === "guess" ? "selected" : ""}>Guess</option>
        </select>
      </div>

      <div id="quizInstantFeedback" class="quiz-instant-feedback"></div>
    </div>

    <div class="quiz-result-actions">
      <button onclick="prevQuizQuestion()" style="background:#444;" ${currentQuizIndex === 0 ? "disabled" : ""}>Previous</button>
      <button onclick="checkCurrentQuizAnswer()" style="background:#444;">Check</button>
      <button onclick="toggleQuizFlag()" style="background:#444;">${saved.flagged ? "Unflag" : "Flag"}</button>
      ${currentQuizIndex === currentQuestions.length - 1
        ? `<button onclick="submitQuiz()">Submit Quiz</button>`
        : `<button onclick="nextQuizQuestion()">Next</button>`}
      <button onclick="restartQuiz()" style="background:#444;">Restart Quiz</button>
      <button onclick="newQuiz()" style="background:#444;">New Quiz</button>
    </div>
  `;
}

window.goToQuizQuestion = (index) => {
  recordCurrentQuizAnswer();
  renderQuizQuestions(index);
};

window.nextQuizQuestion = () => {
  recordCurrentQuizAnswer();
  renderQuizQuestions(currentQuizIndex + 1);
};

window.prevQuizQuestion = () => {
  recordCurrentQuizAnswer();
  renderQuizQuestions(currentQuizIndex - 1);
};

window.toggleQuizFlag = () => {
  recordCurrentQuizAnswer();
  const saved = quizSessionAnswers[currentQuizIndex] || {};
  quizSessionAnswers[currentQuizIndex] = {
    ...saved,
    question: currentQuestions[currentQuizIndex],
    flagged: !saved.flagged
  };
  renderQuizQuestions(currentQuizIndex);
};

window.checkCurrentQuizAnswer = () => {
  recordCurrentQuizAnswer();
  const q = currentQuestions[currentQuizIndex];
  const saved = quizSessionAnswers[currentQuizIndex];
  const feedback = document.getElementById("quizInstantFeedback");

  if (!saved?.selectedAnswer) {
    alert("Choose an answer first");
    return;
  }

  feedback.innerHTML = `
    <div class="${saved.isCorrect ? "correct" : "incorrect"}">
      <b>${saved.isCorrect ? "Correct" : "Incorrect"}</b>
      <p>Correct answer: ${escapeQuizHTML(formatQuizAnswer(q.answer))}</p>
      <p>${escapeQuizHTML(q.explanation || "No explanation provided.")}</p>
    </div>
  `;
};

function renderQuizResults(result) {
  const quizArea = document.getElementById("quizArea");
  const analytics = result.analytics || buildQuizAnalytics(result.answers || [], result);
  const recommendation = result.recommendation || getQuizRecommendation({ ...result, analytics });
  const history = getQuizHistoryStats();
  const zoneRows = [
    ...analytics.weakZones.map(zone => ({ name: zone.concept, accuracy: zone.accuracy, color: "#ff6b6b" })),
    ...analytics.strongZones.map(zone => ({ name: zone.concept, accuracy: zone.accuracy, color: "#25c06d" }))
  ].slice(0, 6);
  const timeRows = result.answers.map((item, index) => ({
    label: `Q${index + 1}`,
    seconds: Math.min(100, item.timeSpent || 0),
    displayValue: formatQuizTime(item.timeSpent || 0),
    color: item.isCorrect ? "#25c06d" : "#ff6b6b"
  }));

  quizArea.innerHTML = `
    <div id="finalScore" class="quiz-score-card quiz-dashboard">
      <div>
        <h3>Score: ${result.score} / ${result.total}</h3>
        <p>${result.percentage}% correct</p>
        <p class="quiz-muted">Time taken: ${formatQuizTime(result.timeTaken || analytics.totalTime)} | Avg/Q: ${formatQuizTime(analytics.averageTime)}</p>
      </div>
      <div class="quiz-score-ring" style="--score:${result.percentage}">
        <span>${result.percentage}%</span>
      </div>
    </div>

    <div class="quiz-insight-grid">
      <section class="quiz-insight-panel">
        <h4>Accuracy by zone</h4>
        ${renderMiniBarChart(zoneRows, "name", "accuracy")}
      </section>

      <section class="quiz-insight-panel">
        <h4>Strong zones</h4>
        ${renderZoneList(analytics.strongZones, "No strong zone yet. Retake after revision.")}
      </section>

      <section class="quiz-insight-panel">
        <h4>Weak zones</h4>
        ${renderZoneList(analytics.weakZones, "No weak zone detected. Nice consistency.")}
      </section>

      <section class="quiz-insight-panel">
        <h4>Confidence check</h4>
        ${renderConfidenceChart(analytics.confidenceStats)}
      </section>

      <section class="quiz-insight-panel">
        <h4>Time by question</h4>
        ${renderMiniBarChart(timeRows, "label", "seconds")}
        <p class="quiz-muted">Bars cap at 100 seconds for readability.</p>
      </section>

      <section class="quiz-insight-panel quiz-insight-wide">
        <h4>Smart suggestion</h4>
        <p>${escapeQuizHTML(recommendation)}</p>
        <div class="quiz-metric-strip">
          <span>Attempted <b>${analytics.attempted}/${result.total}</b></span>
          <span>Time <b>${formatQuizTime(result.timeTaken || analytics.totalTime)}</b></span>
          <span>Confident misses <b>${analytics.confidentMisses.length}</b></span>
          <span>Lucky correct <b>${analytics.luckyCorrect.length}</b></span>
          <span>Flagged <b>${result.answers.filter(item => item.flagged).length}</b></span>
        </div>
      </section>

      ${renderStudyMaterials({ ...result, analytics })}

      <section class="quiz-insight-panel">
        <h4>Saved trend</h4>
        <p class="quiz-muted">Average ${history.average}% | Best ${history.best}% | Saved ${history.total}</p>
        ${renderMiniBarChart(history.recent.map((quiz, index) => ({
          label: `Quiz ${index + 1}`,
          percentage: quiz.percentage,
          color: quiz.percentage >= 80 ? "#25c06d" : quiz.percentage >= 50 ? "#f7b731" : "#ff6b6b"
        })), "label", "percentage")}
      </section>
    </div>

    ${result.answers.map((item, i) => `
      <div class="quiz-card">
        <div class="quiz-type-badge">${getQuestionTypeLabel(item.question.type || "mcq")}</div>
        <p><b>Q${i + 1}. ${escapeQuizHTML(item.question.question)}</b></p>
        <p>Your answer: ${hasQuizAnswer(item.selectedAnswer) ? escapeQuizHTML(formatQuizAnswer(item.selectedAnswer)) : "Not answered"}</p>
        <p>Correct answer: <b>${escapeQuizHTML(formatQuizAnswer(item.question.answer))}</b></p>
        <p>${item.isCorrect ? "Correct" : "Incorrect"} | Confidence: ${escapeQuizHTML(item.confidence || "sure")} | Time: ${formatQuizTime(item.timeSpent || 0)}${item.flagged ? " | Flagged" : ""}</p>
        <p><b>Explanation:</b> ${escapeQuizHTML(item.question.explanation || "No explanation provided.")}</p>
      </div>
    `).join("")}

    <div class="quiz-result-actions">
      <button onclick="saveQuiz()">Save Quiz</button>
      ${result.answers.some(item => !item.isCorrect)
        ? `<button onclick="startWeakDrill()" style="background:#444;">Weak Drill</button>`
        : ""}
      <button onclick="restartQuiz()" style="background:#444;">Restart Quiz</button>
      <button onclick="newQuiz()" style="background:#444;">New Quiz</button>
    </div>
  `;
}

window.startQuiz = async () => {
  const subject = document.getElementById("quizSubject")?.value || "";
  const topicInput = document.getElementById("quizTopic")?.value || "";
  const level = document.getElementById("quizLevel")?.value || "Beginner";
  const count = parseInt(document.getElementById("quizCount")?.value) || 5;
  const questionType = document.getElementById("quizQuestionType")?.value || "mcq";
  const youtube = document.getElementById("quizSourceLink")?.value.trim() || "";
  const file = quizPastedImageFile || document.getElementById("quizFileInput")?.files[0];
  const topic = topicInput || subject;

  if (!topic && !youtube && !file) {
    alert("Please select a topic, upload a file, paste an image, or add a YouTube link");
    return;
  }

  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = "<p>Generating quiz...</p>";

  try {
    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("level", level);
    formData.append("count", count);
    formData.append("questionType", questionType);
    formData.append("freshSeed", Date.now().toString());

    if (youtube) formData.append("youtube", youtube);
    if (file) formData.append("file", file);

    const res = await fetch("https://studybyte-ssuq.onrender.com/api/quiz", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.questions) {
      console.error("API ERROR:", data);
      quizArea.innerHTML = `Error: ${data.error || "Invalid response"}`;
      return;
    }

    currentQuestions = data.questions;
    currentQuizMeta = {
      topic,
      level,
      count,
      questionType,
      source: file?.name || youtube || "topic",
      createdAt: new Date().toISOString()
    };
    lastQuizResult = null;
    currentQuizIndex = 0;
    quizSessionAnswers = currentQuestions.map(q => ({
      question: q,
      selectedAnswer: "",
      isCorrect: false,
      confidence: "sure",
      flagged: false,
      timeSpent: 0
    }));
    startQuizTimer();

    renderQuizQuestions(0);
  } catch (err) {
    console.error(err);
    quizArea.innerHTML = "Error loading quiz";
  }
};

window.submitQuiz = () => {
  if (!currentQuestions.length) return;

  const answers = getQuizAnswers();
  const attempted = answers.filter(item => item.selectedAnswer).length;

  if (attempted === 0) {
    alert("Please answer at least one question");
    return;
  }

  const total = answers.length;
  const score = answers.filter(item => item.isCorrect).length;
  const timeTaken = quizStartedAt ? Math.round((Date.now() - quizStartedAt) / 1000) : answers.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
  stopQuizTimer();
  updateQuizLevel(score, total);

  lastQuizResult = {
    ...currentQuizMeta,
    score,
    total,
    percentage: Math.round((score / total) * 100),
    answers,
    timeTaken,
    submittedAt: new Date().toISOString()
  };
  lastQuizResult.analytics = buildQuizAnalytics(answers, lastQuizResult);
  lastQuizResult.recommendation = getQuizRecommendation(lastQuizResult);

  renderQuizResults(lastQuizResult);
};

window.saveQuiz = () => {
  if (!lastQuizResult) {
    alert("Submit the quiz before saving");
    return;
  }

  const quizzes = getSavedQuizzes();
  quizzes.unshift({
    id: Date.now().toString(),
    ...lastQuizResult
  });

  setSavedQuizzes(quizzes.slice(0, 50));
  alert("Quiz saved");
};

window.viewSavedQuizzes = () => {
  const quizzes = getSavedQuizzes();
  const quizArea = document.getElementById("quizArea");

  if (!quizzes.length) {
    quizArea.innerHTML = "<p>No saved quizzes yet.</p>";
    return;
  }

  quizArea.innerHTML = `
    <h3>Saved Quizzes</h3>
    <div class="quiz-insight-grid">
      <section class="quiz-insight-panel quiz-insight-wide">
        <h4>Performance history</h4>
        ${renderMiniBarChart(quizzes.slice(0, 8).reverse().map((quiz, index) => ({
          label: quiz.topic || `Quiz ${index + 1}`,
          percentage: quiz.percentage || 0,
          color: (quiz.percentage || 0) >= 80 ? "#25c06d" : (quiz.percentage || 0) >= 50 ? "#f7b731" : "#ff6b6b"
        })), "label", "percentage")}
      </section>
    </div>
    ${quizzes.map(quiz => `
      <div class="quiz-card">
        <h4>${escapeQuizHTML(quiz.topic || "Quiz")}</h4>
        <p>Level: ${escapeQuizHTML(quiz.level || "Unknown")}</p>
        <p>Type: ${escapeQuizHTML(getQuestionTypeLabel(quiz.questionType || "mcq"))}</p>
        <p>Score: ${quiz.score} / ${quiz.total} (${quiz.percentage}%)</p>
        <p>Time: ${formatQuizTime(quiz.timeTaken || 0)}</p>
        <p>Suggestion: ${escapeQuizHTML(quiz.recommendation || "Open this quiz for a detailed review.")}</p>
        <p>Saved: ${new Date(quiz.submittedAt || quiz.createdAt).toLocaleString()}</p>
        <button onclick="openSavedQuiz('${quiz.id}')">Open</button>
      </div>
    `).join("")}
  `;
};

window.openSavedQuiz = (id) => {
  const quiz = getSavedQuizzes().find(item => item.id === id);

  if (!quiz) {
    alert("Saved quiz not found");
    return;
  }

  lastQuizResult = quiz;
  currentQuestions = quiz.answers.map(item => item.question);
  quizSessionAnswers = quiz.answers.map(item => ({
    question: item.question,
    selectedAnswer: item.selectedAnswer || "",
    isCorrect: item.isCorrect || false,
    confidence: item.confidence || "sure",
    flagged: item.flagged || false,
    timeSpent: item.timeSpent || 0
  }));
  currentQuizMeta = {
    topic: quiz.topic,
    level: quiz.level,
    questionType: quiz.questionType,
    count: quiz.total,
    createdAt: quiz.createdAt
  };

  renderQuizResults(quiz);
};

window.startWeakDrill = () => {
  if (!lastQuizResult?.answers?.length) return;

  const missedQuestions = lastQuizResult.answers
    .filter(item => !item.isCorrect)
    .map(item => item.question);

  if (!missedQuestions.length) {
    alert("No weak questions to drill");
    return;
  }

  currentQuestions = missedQuestions;
  quizSessionAnswers = missedQuestions.map(q => ({
    question: q,
    selectedAnswer: "",
    isCorrect: false,
    confidence: "sure",
    flagged: false,
    timeSpent: 0
  }));
  currentQuizMeta = {
    topic: `${lastQuizResult.topic || "Quiz"} weak drill`,
    level: lastQuizResult.level || "Practice",
    questionType: lastQuizResult.questionType || "mixed",
    count: missedQuestions.length,
    source: "weak drill",
    createdAt: new Date().toISOString()
  };
  lastQuizResult = null;
  currentQuizIndex = 0;
  startQuizTimer();

  renderQuizQuestions(0);
};

window.restartQuiz = () => {
  if (!currentQuestions.length) return;
  lastQuizResult = null;
  currentQuizIndex = 0;
  quizSessionAnswers = currentQuestions.map(q => ({
    question: q,
    selectedAnswer: "",
    isCorrect: false,
    confidence: "sure",
    flagged: false,
    timeSpent: 0
  }));
  startQuizTimer();
  renderQuizQuestions(0);
};

window.newQuiz = () => {
  currentQuestions = [];
  currentQuizMeta = null;
  lastQuizResult = null;
  currentQuizIndex = 0;
  quizSessionAnswers = [];
  quizStartedAt = null;
  quizQuestionStartedAt = null;
  stopQuizTimer();
  quizPastedImageFile = null;
  document.getElementById("quizFileInput").value = "";
  document.getElementById("quizSourceLink").value = "";
  document.getElementById("quizPasteStatus").innerText = "No pasted image";
  document.getElementById("quizArea").innerHTML = "";
};

document.addEventListener("paste", (event) => {
  const quizModal = document.getElementById("quizModal");
  if (!quizModal || quizModal.style.display !== "block") return;

  const imageItem = [...event.clipboardData.items].find(item => item.type.startsWith("image/"));
  if (!imageItem) return;

  const blob = imageItem.getAsFile();
  if (!blob) return;

  quizPastedImageFile = new File([blob], `pasted-quiz-image-${Date.now()}.png`, {
    type: blob.type || "image/png"
  });

  document.getElementById("quizPasteStatus").innerText = "Image ready for quiz";
});





