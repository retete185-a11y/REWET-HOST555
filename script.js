"use strict";

/*
=========================================================
REWET HOST — FRONTEND CORE
=========================================================
API:
https://rewet-host-api.onrender.com

Поддерживается:
- Регистрация
- Вход
- Сессия
- Профиль
- Выход
- Google OAuth через /api/auth/google
- Красивые сообщения
- Защита от двойной отправки
- Таймаут запросов
- Безопасный вывод данных
=========================================================
*/

const API_URL = "https://rewet-host-api.onrender.com";

let currentUser = null;
let requestController = null;


// =====================================================
// ОСНОВНЫЕ УТИЛИТЫ
// =====================================================

function $(id) {
    return document.getElementById(id);
}


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


function getErrorMessage(data, fallback) {
    if (!data) {
        return fallback;
    }

    let message =
        data.detail ||
        data.message ||
        data.error ||
        fallback;

    if (Array.isArray(message)) {
        message = message
            .map(item => {
                if (typeof item === "string") {
                    return item;
                }

                return item?.msg || "Ошибка";
            })
            .join("\n");
    }

    if (typeof message !== "string") {
        return fallback;
    }

    return message;
}


async function parseResponse(response) {
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


async function apiRequest(
    endpoint,
    options = {},
    timeout = 15000
) {
    if (requestController) {
        requestController.abort();
    }

    requestController = new AbortController();

    const timer = setTimeout(() => {
        requestController.abort();
    }, timeout);

    try {
        const response = await fetch(
            `${API_URL}${endpoint}`,
            {
                ...options,
                credentials: "include",
                signal: requestController.signal,
                headers: {
                    "Accept": "application/json",
                    ...(options.headers || {})
                }
            }
        );

        const data = await parseResponse(response);

        return {
            response,
            data
        };

    } finally {
        clearTimeout(timer);
        requestController = null;
    }
}


// =====================================================
// СООБЩЕНИЯ
// =====================================================

function showMessage(message, type = "error") {

    document
        .querySelectorAll(".auth-message")
        .forEach(element => element.remove());

    const box = document.querySelector(
        "#authContent .auth-box"
    ) || document.querySelector(".auth-box");

    if (!box) {
        alert(message);
        return;
    }

    const element = document.createElement("div");

    element.className =
        `auth-message auth-message-${type}`;

    element.textContent = message;

    const form = box.querySelector("form");

    if (form) {
        box.insertBefore(element, form);
    } else {
        box.prepend(element);
    }

    setTimeout(() => {
        if (element.isConnected) {
            element.remove();
        }
    }, 7000);
}


// =====================================================
// МОДАЛЬНОЕ ОКНО
// =====================================================

function showAuthModal() {

    const modal = $("authModal");

    if (!modal) {
        console.error(
            "REWET HOST: #authModal не найден."
        );

        return false;
    }

    modal.classList.add("active");
    modal.classList.add("open");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("auth-open");

    return true;
}


function closeAuth() {

    const modal = $("authModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.classList.remove("open");

    modal.style.display = "";
    modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("auth-open");

    document
        .querySelectorAll(".auth-message")
        .forEach(element => element.remove());
}


// =====================================================
// HTML — ВХОД
// =====================================================

function renderLogin() {

    const content = $("authContent");

    if (!content) {
        return;
    }

    content.innerHTML = `

        <div class="auth-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
                aria-label="Закрыть"
            >
                ×
            </button>

            <div class="auth-icon">
                ⚡
            </div>

            <h2>Вход в REWET HOST</h2>

            <p class="auth-subtitle">
                Войдите в свою панель управления
            </p>

            <form id="loginForm">

                <label for="login">
                    E-mail или логин
                </label>

                <input
                    id="login"
                    type="text"
                    placeholder="Введите e-mail или логин"
                    autocomplete="username"
                    maxlength="120"
                    required
                >

                <label for="loginPassword">
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
                    id="googleLoginButton"
                >
                    <strong>G</strong>
                    &nbsp; Войти через Google
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

    const form = $("loginForm");

    if (form) {
        form.addEventListener(
            "submit",
            login
        );
    }

    const googleButton =
        $("googleLoginButton");

    if (googleButton) {
        googleButton.addEventListener(
            "click",
            googleLogin
        );
    }
}


// =====================================================
// ОТКРЫТЬ ВХОД
// =====================================================

function openLogin() {

    if (!showAuthModal()) {
        return;
    }

    renderLogin();
}


// =====================================================
// HTML — РЕГИСТРАЦИЯ
// =====================================================

function renderRegister() {

    const content = $("authContent");

    if (!content) {
        return;
    }

    content.innerHTML = `

        <div class="auth-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
                aria-label="Закрыть"
            >
                ×
            </button>

            <div class="auth-icon">
                ⚡
            </div>

            <h2>Создать аккаунт</h2>

            <p class="auth-subtitle">
                Добро пожаловать в REWET HOST
            </p>

            <form id="registerForm">

                <label for="username">
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

                <label for="email">
                    E-mail
                </label>

                <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                    maxlength="160"
                    required
                >

                <label for="registerPassword">
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

                <label for="passwordConfirm">
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
                    id="googleRegisterButton"
                >
                    <strong>G</strong>
                    &nbsp; Регистрация через Google
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

    const form = $("registerForm");

    if (form) {
        form.addEventListener(
            "submit",
            register
        );
    }

    const googleButton =
        $("googleRegisterButton");

    if (googleButton) {
        googleButton.addEventListener(
            "click",
            googleLogin
        );
    }
}


// =====================================================
// ОТКРЫТЬ РЕГИСТРАЦИЮ
// =====================================================

function openRegister() {

    if (!showAuthModal()) {
        return;
    }

    renderRegister();
}


// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

async function register(event) {

    event.preventDefault();

    const usernameElement = $("username");
    const emailElement = $("email");
    const passwordElement = $("registerPassword");
    const confirmElement = $("passwordConfirm");
    const termsElement = $("terms");
    const submitButton = $("registerSubmit");

    if (
        !usernameElement ||
        !emailElement ||
        !passwordElement ||
        !confirmElement
    ) {
        showMessage(
            "Ошибка формы регистрации."
        );

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


    // -----------------------------------------------
    // ПРОВЕРКИ
    // -----------------------------------------------

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {

        showMessage(
            "Логин может содержать только латинские буквы, цифры и _."
        );

        usernameElement.focus();

        return;
    }


    if (
        username.length < 3 ||
        username.length > 24
    ) {

        showMessage(
            "Имя пользователя должно быть от 3 до 24 символов."
        );

        usernameElement.focus();

        return;
    }


    if (!email.includes("@")) {

        showMessage(
            "Введите корректный e-mail."
        );

        emailElement.focus();

        return;
    }


    if (password.length < 6) {

        showMessage(
            "Пароль должен содержать минимум 6 символов."
        );

        passwordElement.focus();

        return;
    }


    if (password !== passwordConfirm) {

        showMessage(
            "Пароли не совпадают."
        );

        confirmElement.focus();

        return;
    }


    if (
        termsElement &&
        !termsElement.checked
    ) {

        showMessage(
            "Необходимо принять правила REWET HOST."
        );

        return;
    }


    // -----------------------------------------------
    // БЛОКИРОВКА
    // -----------------------------------------------

    if (submitButton) {

        submitButton.disabled = true;

        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent =
            "Создание аккаунта...";
    }


    try {

        const { response, data } =
            await apiRequest(
                "/api/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        password_confirm:
                            passwordConfirm
                    })
                },
                20000
            );


        if (!response.ok) {

            showMessage(
                getErrorMessage(
                    data,
                    "Не удалось создать аккаунт."
                )
            );

            return;
        }


        // -------------------------------------------
        // УСПЕШНАЯ РЕГИСТРАЦИЯ
        // -------------------------------------------

        currentUser =
            data.user || null;

        showMessage(
            "Аккаунт успешно создан!",
            "success"
        );


        setTimeout(() => {

            openLogin();

        }, 1200);


    } catch (error) {

        console.error(
            "REWET HOST REGISTER:",
            error
        );


        if (error.name === "AbortError") {

            showMessage(
                "Сервер слишком долго отвечает. Попробуйте ещё раз."
            );

        } else {

            showMessage(
                "Не удалось подключиться к REWET HOST API."
            );
        }


    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Создать аккаунт";
        }
    }
}


