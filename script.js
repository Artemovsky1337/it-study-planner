// ===== Настройки =====
const STORAGE_KEY = "itStudyPlannerTasks";
const CATEGORIES = ["HTML", "CSS", "JavaScript", "Другое"];

// CSS-класс для цветного бейджа каждой категории
const CATEGORY_CLASSES = {
  "HTML": "cat-html",
  "CSS": "cat-css",
  "JavaScript": "cat-js",
  "Другое": "cat-other"
};

// Стартовые задачи (показываются при первом запуске)
const defaultTasks = [
  { id: 1, text: "Повторить основы HTML", category: "HTML", completed: true },
  { id: 2, text: "Разобраться с Flexbox", category: "CSS", completed: false },
  { id: 3, text: "Написать первое приложение", category: "JavaScript", completed: false },
  { id: 4, text: "Подготовиться к контрольной", category: "Другое", completed: false }
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

// ===== Работа с localStorage =====

// Загружаем задачи. Если данных нет или localStorage недоступен,
// берём стартовые задачи
function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultTasks;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return defaultTasks;
    }
    // Проверяем каждую задачу и подставляем категорию по умолчанию
    return parsed
      .filter(task => task && typeof task.text === "string")
      .map(task => ({
        id: task.id,
        text: task.text,
        category: CATEGORIES.includes(task.category) ? task.category : "Другое",
        completed: Boolean(task.completed)
      }));
  } catch (error) {
    return defaultTasks;
  }
}

// Сохраняем массив задач в браузере
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    // Если сохранение запрещено, приложение продолжит работать без него
  }
}

// ===== Данные приложения =====
let tasks = loadTasks();
let currentFilter = "all"; // all, active или completed

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
  if (tasks.length === 0) {
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

// ===== Действия с задачами =====

// Показываем и убираем сообщение об ошибке
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  taskInput.classList.add("invalid");
}

function clearError() {
  errorMessage.hidden = true;
  taskInput.classList.remove("invalid");
}

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

  clearError();

  tasks.push({
    id: Date.now(),
    text: text,
    category: categorySelect.value,
    completed: false
  });

  saveTasks();
  renderTasks();

  taskInput.value = "";
  taskInput.focus();
}

// Переключение выполнения задачи
function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

// Удаление одной задачи
function deleteTask(id) {
  tasks = tasks.filter(item => item.id !== id);
  saveTasks();
  renderTasks();
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
  tasks = [];
  saveTasks();
  hideConfirm();
  renderTasks();
});

// ===== Первоначальное отображение =====
renderTasks();
