const express = require("express");
const path = require("path");

const {
    testDatabase
} = require("./db");

const {
    registerUser,
    loginUser,
    getUserById
} = require("./auth");

const {
    createServer,
    getUserServers,
    getServer,
    createAccessKey,
    useAccessKey
} = require("./servers");

const {
    startServer,
    stopServer,
    restartServer
} = require("./serverManager");

const {
    getAdminStats,
    getAllUsers,
    getAllServers
} = require("./admin");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(
    path.join(__dirname, "../public")
));

/* =========================
   AUTH MIDDLEWARE
========================= */

async function authMiddleware(req, res, next) {
    try {
        const token =
            req.headers.authorization?.replace(
                "Bearer ",
                ""
            );

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Необходима авторизация"
            });
        }

        const userId = Number(token);

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Недействительная авторизация"
            });
        }

        const user =
            await getUserById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Пользователь не найден"
            });
        }

        req.user = user;

        next();

    } catch (error) {
        console.error(
            "Auth error:",
            error
        );

        res.status(401).json({
            success: false,
            message: "Ошибка авторизации"
        });
    }
}

/* =========================
   ADMIN MIDDLEWARE
========================= */

async function adminMiddleware(
    req,
    res,
    next
) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Необходима авторизация"
            });
        }

        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                message: "Недостаточно прав"
            });
        }

        next();

    } catch (error) {
        console.error(
            "Admin error:",
            error
        );

        res.status(403).json({
            success: false,
            message: "Доступ запрещён"
        });
    }
}

/* =========================
   HEALTH
========================= */

app.get(
    "/api/health",
    async (req, res) => {
        const database =
            await testDatabase();

        res.json({
            success: true,
            service: "REWET HOST",
            database:
                database
                    ? "connected"
                    : "disconnected",
            time: new Date().toISOString()
        });
    }
);

/* =========================
   AUTH
========================= */

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const {
                username,
                email,
                password
            } = req.body;

            const user =
                await registerUser(
                    username,
                    email,
                    password
                );

            res.json({
                success: true,
                message:
                    "Регистрация успешна",
                user
            });

        } catch (error) {
            console.error(
                "Register error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const {
                email,
                password
            } = req.body;

            const user =
                await loginUser(
                    email,
                    password
                );

            /*
             * Пока используем ID
             * пользователя как простой
             * токен.
             *
             * Позже заменим на JWT.
             */

            res.json({
                success: true,
                message:
                    "Авторизация успешна",
                token:
                    String(user.id),
                user
            });

        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            res.status(401).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

app.get(
    "/api/auth/me",
    authMiddleware,
    async (req, res) => {
        res.json({
            success: true,
            user: req.user
        });
    }
);

/* =========================
   SERVERS
========================= */

/*
 * Получить мои серверы
 */

app.get(
    "/api/servers",
    authMiddleware,
    async (req, res) => {
        try {
            const servers =
                await getUserServers(
                    req.user.id
                );

            res.json({
                success: true,
                servers
            });

        } catch (error) {
            console.error(
                "Get servers error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Не удалось получить серверы"
            });
        }
    }
);

/*
 * Создать сервер
 */

app.post(
    "/api/servers",
    authMiddleware,
    async (req, res) => {
        try {
            const {
                name,
                game
            } = req.body;

            const server =
                await createServer(
                    req.user.id,
                    name,
                    game
                );

            res.json({
                success: true,
                message:
                    "Сервер создан",
                server
            });

        } catch (error) {
            console.error(
                "Create server error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/*
 * Получить один сервер
 */

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
                    message:
                        "Некорректный ID сервера"
                });
            }

            const server =
                await getServer(
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
                message:
                    error.message
            });
        }
    }
);

/* =========================
   ACCESS KEYS
========================= */

/*
 * Создать ключ доступа
 */

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
                    message:
                        "Некорректный ID сервера"
                });
            }

            const key =
                await createAccessKey(
                    req.user.id,
                    serverId
                );

            res.json({
                success: true,
                message:
                    "Ключ создан",
                key
            });

        } catch (error) {
            console.error(
                "Create access key error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/*
 * Использовать ключ
 */

app.post(
    "/api/servers/access-key/use",
    authMiddleware,
    async (req, res) => {
        try {
            const {
                key
            } = req.body;

            const result =
                await useAccessKey(
                    req.user.id,
                    key
                );

            res.json({
                success: true,
                message:
                    "Сервер добавлен",
                result
            });

        } catch (error) {
            console.error(
                "Use access key error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/* =========================
   SERVER CONTROL
========================= */

/*
 * START
 */

app.post(
    "/api/servers/:id/start",
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
                    message:
                        "Некорректный ID сервера"
                });
            }

            const server =
                await startServer(
                    req.user.id,
                    serverId
                );

            res.json({
                success: true,
                message:
                    "Сервер запускается",
                server
            });

        } catch (error) {
            console.error(
                "Start server error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/*
 * STOP
 */

app.post(
    "/api/servers/:id/stop",
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
                    message:
                        "Некорректный ID сервера"
                });
            }

            const server =
                await stopServer(
                    req.user.id,
                    serverId
                );

            res.json({
                success: true,
                message:
                    "Сервер останавливается",
                server
            });

        } catch (error) {
            console.error(
                "Stop server error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/*
 * RESTART
 */

app.post(
    "/api/servers/:id/restart",
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
                    message:
                        "Некорректный ID сервера"
                });
            }

            const server =
                await restartServer(
                    req.user.id,
                    serverId
                );

            res.json({
                success: true,
                message:
                    "Сервер перезапускается",
                server
            });

        } catch (error) {
            console.error(
                "Restart server error:",
                error
            );

            res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/* =========================
   ADMIN
========================= */

app.get(
    "/api/admin/stats",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const stats =
                await getAdminStats();

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error(
                "Admin stats error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

app.get(
    "/api/admin/users",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const users =
                await getAllUsers();

            res.json({
                success: true,
                users
            });

        } catch (error) {
            console.error(
                "Admin users error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

app.get(
    "/api/admin/servers",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const servers =
                await getAllServers();

            res.json({
                success: true,
                servers
            });

        } catch (error) {
            console.error(
                "Admin servers error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

/* =========================
   PAGES
========================= */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/index.html"
            )
        );
    }
);

app.get(
    "/register",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/register.html"
            )
        );
    }
);

app.get(
    "/login",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/login.html"
            )
        );
    }
);

app.get(
    "/dashboard",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/dashboard.html"
            )
        );
    }
);

app.get(
    "/admin",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/admin.html"
            )
        );
    }
);

/* =========================
   404
========================= */

app.use(
    (req, res) => {
        if (
            req.originalUrl.startsWith("/api/")
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "API маршрут не найден"
            });
        }

        res.status(404).send(
            "REWET HOST — Страница не найдена"
        );
    }
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "Server error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Внутренняя ошибка сервера"
        });
    }
);

/* =========================
   START
========================= */

async function start() {
    console.log(
        "Запуск REWET HOST..."
    );

    await testDatabase();

    app.listen(
        PORT,
        "0.0.0.0",
        () => {
            console.log(
                `REWET HOST запущен на порту ${PORT}`
            );
        }
    );
}

start();