// =====================================================
// ВХОД
// =====================================================

async function login(event) {

    event.preventDefault();

    const loginElement = $("login");
    const passwordElement = $("loginPassword");
    const submitButton = $("loginSubmit");

    if (
        !loginElement ||
        !passwordElement
    ) {
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

        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent =
            "Выполняется вход...";
    }


    try {

        const { response, data } =
            await apiRequest(
                "/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        login: loginValue,
                        password
                    })
                },
                20000
            );


        if (!response.ok) {

            showMessage(
                getErrorMessage(
                    data,
                    "Неверный логин или пароль."
                )
            );

            return;
        }


        currentUser =
            data.user || null;


        closeAuth();

        updateAuthButtons();


    } catch (error) {

        console.error(
            "REWET HOST LOGIN:",
            error
        );


        if (error.name === "AbortError") {

            showMessage(
                "Сервер слишком долго отвечает."
            );

        } else {

            showMessage(
                "Не удалось подключиться к серверу REWET HOST."
            );
        }


    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Войти";
        }
    }
}


// =====================================================
// GOOGLE
// =====================================================

async function googleLogin() {

    /*
    Здесь используется Google Identity Services.

    Если Google SDK подключён в index.html,
    можно передать credential в API.

    Если SDK пока не подключён —
    показываем понятное сообщение вместо ошибки.
    */

    if (
        typeof google === "undefined" ||
        !google.accounts ||
        !google.accounts.id
    ) {

        showMessage(
            "Google пока не подключён на странице. Нужно добавить Google Identity Services.",
            "info"
        );

        return;
    }


    showMessage(
        "Google авторизация запускается...",
        "info"
    );


    try {

        google.accounts.id.prompt();

    } catch (error) {

        console.error(
            "GOOGLE ERROR:",
            error
        );

        showMessage(
            "Не удалось открыть Google авторизацию."
        );
    }
}


