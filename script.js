const API_URL = "https://rewet-host-api.onrender.com";

let currentUser = null;


// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

function getElement(id) {
    return document.getElementById(id);
}


function showMessage(message, type = "error") {
    const old = document.querySelector(".auth-message");

    if (old) {
        old.remove();
    }

    const box = document.querySelector(".auth-box");

    if (!box) {
        alert(message);
        return;
    }

    const messageElement = document.createElement("div");

    messageElement.className =
        `auth-message auth-message-${type}`;

    messageElement.textContent = message;

    box.insertBefore(
        messageElement,
        box.querySelector("form")
    );
}


async function getResponseData(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            detail: text
        };
    }
}


// =====================================================
// ОТКРЫТЬ ОКНО
// =====================================================

function showAuthModal() {

    const modal = getElement("authModal");

    if (!modal) {
        alert("Ошибка: #authModal отсутствует в index.html");
        return false;
    }

    modal.classList.add("active");
    modal.classList.add("open");

    modal.style.display = "flex";

    return true;
}


// =====================================================
// ЗАКРЫТЬ ОКНО
// =====================================================

function closeAuth() {

    const modal = getElement("authModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.classList.remove("open");

    modal.style.display = "";
}


// =====================================================
// ВХОД
// =====================================================

function openLogin() {

    const content = getElement("authContent");

    if (!content) {
        alert("Ошибка: #authContent отсутствует в index.html");
        return;
    }

    showAuthModal();

    content.innerHTML = `

        <div class="auth-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
            >
                ×
            </button>

            <div class="auth-icon">
                ⚡
            </div>

            <h2>Вход в REWET HOST</h2>

            <p class="auth-subtitle">
                Войдите в панель управления
            </p>

            <form id="loginForm">

                <label>
                    E-mail или логин
                </label>

                <input
                    id="login"
                    type="text"
                    placeholder="Введите e-mail или логин"
                    autocomplete="username"
                    required
                >

                <label>
                    Пароль
                </label>

                <input
                    id="loginPassword"
                    type="password"
                    placeholder="Введите пароль"
                    autocomplete="current-password"
                    required
                >

                <button
                    id="loginSubmit"
                    type="submit"
                    class="auth-submit"
                >
                    Войти
                </button>

            </form>

            <div class="auth-divider">
                <span>или</span>
            </div>

            <div class="auth-socials">

                <button
                    type="button"
                    class="auth-social"
                    onclick="showMessage('Google OAuth будет подключён после настройки Google Cloud', 'info')"
                >
                    G&nbsp;&nbsp; Google
                </button>

                <button
                    type="button"
                    class="auth-social"
                    onclick="showMessage('VK ID будет подключён после настройки VK OAuth', 'info')"
                >
                    VK&nbsp;&nbsp; Войти через VK
                </button>

            </div>

            <p class="auth-switch">

                Нет аккаунта?

                <button
                    type="button"
                    onclick="openRegister()"
                >
                    Создать аккаунт
                </button>

            </p>

        </div>
    `;

    const form = getElement("loginForm");

    if (form) {
        form.addEventListener("submit", login);
    }
}


// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

function openRegister() {

    const content = getElement("authContent");

    if (!content) {
        alert("Ошибка: #authContent отсутствует в index.html");
        return;
    }

    showAuthModal();

    content.innerHTML = `

        <div class="auth-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
            >
                ×
            </button>

            <div class="auth-icon">
                ⚡
            </div>

            <h2>Создать аккаунт</h2>

            <p class="auth-subtitle">
                Регистрация в REWET HOST
            </p>

            <form id="registerForm">

                <label>
                    Имя пользователя
                </label>

                <input
                    id="username"
                    type="text"
                    placeholder="Например: rewet_user"
                    minlength="3"
                    maxlength="24"
                    autocomplete="username"
                    required
                >

                <small>
                    От 3 до 24 символов
                </small>

                <label>
                    E-mail
                </label>

                <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                >

                <label>
                    Пароль
                </label>

                <input
                    id="registerPassword"
                    type="password"
                    placeholder="Минимум 6 символов"
                    minlength="6"
                    autocomplete="new-password"
                    required
                >

                <label>
                    Повторите пароль
                </label>

                <input
                    id="passwordConfirm"
                    type="password"
                    placeholder="Повторите пароль"
                    minlength="6"
                    autocomplete="new-password"
                    required
                >

                <label class="auth-checkbox">

                    <input
                        id="terms"
                        type="checkbox"
                        required
                    >

                    <span>
                        Я принимаю правила использования REWET HOST
                    </span>

                </label>

                <button
                    id="registerSubmit"
                    type="submit"
                    class="auth-submit"
                >
                    Создать аккаунт
                </button>

            </form>

            <div class="auth-divider">
                <span>или</span>
            </div>

            <div class="auth-socials">

                <button
                    type="button"
                    class="auth-social"
                    onclick="showMessage('Google OAuth будет подключён после настройки Google Cloud', 'info')"
                >
                    G&nbsp;&nbsp; Регистрация через Google
                </button>

                <button
                    type="button"
                    class="auth-social"
                    onclick="showMessage('VK ID будет подключён после настройки VK OAuth', 'info')"
                >
                    VK&nbsp;&nbsp; Регистрация через VK
                </button>

            </div>

            <p class="auth-switch">

                Уже есть аккаунт?

                <button
                    type="button"
                    onclick="openLogin()"
                >
                    Войти
                </button>

            </p>

        </div>
    `;

    const form = getElement("registerForm");

    if (form) {
        form.addEventListener("submit", register);
    }
}


// =====================================================
// РЕГИСТРАЦИЯ — API
// =====================================================

async function register(event) {

    event.preventDefault();

    const usernameElement = getElement("username");
    const emailElement = getElement("email");
    const passwordElement = getElement("registerPassword");
    const confirmElement = getElement("passwordConfirm");
    const submitButton = getElement("registerSubmit");

    if (
        !usernameElement ||
        !emailElement ||
        !passwordElement ||
        !confirmElement
    ) {
        return;
    }

    const username =
        usernameElement.value.trim();

    const email =
        emailElement.value.trim();

    const password =
        passwordElement.value;

    const passwordConfirm =
        confirmElement.value;


    // Проверка имени

    if (username.length < 3) {

        showMessage(
            "Имя пользователя должно содержать минимум 3 символа."
        );

        return;
    }


    if (username.length > 24) {

        showMessage(
            "Имя пользователя не должно быть длиннее 24 символов."
        );

        return;
    }


    // Проверка пароля

    if (password.length < 6) {

        showMessage(
            "Пароль должен содержать минимум 6 символов."
        );

        return;
    }


    // Проверка паролей

    if (password !== passwordConfirm) {

        showMessage(
            "Пароли не совпадают."
        );

        return;
    }


    // Блокируем кнопку

    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Создание аккаунта...";
    }


    try {

        const response = await fetch(
            `${API_URL}/api/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    password_confirm: passwordConfirm
                })
            }
        );


        const data =
            await getResponseData(response);


        if (!response.ok) {

            let message =
                data.detail ||
                data.message ||
                "Не удалось создать аккаунт.";


            if (Array.isArray(message)) {

                message = message
                    .map(error => {

                        if (typeof error === "string") {
                            return error;
                        }

                        return error.msg || "Ошибка";
                    })
                    .join("\n");
            }


            showMessage(
                message
            );

            if (submitButton) {

                submitButton.disabled = false;

                submitButton.textContent =
                    "Создать аккаунт";
            }

            return;
        }


        showMessage(
            "Аккаунт создан! Сейчас откроется вход.",
            "success"
        );


        setTimeout(() => {

            openLogin();

        }, 1000);


    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );


        showMessage(
            "Не удалось подключиться к серверу. Проверь, запущен ли API REWET HOST."
        );


        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                "Создать аккаунт";
        }
    }
}


// =====================================================
// ВХОД — API
// =====================================================

async function login(event) {

    event.preventDefault();

    const loginElement =
        getElement("login");

    const passwordElement =
        getElement("loginPassword");

    const submitButton =
        getElement("loginSubmit");


    if (!loginElement || !passwordElement) {
        return;
    }


    const loginValue =
        loginElement.value.trim();

    const password =
        passwordElement.value;


    if (!loginValue || !password) {

        showMessage(
            "Заполните все поля."
        );

        return;
    }


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Выполняется вход...";
    }


    try {

        const response = await fetch(
            `${API_URL}/api/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    login: loginValue,
                    password: password
                })
            }
        );


        const data =
            await getResponseData(response);


        if (!response.ok) {

            showMessage(
                data.detail ||
                data.message ||
                "Неверный логин или пароль."
            );


            if (submitButton) {

                submitButton.disabled = false;

                submitButton.textContent =
                    "Войти";
            }

            return;
        }


        currentUser =
            data.user || null;


        closeAuth();

        updateAuthButtons();


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        showMessage(
            "Не удалось подключиться к серверу REWET HOST."
        );


        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                "Войти";
        }
    }
}


