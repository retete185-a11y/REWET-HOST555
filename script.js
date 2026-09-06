const API_URL = "https://rewet-host-api.onrender.com";


// =====================================================
// AUTH MODAL
// =====================================================

const authModal = document.getElementById("authModal");
const authContent = document.getElementById("authContent");


// =====================================================
// OPEN LOGIN
// =====================================================

function openLogin() {
    if (!authModal || !authContent) return;

    authModal.classList.add("active");

    authContent.innerHTML = `
        <div class="auth-box">
            <button class="auth-close" onclick="closeAuth()">×</button>

            <h2>Вход</h2>
            <p class="auth-subtitle">
                Войдите в свой аккаунт REWET HOST
            </p>

            <form onsubmit="login(event)">

                <input
                    id="login"
                    type="text"
                    placeholder="Логин или почта"
                    autocomplete="username"
                    required
                >

                <input
                    id="password"
                    type="password"
                    placeholder="Пароль"
                    autocomplete="current-password"
                    required
                >

                <button type="submit" class="auth-submit">
                    Войти
                </button>

            </form>

            <p class="auth-switch">
                Нет аккаунта?
                <button onclick="openRegister()">
                    Регистрация
                </button>
            </p>
        </div>
    `;
}


// =====================================================
// OPEN REGISTER
// =====================================================

function openRegister() {
    if (!authModal || !authContent) return;

    authModal.classList.add("active");

    authContent.innerHTML = `
        <div class="auth-box">
            <button class="auth-close" onclick="closeAuth()">×</button>

            <h2>Регистрация</h2>
            <p class="auth-subtitle">
                Создайте аккаунт REWET HOST
            </p>

            <form onsubmit="register(event)">

                <input
                    id="username"
                    type="text"
                    placeholder="Имя пользователя"
                    autocomplete="username"
                    minlength="3"
                    maxlength="24"
                    required
                >

                <input
                    id="email"
                    type="email"
                    placeholder="Почта"
                    autocomplete="email"
                    required
                >

                <input
                    id="password"
                    type="password"
                    placeholder="Пароль"
                    autocomplete="new-password"
                    minlength="6"
                    required
                >

                <button type="submit" class="auth-submit">
                    Создать аккаунт
                </button>

            </form>

            <p class="auth-switch">
                Уже есть аккаунт?
                <button onclick="openLogin()">
                    Войти
                </button>
            </p>
        </div>
    `;
}


// =====================================================
// CLOSE AUTH
// =====================================================

function closeAuth() {
    if (!authModal) return;

    authModal.classList.remove("active");
}


// =====================================================
// REGISTER
// =====================================================

async function register(event) {

    event.preventDefault();

    const username =
        document.getElementById("username").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;


    try {

        const response = await fetch(
            `${API_URL}/api/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.detail || "Ошибка регистрации"
            );
        }


        alert(
            "✅ Аккаунт успешно создан!"
        );


        // После регистрации открываем вход
        openLogin();

    } catch (error) {

        alert(
            "❌ " + error.message
        );
    }
}


// =====================================================
// LOGIN
// =====================================================

async function login(event) {

    event.preventDefault();

    const loginValue =
        document.getElementById("login").value.trim();

    const password =
        document.getElementById("password").value;


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
                    password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.detail || "Ошибка входа"
            );
        }


        alert(
            `✅ Добро пожаловать, ${data.user.username}!`
        );


        closeAuth();

        updateAuthUI(data.user);

    } catch (error) {

        alert(
            "❌ " + error.message
        );
    }
}


// =====================================================
// CHECK SESSION
// =====================================================

async function checkSession() {

    try {

        const response = await fetch(
            `${API_URL}/api/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );


        if (!response.ok) {
            return;
        }


        const data = await response.json();

        updateAuthUI(data.user);

    } catch (error) {

        console.log(
            "Сессия не найдена"
        );
    }
}


// =====================================================
// UPDATE AUTH UI
// =====================================================

function updateAuthUI(user) {

    if (!user) return;


    const buttons =
        document.querySelectorAll(
            "[data-auth-buttons]"
        );


    buttons.forEach(container => {

        container.innerHTML = `
            <button onclick="openProfile()">
                👤 ${user.username}
            </button>

            <button onclick="logout()">
                Выйти
            </button>
        `;

    });
}


// =====================================================
// PROFILE
// =====================================================

function openProfile() {

    alert(
        "👤 Профиль ${user?.username || ""}"
    );
}


// =====================================================
// LOGOUT
// =====================================================

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

        console.log(error);
    }


    location.reload();
}


// =====================================================
// START
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkSession();

    }
);
