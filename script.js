// ===== Подключение Firebase (SDK подгружается с CDN, сборка не нужна) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Публичный конфиг веб-приложения (не секретный, защита делается правилами Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyDK7Vxlq3gtZTD5FG4tDFIs9ZQhPF9smBs",
  authDomain: "it-study-planner.firebaseapp.com",
  projectId: "it-study-planner",
  storageBucket: "it-study-planner.firebasestorage.app",
  messagingSenderId: "35536142905",
  appId: "1:35536142905:web:e35a4e70549654fe4a43e8",
  measurementId: "G-F2E2VD4ZJR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== Настройки =====
const CATEGORIES = ["HTML", "CSS", "JavaScript", "Другое"];

// CSS-класс для цветного бейджа каждой категории
const CATEGORY_CLASSES = {
  "HTML": "cat-html",
  "CSS": "cat-css",
  "JavaScript": "cat-js",
  "Другое": "cat-other"
};

// Стартовые задачи (создаются один раз при первом запуске нового пользователя)
const defaultTasks = [
  { text: "Повторить основы HTML", category: "HTML", completed: true },
  { text: "Разобраться с Flexbox", category: "CSS", completed: false },
  { text: "Написать первое приложение", category: "JavaScript", completed: false },
  { text: "Подготовиться к контрольной", category: "Другое", completed: false }
];

// ===== Находим элементы страницы =====
const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const categorySelect = document.querySelector("#categorySelect");
const errorMessage = document.querySelector("#errorMessage");
const taskList = document.querySelector("#taskList");
const emptyMessage = document.querySelector("#emptyMessage");
const totalElement = document.querySelector("#total");
const completedElement = document.querySelector("#completed");
const percentElement = document.querySelector("#percent");
const progressBar = document.querySelector("#progressBar");
const progressFill = document.querySelector("#progressFill");
const filterButtons = document.querySelectorAll(".filter-button");
const clearButton = document.querySelector("#clearButton");
const confirmBox = document.querySelector("#confirmBox");
const confirmYes = document.querySelector("#confirmYes");
const confirmNo = document.querySelector("#confirmNo");

// ===== Данные приложения =====
let tasks = [];            // обновляется из Firestore в реальном времени
let isLoaded = false;      // пришли ли данные из базы
let currentUid = null;     // id анонимного пользователя
let tasksCollection = null;
let currentFilter = "all"; // all, active или completed

// ===== Работа с Firestore =====
// Структура: users/{uid}/tasks/{taskId}

function taskRef(id) {
  return doc(db, "users", currentUid, "tasks", id);
}

// Приводим документ из базы к нормальному виду
function normalizeTask(id, data) {
  return {
    id: id,
    text: typeof data.text === "string" ? data.text : "",
    category: CATEGORIES.includes(data.category) ? data.category : "Другое",
    completed: Boolean(data.completed)
  };
}

// Создаём стартовые задачи и отметку, что это уже сделано
async function seedDefaultTasks(userRef) {
  const batch = writeBatch(db);
  batch.set(userRef, { seeded: true });
  const now = Date.now();
  defaultTasks.forEach((task, index) => {
    batch.set(doc(tasksCollection), {
      text: task.text,
      category: task.category,
      completed: task.completed,
      createdAt: now + index
    });
  });
  await batch.commit();
}

// Запускаем работу с базой для текущего пользователя
async function startForUser(uid) {
  currentUid = uid;
  tasksCollection = collection(db, "users", uid, "tasks");

  try {
    const userRef = doc(db, "users", uid);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      await seedDefaultTasks(userRef);
    }
  } catch (error) {
    console.error(error);
    showStatusError("Не удалось подключиться к базе данных. Проверьте правила Firestore.");
    return;
  }

  // Подписка на изменения: список обновляется сам
  const tasksQuery = query(tasksCollection, orderBy("createdAt"));
  onSnapshot(
    tasksQuery,
    snapshot => {
      tasks = snapshot.docs.map(item => normalizeTask(item.id, item.data()));
      isLoaded = true;
      renderTasks();
    },
    error => {
      console.error(error);
      showStatusError("Не удалось загрузить задачи из базы данных.");
    }
  );
}

// Анонимный вход: логин и пароль не нужны, у каждого браузера свой список
onAuthStateChanged(auth, user => {
  if (user && user.uid !== currentUid) {
    startForUser(user.uid);
  }
});

signInAnonymously(auth).catch(error => {
  console.error(error);
  showStatusError("Не удалось выполнить вход. Включите Anonymous в Authentication.");
});

