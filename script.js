const authModal = document.getElementById("authModal");
const authContent = document.getElementById("authContent");

let authMode = "login";


function openLogin() {
    authMode = "login";
    renderAuth();
    authModal.classList.add("active");
}


function openRegister() {
    authMode = "register";
    renderAuth();
    authModal.classList.add("active");
}


function closeAuth() {
    authModal.classList.remove("active");
}


function renderAuth() {

    if (authMode === "login") {

        authContent.innerHTML = `

            <h2>С возвращением 👋</h2>

            <p>
                Войди в свой аккаунт REWET HOST
            </p>

            <form onsubmit="login(event)">

                <input
                    type="email"
                    id="loginEmail"
                    placeholder="Email"
                    required
                >

                <input
                    type="password"
                    id="loginPassword"
                    placeholder="Пароль"
                    required
                >

                <button
                    type="submit"
                    class="btn btn-primary modal-submit"
                >
                    Войти
                </button>

            </form>

            <div
                class="auth-switch"
                onclick="openRegister()"
            >
                Нет аккаунта?
                <b>Зарегистрироваться</b>
            </div>

        `;

    } else {

        authContent.innerHTML = `

            <h2>Создать аккаунт 🚀</h2>

            <p>
                Регистрация в REWET HOST
            </p>

            <form onsubmit="register(event)">

                <input
                    type="text"
                    id="registerName"
                    placeholder="Имя пользователя"
                    minlength="3"
                    maxlength="24"
                    required
                >

                <input
                    type="email"
                    id="registerEmail"
                    placeholder="Email"
                    required
                >

                <input
                    type="password"
                    id="registerPassword"
                    placeholder="Пароль"
                    minlength="6"
                    required
                >

                <input
                    type="password"
                    id="registerPassword2"
                    placeholder="Повторите пароль"
                    minlength="6"
                    required
                >

                <button
                    type="submit"
                    class="btn btn-primary modal-submit"
                >
                    Создать аккаунт
                </button>

            </form>

            <div
                class="auth-switch"
                onclick="openLogin()"
            >
                Уже есть аккаунт?
                <b>Войти</b>
            </div>

        `;
    }
}


function login(event) {

    event.preventDefault();

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    if (!email || !password) {
        alert("Заполни все поля.");
        return;
    }

    /*
        ВАЖНО:

        Сейчас backend ещё не подключён.

        Поэтому здесь пока только
        проверяем форму.

        Настоящая авторизация будет
        подключена после создания backend.
    */

    alert(
        "Форма входа готова. Backend подключим следующим этапом."
    );
}


function register(event) {

    event.preventDefault();

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const password2 =
        document.getElementById("registerPassword2").value;


    if (name.length < 3) {

        alert(
            "Имя пользователя должно содержать минимум 3 символа."
        );

        return;
    }


    if (password.length < 6) {

        alert(
            "Пароль должен содержать минимум 6 символов."
        );

        return;
    }


    if (password !== password2) {

        alert(
            "Пароли не совпадают."
        );

        return;
    }


    alert(
        "Форма регистрации готова. Backend подключим следующим этапом."
    );
}


/* ================= CLOSE ================= */

authModal.addEventListener(
    "click",
    function(event) {

        if (event.target === authModal) {
            closeAuth();
        }

    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {
            closeAuth();
        }

    }
);
