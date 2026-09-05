const express = require("express");
const path = require("path");

const { testDatabase, query } = require("./db");
const {
    register,
    login,
    authMiddleware
} = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

// Проверка сервера
app.get("/api/health", async (req, res) => {
    const database = await testDatabase();

    res.json({
        status: "ok",
        service: "REWET HOST",
        version: "1.0.0",
        database: database ? "connected" : "disconnected"
    });
});

// Информация об API
app.get("/api", (req, res) => {
    res.json({
        name: "REWET HOST",
        message: "Gaming Hosting API",
        status: "online"
    });
});

// Регистрация
app.post("/api/auth/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const user = await register(
            username,
            email,
            password
        );

        res.status(201).json({
            success: true,
            message: "Аккаунт успешно создан",
            user
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Авторизация
app.post("/api/auth/login", async (req, res) => {
    try {
        const { login: usernameOrEmail, password } = req.body;

        const result = await login(
            usernameOrEmail,
            password
        );

        res.json({
            success: true,
            message: "Вход выполнен",
            ...result
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Получение своего профиля
app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, username, email, balance, is_admin, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Пользователь не найден"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка базы данных"
        });
    }
});

// Главная страница
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../public/index.html")
    );
});

// Запуск
app.listen(PORT, () => {
    console.log(`REWET HOST запущен на порту ${PORT}`);
});
