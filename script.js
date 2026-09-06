const API_URL = "https://rewet-host-api.onrender.com";

let currentUser = null;


// ===============================
// OPEN LOGIN
// ===============================

function openLogin() {

    const modal = document.getElementById("authModal");
    const content = document.getElementById("authContent");

    if (!modal || !content) {
        alert("Ошибка: окно авторизации не найдено");
        return;
    }

    modal.classList.add("active");

    content.innerHTML = `
        <div class="auth-box">

            <button class="auth-close" onclick="closeAuth()">×</button>

            <h2>Вход</h2>

            <p class="auth-subtitle">
                Войдите в REWET HOST
            </p>

            <form id="loginForm">

                <input
                    id="login"
                    type="text"
                    placeholder="E-mail или логин"
                    required
                >

                <input
                    id="loginPassword"
                    type="password"
                    placeholder="Пароль"
                    required
                >

                <button
                    type="submit"
                    class="auth-submit"
                >
                    Войти
                </button>

            </form>

            <p class="auth-switch">
                Нет аккаунта?
                <button type="button" onclick="openRegister()">
                    Создать аккаунт
                </button>
            </p>

        </div>
    `;

    document
        .getElementById("loginForm")
        .addEventListener("submit", login);
}


// ===============================
// OPEN REGISTER
// ===============================

function openRegister() {

    const modal = document.getElementById("authModal");
    const content = document.getElementById("authContent");

    if (!modal || !content) {
        alert("Ошибка: окно регистрации не найдено");
        return;
    }

    modal.classList.add("active");

    content.innerHTML = `
        <div class="auth-box">

            <button class="auth-close" onclick="closeAuth()">×</button>

            <h2>Создать аккаунт</h2>

            <p class="auth-subtitle">
                Регистрация в REWET HOST
            </p>

            <form id="registerForm">

                <input
                    id="username"
                    type="text"
                    placeholder="Имя пользователя"
                    minlength="3"
                    maxlength="24"
                    required
                >

                <input
                    id="email"
                    type="email"
                    placeholder="E-mail"
                    required
                >

                <input
                    id="registerPassword"
                    type="password"
                    placeholder="Пароль"
                    minlength="6"
                    required
                >

                <input
                    id="passwordConfirm"
                    type="password"
                    placeholder="Повторите пароль"
                    minlength="6"
                    required
                >

                <button
                    type="submit"
                    class="auth-submit"
                >
                    Создать аккаунт
                </button>

            </form>

            <p class="auth-switch">
                Уже есть аккаунт?
                <button type="button" onclick="openLogin()">
                    Войти
                </button>
            </p>

        </div>
    `;

    document
        .getElementById("registerForm")
        .addEventListener("submit", register);
}


// ===============================
// CLOSE
// ===============================

function closeAuth() {

    const modal = document.getElementById("authModal");

    if (modal) {
        modal.classList.remove("active");
    }
}


// ===============================
// REGISTER
// ===============================

async function register(event) {

    event.preventDefault();

    const username =
        document.getElementById("username").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const passwordConfirm =
        document.getElementById("passwordConfirm").value;


    if (password !== passwordConfirm) {

        alert("❌ Пароли не совпадают");

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    password_confirm: passwordConfirm
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            alert(
                "❌ " + (data.detail || "Ошибка регистрации")
            );

            return;
        }


        alert("✅ Аккаунт успешно создан!");

        openLogin();


    } catch (error) {

        console.error(error);

        alert(
            "❌ Не удалось подключиться к серверу REWET HOST"
        );
    }
}


// ===============================
// LOGIN
// ===============================

async function login(event) {

    event.preventDefault();


    const loginValue =
        document.getElementById("login").value.trim();

    const password =
        document.getElementById("loginPassword").value;


    try {

        const response = await fetch(
            `${API_URL}/api/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    login: loginValue,
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            alert(
                "❌ " + (data.detail || "Ошибка входа")
            );

            return;
        }


        currentUser = data.user;

        alert(
            `✅ Добро пожаловать, ${data.user.username}!`
        );

        closeAuth();

        updateAuthButtons();

    } catch (error) {

        console.error(error);

        alert(
            "❌ Не удалось подключиться к серверу"
        );
    }
}


// ===============================
// CHECK SESSION
// ===============================

async function checkSession() {

    try {

        const response = await fetch(
            `${API_URL}/api/me`,
            {
                credentials: "include"
            }
        );


        if (!response.ok) {
            return;
        }


        const data = await response.json();

        currentUser = data.user;

        updateAuthButtons();

    } catch (error) {

        console.log(
            "Пользователь не авторизован"
        );
    }
}


// ===============================
// AUTH BUTTONS
// ===============================

function updateAuthButtons() {

    const container =
        document.querySelector("[data-auth-buttons]");


    if (!container || !currentUser) {
        return;
    }


    container.innerHTML = `

        <button
            class="login-button"
            onclick="openProfile()"
        >
            👤 ${currentUser.username}
        </button>

        <button
            class="register-button"
            onclick="logout()"
        >
            Выйти
        </button>

    `;
}


// ===============================
// PROFILE
// ===============================

function openProfile() {

    if (!currentUser) {
        openLogin();
        return;
    }

    alert(
        `👤 ${currentUser.username}\n📧 ${currentUser.email}`
    );
}


// ===============================
// LOGOUT
// ===============================

async function logout() {

    try {

        await fetch(
            `${API_URL}/api/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(error);
    }


    currentUser = null;

    location.reload();
}


// ===============================
// START
// ===============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkSession();

    }
);