// =====================================================
// GOOGLE CALLBACK
// =====================================================

async function handleGoogleCredential(
    response
) {

    if (
        !response ||
        !response.credential
    ) {

        showMessage(
            "Google не вернул данные авторизации."
        );

        return;
    }


    try {

        const result =
            await apiRequest(
                "/api/auth/google",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        credential:
                            response.credential
                    })
                },
                20000
            );


        if (!result.response.ok) {

            showMessage(
                getErrorMessage(
                    result.data,
                    "Не удалось войти через Google."
                )
            );

            return;
        }


        currentUser =
            result.data.user || null;


        closeAuth();

        updateAuthButtons();


    } catch (error) {

        console.error(
            "GOOGLE LOGIN ERROR:",
            error
        );

        showMessage(
            "Ошибка подключения Google авторизации."
        );
    }
}


// =====================================================
// ИНИЦИАЛИЗАЦИЯ GOOGLE
// =====================================================

function initGoogle() {

    if (
        typeof google === "undefined" ||
        !google.accounts ||
        !google.accounts.id
    ) {
        return;
    }


    const clientId =
        window.REWET_GOOGLE_CLIENT_ID;


    if (!clientId) {

        console.log(
            "REWET HOST: Google Client ID не указан."
        );

        return;
    }


    google.accounts.id.initialize({

        client_id: clientId,

        callback:
            handleGoogleCredential,

        auto_select: false,

        cancel_on_tap_outside: true
    });
}


// =====================================================
// ПРОВЕРКА СЕССИИ
// =====================================================

async function checkSession() {

    try {

        const { response, data } =
            await apiRequest(
                "/api/me",
                {
                    method: "GET"
                },
                10000
            );


        if (!response.ok) {

            currentUser = null;

            updateAuthButtons();

            return;
        }


        currentUser =
            data.user || null;


        updateAuthButtons();


    } catch (error) {

        console.log(
            "REWET HOST: сессия отсутствует."
        );

        currentUser = null;

        updateAuthButtons();
    }
}