// ===== Статистика и прогресс =====
// Считается по всем задачам, независимо от выбранного фильтра
function updateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  totalElement.textContent = total;
  completedElement.textContent = completed;
  percentElement.textContent = percent + "%";

  progressFill.style.width = percent + "%";
  progressBar.setAttribute("aria-valuenow", percent);

  // Кнопка очистки неактивна, если список пуст
  clearButton.disabled = total === 0;
}

// ===== Фильтрация =====
function getVisibleTasks() {
  if (currentFilter === "active") {
    return tasks.filter(task => !task.completed);
  }
  if (currentFilter === "completed") {
    return tasks.filter(task => task.completed);
  }
  return tasks;
}

// ===== Отображение задач =====

// Создаём HTML-элемент одной задачи
function createTaskElement(task) {
  const li = document.createElement("li");

  // Метка с чекбоксом и текстом: клик по тексту тоже отмечает задачу
  const label = document.createElement("label");
  label.className = "task-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text; // textContent защищает от вставки HTML-кода
  if (task.completed) {
    text.classList.add("done");
  }

  label.append(checkbox, text);

  // Бейдж категории
  const badge = document.createElement("span");
  badge.className = "badge " + CATEGORY_CLASSES[task.category];
  badge.textContent = task.category;

  // Кнопка удаления
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Удалить";
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  li.append(label, badge, deleteButton);
  return li;
}

// Перерисовываем весь список
function renderTasks() {
  taskList.innerHTML = "";

  const visibleTasks = getVisibleTasks();
  visibleTasks.forEach(task => {
    taskList.append(createTaskElement(task));
  });

  // Сообщение, если показывать нечего
  if (!isLoaded) {
    emptyMessage.textContent = "Загружаем задачи...";
    emptyMessage.hidden = false;
  } else if (tasks.length === 0) {
    emptyMessage.textContent = "Пока задач нет. Добавьте первую!";
    emptyMessage.hidden = false;
  } else if (visibleTasks.length === 0) {
    emptyMessage.textContent = "В этом фильтре задач нет.";
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
  }

  updateStatistics();
}

// ===== Сообщения об ошибках =====

// Ошибка валидации поля (красная рамка)
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  taskInput.classList.add("invalid");
}

// Ошибка связи с базой (без рамки у поля)
function showStatusError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  taskInput.classList.remove("invalid");
}

// ===== Действия с задачами =====
// Запись в Firestore не блокирует интерфейс: список обновится сам через onSnapshot

// Добавление задачи
function addTask(event) {
  event.preventDefault(); // отменяем перезагрузку страницы при отправке формы

  const text = taskInput.value.trim();

  // Проверка пустого поля
  if (text === "") {
    showError("Введите название задачи!");
    taskInput.focus();
    return;
  }

  if (!tasksCollection) {
    showStatusError("Подключение к базе ещё не готово, попробуйте через секунду.");
    return;
  }

  clearError();

  addDoc(tasksCollection, {
    text: text,
    category: categorySelect.value,
    completed: false,
    createdAt: Date.now()
  }).catch(error => {
    console.error(error);
    showStatusError("Не удалось сохранить задачу.");
  });

  taskInput.value = "";
  taskInput.focus();
}

// Переключение выполнения задачи
function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) {
    return;
  }
  updateDoc(taskRef(id), { completed: !task.completed }).catch(error => {
    console.error(error);
    showStatusError("Не удалось обновить задачу.");
  });
}

// Удаление одной задачи
function deleteTask(id) {
  deleteDoc(taskRef(id)).catch(error => {
    console.error(error);
    showStatusError("Не удалось удалить задачу.");
  });
}

// Удаление всех задач (пакетами, в Firestore лимит 500 операций на пакет)
async function deleteAllTasks() {
  const ids = tasks.map(task => task.id);
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(id => batch.delete(taskRef(id)));
    await batch.commit();
  }
}

// ===== Очистка списка с подтверждением =====
function showConfirm() {
  clearButton.hidden = true;
  confirmBox.hidden = false;
}

function hideConfirm() {
  confirmBox.hidden = true;
  clearButton.hidden = false;
}

// ===== Обработчики событий =====

// Отправка формы (кнопка «Добавить» или Enter)
taskForm.addEventListener("submit", addTask);

// Убираем ошибку, как только пользователь начал печатать
taskInput.addEventListener("input", clearError);

// Фильтры
filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    filterButtons.forEach(item => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    renderTasks();
  });
});

// Очистка списка
clearButton.addEventListener("click", showConfirm);
confirmNo.addEventListener("click", hideConfirm);
confirmYes.addEventListener("click", () => {
  hideConfirm();
  deleteAllTasks().catch(error => {
    console.error(error);
    showStatusError("Не удалось очистить список.");
  });
});

// ===== Первоначальное отображение =====
renderTasks();
