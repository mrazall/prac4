// app.js
// Требования: функции и обработчики событий вынесены сюда,
// привязка обработчиков и работа с DOM — в window.onload

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function appendTextMessage(container, from, text) {
  const msg = el("div", `msg ${from === "me" ? "msg--me" : "msg--bot"}`);
  const p = el("p", null, text);
  p.style.margin = "0";
  msg.appendChild(p);

  const meta = el("span", "msg__meta", `${from === "me" ? "Вы" : "Автор"} • ${formatTime(new Date())}`);
  msg.appendChild(meta);

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function appendVoiceMessage(container, from, blob) {
  const msg = el("div", `msg ${from === "me" ? "msg--me" : "msg--bot"}`);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = URL.createObjectURL(blob);
  audio.style.width = "100%";

  msg.appendChild(audio);

  const meta = el("span", "msg__meta", `${from === "me" ? "Вы" : "Автор"} • голосовое • ${formatTime(new Date())}`);
  msg.appendChild(meta);

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function pickReply(message) {
  const m = message.toLowerCase();

  // Ключевые слова → пул ответов
  const rules = [
    {
      keys: ["вшэ", "hse", "университет", "пары", "лекц"],
      replies: [
        "Учёба в ВШЭ держит в тонусе. Во вторник обычно на парах.",
        "ВШЭ — это про дисциплину и много практики. Какой предмет сейчас самый интересный?",
        "Если про пары: вторник у меня обычно учебный день."
      ]
    },
    {
      keys: ["работ", "согласие", "ск", "страхов", "компан"],
      replies: [
        "Основная занятость — работа в СК «Согласие».",
        "Работаю в страховой сфере, поэтому часто думаю про риск и вероятности.",
        "Да, большую часть недели я на работе, поэтому время планирую заранее."
      ]
    },
    {
      keys: ["актуар", "актуарная", "матем", "риск", "вероят", "статист"],
      replies: [
        "Актуарная математика — это про модели риска, частоты/тяжести убытков и тарифы.",
        "Если хочешь, могу объяснить базовые термины: частота, severity, резервирование.",
        "Люблю задачи, где статистика превращается в реальные решения для бизнеса."
      ]
    },
    {
      keys: ["карт", "leaflet", "map", "маркер", "координ"],
      replies: [
        "Карта сделана на Leaflet: можно масштабировать и двигать маркеры.",
        "Leaflet удобен тем, что лёгкий и хорошо работает на статических страницах.",
        "Если хочешь, добавлю на карту ещё точки и всплывающие подсказки."
      ]
    },
    {
      keys: ["привет", "hello", "здрав"],
      replies: [
        "Привет! Напиши, что тебе интересно: учёба, работа или актуарная математика?",
        "Здравствуйте! Могу рассказать про расписание или про то, что изучаю."
      ]
    }
  ];

  for (const rule of rules) {
    if (rule.keys.some(k => m.includes(k))) {
      return rule.replies[Math.floor(Math.random() * rule.replies.length)];
    }
  }

  // Общие случайные ответы, если ключевые слова не найдены
  const fallback = [
    "Понял. Уточни, пожалуйста, что именно тебя интересует?",
    "Интересная мысль. Можешь добавить деталей?",
    "Ок. Если хочешь, напиши ключевое слово: ВШЭ / работа / актуарная / карта."
  ];
  return fallback[Math.floor(Math.random() * fallback.length)];
}

function initMap() {
  const study = [55.8039, 37.3965];   // Таллинская, 34
  const work  = [55.7826, 37.6316];   // Гиляровского, 42

  const map = L.map("map", { scrollWheelZoom: true }).setView(study, 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markerStudy = L.marker(study, { draggable: true }).addTo(map);
  markerStudy.bindPopup("Учёба — Таллинская ул., 34").openPopup();

  const markerWork = L.marker(work, { draggable: true }).addTo(map);
  markerWork.bindPopup("Работа — Гиляровского 42");

  markerStudy.on("dragend", () => {
    const p = markerStudy.getLatLng();
    markerStudy.setPopupContent(`Учёба: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
  });

  markerWork.on("dragend", () => {
    const p = markerWork.getLatLng();
    markerWork.setPopupContent(`Работа: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
  });
}

function setupChat() {
  const messages = document.getElementById("chatMessages");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const clearBtn = document.getElementById("chatClear");
  const voiceBtn = document.getElementById("voiceToggle");

  let recorder = null;
  let chunks = [];
  let recording = false;
  let stream = null;

  function botReply(toText) {
    const reply = pickReply(toText);
    // небольшая задержка для “живости”
    window.setTimeout(() => appendTextMessage(messages, "bot", reply), 350 + Math.random() * 450);
  }

  function sendText() {
    const text = (input.value || "").trim();
    if (!text) return;

    appendTextMessage(messages, "me", text);
    input.value = "";
    botReply(text);
  }

  async function toggleVoice() {
    if (!recording) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          appendVoiceMessage(messages, "me", blob);

          // Автоответ на голосовое: случайный общий ответ
          window.setTimeout(() => {
            appendTextMessage(messages, "bot", "Получил голосовое. Если напишешь ключевое слово, отвечу точнее.");
          }, 400);

          // освободим микрофон
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
          }
        };

        recorder.start();
        recording = true;
        voiceBtn.setAttribute("aria-pressed", "true");
        voiceBtn.textContent = "⏹ Стоп";
      } catch (err) {
        appendTextMessage(messages, "bot", "Не удалось получить доступ к микрофону. Проверь разрешения браузера.");
      }
    } else {
      recorder.stop();
      recording = false;
      voiceBtn.setAttribute("aria-pressed", "false");
      voiceBtn.textContent = "🎙 Запись";
    }
  }

  // handlers
  sendBtn.addEventListener("click", sendText);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendText();
  });
  clearBtn.addEventListener("click", () => {
    messages.innerHTML = "";
    appendTextMessage(messages, "bot", "Чат очищен. Напиши сообщение — отвечу.");
  });
  voiceBtn.addEventListener("click", toggleVoice);

  // стартовое сообщение
  appendTextMessage(messages, "bot", "Привет! Я автор страницы. Спроси про ВШЭ, работу, актуарную математику или карту.");
}

window.onload = function () {
  // DOM + обработчики здесь по требованию
  if (document.getElementById("map")) initMap();
  if (document.getElementById("chatMessages")) setupChat();
};