// =====================================================
// ШАПКА
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
                class="btn btn-ghost login-button"
                type="button"
                onclick="openLogin()"
            >
                Войти
            </button>

            <button
                class="btn btn-primary register-button"
                type="button"
                onclick="openRegister()"
            >
                Создать аккаунт
            </button>

        `;

        return;
    }


    const username =
        escapeHTML(
            currentUser.username ||
            "Пользователь"
        );


    container.innerHTML = `

        <button
            class="btn btn-ghost login-button"
            type="button"
            onclick="openProfile()"
        >
            👤 ${username}
        </button>

        <button
            class="btn btn-primary register-button"
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
        $("authContent");


    if (!content) {
        return;
    }


    if (!showAuthModal()) {
        return;
    }


    const username =
        escapeHTML(
            currentUser.username
        );

    const email =
        escapeHTML(
            currentUser.email
        );


    content.innerHTML = `

        <div class="auth-box profile-box">

            <button
                class="auth-close"
                type="button"
                onclick="closeAuth()"
                aria-label="Закрыть"
            >
                ×
            </button>

            <div class="auth-icon">
                👤
            </div>

            <h2>
                Ваш профиль
            </h2>

            <p class="auth-subtitle">
                REWET HOST
            </p>

            <div class="profile-info">

                <div class="profile-row">
                    <span>Логин</span>
                    <strong>
                        ${username}
                    </strong>
                </div>

                <div class="profile-row">
                    <span>E-mail</span>
                    <strong>
                        ${email}
                    </strong>
                </div>

            </div>

            <button
                type="button"
                class="auth-submit"
                onclick="openDashboard()"
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
// ПАНЕЛЬ
// =====================================================

function openDashboard() {

    closeAuth();

    /*
    Здесь позже подключим полноценную
    панель управления серверами REWET HOST.
    */

    const dashboard =
        document.getElementById(
            "dashboard"
        );

    if (dashboard) {

        dashboard.scrollIntoView({
            behavior: "smooth"
        });

        return;
    }

    console.log(
        "REWET HOST: dashboard ещё не подключён."
    );
}


// =====================================================
// ВЫХОД
// =====================================================

async function logout() {

    try {

        await apiRequest(
            "/api/logout",
            {
                method: "POST"
            },
            10000
        );

    } catch (error) {

        console.error(
            "REWET HOST LOGOUT:",
            error
        );
    }


    currentUser = null;

    updateAuthButtons();

    closeAuth();
}


// =====================================================
// КЛИК ПО ФОНУ
// =====================================================

document.addEventListener(
    "click",
    function(event) {

        const modal =
            $("authModal");


        if (!modal) {
            return;
        }


        const backdrop =
            modal.querySelector(
                ".modal-backdrop"
            );


        if (
            event.target === backdrop
        ) {
            closeAuth();
        }
    }
);


// =====================================================
// ESC
// =====================================================

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape"
        ) {

            const modal =
                $("authModal");

            if (
                modal &&
                modal.classList.contains("active")
            ) {
                closeAuth();
            }
        }
    }
);


// =====================================================
// ПЕРЕХОД ПО МЕНЮ
// =====================================================

document.addEventListener(
    "click",
    function(event) {

        const link =
            event.target.closest(
                'a[href^="#"]'
            );


        if (!link) {
            return;
        }


        const targetId =
            link.getAttribute("href");


        if (
            !targetId ||
            targetId === "#"
        ) {
            return;
        }


        const target =
            document.querySelector(
                targetId
            );


        if (!target) {
            return;
        }


        event.preventDefault();


        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


        document.body.classList.remove(
            "menu-open"
        );
    }
);


// =====================================================
// ЗАПУСК REWET HOST
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "⚡ REWET HOST запускается..."
        );


        updateAuthButtons();


        initGoogle();


        await checkSession();


        console.log(
            "⚡ REWET HOST готов."
        );
    }
);


// =====================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ
// =====================================================

window.openLogin = openLogin;
window.openRegister = openRegister;
window.openProfile = openProfile;
window.closeAuth = closeAuth;
window.logout = logout;
window.openDashboard = openDashboard;

window.handleGoogleCredential =
    handleGoogleCredential;
