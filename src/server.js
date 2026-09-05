const express = require("express");
const path = require("path");

const { testDatabase, query } = require("./db");

const {
    register,
    login,
    authMiddleware
} = require("./auth");

const {
    createServer,
    getUserServers,
    getServer,
    createAccessKey,
    useAccessKey
} = require("./servers");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

// Проверка сервера
app.get("/api/health", async (req, res) => {
    try {
        const database = await testDatabase();

        res.json({
            status: "ok",
            service: "REWET HOST",
            version: "1.0.0",
            database: database ? "connected" : "disconnected"
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            service: "REWET HOST",
            database: "disconnected"
        });
    }
});

// Информация об API
app.get("/api", (req, res) => {
    res.json({
        name: "REWET HOST",
        message: "Gaming Hosting API",
        status: "online"
    });
});

// ==============================
// AUTH
// ==============================

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
        const {
            login: usernameOrEmail,
            password
        } = req.body;

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
            `SELECT
                id,
                username,
                email,
                balance,
                is_admin,
                created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Пользователь не найден"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Ошибка базы данных"
        });
    }
});

// ==============================
// SERVERS
// ==============================

// Получение серверов пользователя
app.get("/api/servers", authMiddleware, async (req, res) => {
    try {
        const servers = await getUserServers(
            req.user.id
        );

        res.json({
            success: true,
            servers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Создание сервера
app.post("/api/servers", authMiddleware, async (req, res) => {
    try {
        const {
            name,
            game
        } = req.body;

        const server = await createServer(
            req.user.id,
            name,
            game
        );

        res.status(201).json({
            success: true,
            message: "Сервер создан",
            server
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// ==============================
// ACCESS KEY
// ==============================

// Использование ключа доступа
// Этот маршрут должен быть выше /api/servers/:id
app.post(
    "/api/servers/access-key/use",
    authMiddleware,
    async (req, res) => {
        try {
            const { key } = req.body;

            const result = await useAccessKey(
                req.user.id,
                key
            );

            res.json({
                success: true,
                message: "Сервер добавлен",
                ...result
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Получение одного сервера
app.get(
    "/api/servers/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const serverId = Number(
                req.params.id
            );

            if (
                !Number.isInteger(serverId) ||
                serverId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Некорректный ID сервера"
                });
            }

            const server = await getServer(
                req.user.id,
                serverId
            );

            res.json({
                success: true,
                server
            });

        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Создание ключа доступа
app.post(
    "/api/servers/:id/access-key",
    authMiddleware,
    async (req, res) => {
        try {
            const serverId = Number(
                req.params.id
            );

            if (
                !Number.isInteger(serverId) ||
                serverId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Некорректный ID