// =====================================================
// ПРОВЕРКА СЕССИИ
// =====================================================

async function checkSession() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/me`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        if (!response.ok) {

            currentUser = null;

            updateAuthButtons();

            return;
        }


        const data =
            await getResponseData(response);


        currentUser =
            data.user || null;


        updateAuthButtons();


    } catch (error) {

        console.log(
            "Сессия отсутствует."
        );

        currentUser = null;

        updateAuthButtons();
    }
}


// =====================================================
// КНОПКИ В ШАПКЕ
// =====================================================

function updateAuthButtons() {

    const container =
        document.querySelector(
            "[data-auth-buttons]"
        );


    if (!container) {
        return;
    }


    if (!currentUser) {

        container.innerHTML = `

            <button
                class="login-button"
                type="button"
                onclick="openLogin()"
            >
                Войти
            </button>

            <button
                class="register-button"
                type="button"
                onclick="openRegister()"
            >
                Создать аккаунт
            </button>

        `;

        return;
    }


    container.innerHTML = `

        <button
            class="login-button"
            type="button"
            onclick="openProfile()"
        >
            👤 ${escapeHTML(currentUser.username)}
        </button>

        <button
            class="register-button"
            type="button"
            onclick="logout()"
        >
            Выйти
        </button>

    `;
}


// =====================================================
// ПРОФИЛЬ
// =====================================================

function openProfile() {

    if (!currentUser) {

        openLogin();

        return;
    }


    const content =
        getElement("authContent");


    if (!content) {

        alert(
            `Пользователь: ${currentUser.username}\nE-mail: ${currentUser.email}`
        );

        return;
    }


    showAuthModal();


    content.innerHTML = `

        <div class="auth-box profile-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
            >
                ×
            </button>

            <div class="auth-icon">
                👤
            </div>

            <h2>
                Ваш профиль
            </h2>

            <div class="profile-info">

                <div class="profile-row">

                    <span>
                        Логин
                    </span>

                    <strong>
                        ${escapeHTML(currentUser.username)}
                    </strong>

                </div>

                <div class="profile-row">

                    <span>
                        E-mail
                    </span>

                    <strong>
                        ${escapeHTML(currentUser.email)}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="auth-submit"
                onclick="closeAuth()"
            >
                Открыть панель
            </button>

            <button
                type="button"
                class="profile-logout"
                onclick="logout()"
            >
                Выйти из аккаунта
            </button>

        </div>
    `;
}


// =====================================================
// ВЫХОД
// =====================================================

async function logout() {

    try {

        await fetch(
            `${API_URL}/api/logout`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );
    }


    currentUser = null;

    updateAuthButtons();

    closeAuth();
}


// =====================================================
// ЭКРАНИРОВАНИЕ HTML
// =====================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =====================================================
// ЗАКРЫТИЕ ПО КЛИКУ ВНЕ ОКНА
// =====================================================

document.addEventListener(
    "click",
    function(event) {

        const modal =
            getElement("authModal");

        if (!modal) {
            return;
        }

        if (
            event.target === modal
        ) {
            closeAuth();
        }
    }
);


// =====================================================
// ESC — ЗАКРЫТЬ
// =====================================================

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {

            closeAuth();
        }
    }
);


// =====================================================
// ЗАПУСК
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        updateAuthButtons();

        checkSession();

    }
);
