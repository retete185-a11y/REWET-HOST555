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

// ==============================
// HEALTH
// ==============================

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
        console.error("Health error:", error);

        res.status(500).json({
            status: "error",
            service: "REWET HOST",
            database: "disconnected"
        });
    }
});

// ==============================
// API INFO
// ==============================

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
        const {
            username,
            email,
            password
        } = req.body;

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
        console.error("Register error:", error);

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
        console.error("Login error:", error);

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Профиль
app.get(
    "/api/auth/me",
    authMiddleware,
    async (req, res) => {
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
            console.error("Profile error:", error);

            res.status(500).json({
                success: false,
                message: "Ошибка базы данных"
            });
        }
    }
);

// ==============================
// SERVERS
// ==============================

// Все серверы пользователя
app.get(
    "/api/servers",
    authMiddleware,
    async (req, res) => {
        try {
            const servers = await getUserServers(
                req.user.id
            );

            res.json({
                success: true,
                servers
            });
        } catch (error) {
            console.error("Get servers error:", error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Создание сервера
app.post(
    "/api/servers",
    authMiddleware,
    async (req, res) => {
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
            console.error("Create server error:", error);

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ==============================
// ACCESS KEY
// ==============================

// Использовать ключ
app.post(
    "/api/servers/access-key/use",
    authMiddleware,
    async (req, res) => {
        try {
            const {
                key
            } = req.body;

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
            console.error(
                "Use access key error:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Один сервер
app.get(
    "/api/servers/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const serverId =
                Number(req.params.id);

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
            console.error(
                "Get server error:",
                error
            );

            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Создать ключ
app.post(
    "/api/servers/:id/access-key",
    authMiddleware,
    async (req, res) => {
        try {
            const serverId =
                Number(req.params.id);

            if (
                !Number.isInteger(serverId) ||
                serverId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Некорректный ID сервера"
                });
            }

            const key = await createAccessKey(
                req.user.id,
                serverId
            );

            res.json({
                success: true,
                message: "Ключ доступа создан",
                key
            });
        } catch (error) {
            console.error(
                "Create access key error:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ==============================
// ADMIN
// ==============================

async function adminMiddleware(
    req,
    res,
    next
) {
    try {
        const result = await query(
            `SELECT is_admin
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (
            result.rows.length === 0 ||
            !result.rows[0].is_admin
        ) {
            return res.status(403).json({
                success: false,
                message: "Доступ запрещён"
            });
        }

        next();
    } catch (error) {
        console.error(
            "Admin middleware error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Ошибка проверки прав"
        });
    }
}

// Статистика
app.get(
    "/api/admin/stats",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const users = await query(
                `SELECT COUNT(*)::int AS count
                 FROM users`
            );

            const servers = await query(
                `SELECT COUNT(*)::int AS count
                 FROM servers`
            );

            const activeServers = await query(
                `SELECT COUNT(*)::int AS count
                 FROM servers
                 WHERE status = 'running'`
            );

            res.json({
                success: true,
                stats: {
                    users: users.rows[0].count,
                    servers: servers.rows[0].count,
                    activeServers:
                        activeServers.rows[0].count
                }
            });
        } catch (error) {
            console.error(
                "Admin stats error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Пользователи
app.get(
    "/api/admin/users",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
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
                 ORDER BY id DESC`
            );

            res.json({
                success: true,
                users: result.rows
            });
        } catch (error) {
            console.error(
                "Admin users error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Все серверы
app.get(
    "/api/admin/servers",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const result = await query(
                `SELECT
                    s.id,
                    s.name,
                    s.game,
                    s.status,
                    s.expires_at,
                    s.created_at,
                    u.username AS owner
                 FROM servers s
                 LEFT JOIN users u
                    ON u.id = s.owner_id
                 ORDER BY s.id DESC`
            );

            res.json({
                success: true,
                servers: result.rows
            });
        } catch (error) {
            console.error(
                "Admin servers error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ==============================
// PAGES
// ==============================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../public/index.html"
        )
    );
});

app.get("/register", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../public/register.html"
        )
    );
});

app.get("/login", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../public/login.html"
        )
    );
});

app.get("/dashboard", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../public/dashboard.html"
        )
    );
});

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../public/admin.html"
        )
    );
});

// ==============================
// 404
// ==============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Страница или API маршрут не найден"
    });
});

// ==============================
// ERROR HANDLER
// ==============================

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера"
    });
});

// ==============================
// START
// ==============================

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `REWET HOST запущен на порту ${PORT}`
    );
});
