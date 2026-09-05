const express = require("express");
const path = require("path");

const { testDatabase } = require("./db");

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
    restartServer,
    getServerStatus
} = require("./serverManager");

const {
    listFiles,
    readFile,
    writeFile,
    createDirectory,
    createFile,
    deleteFile,
    renameFile
} = require("./fileManager");

const {
    getStats,
    getUsers,
    getServers
} = require("./admin");

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================
   MIDDLEWARE
========================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);


/* =========================
   AUTH
========================= */

const {
    authMiddleware
} = require("./auth");


async function auth(req, res, next) {

    try {

        await new Promise((resolve, reject) => {

            authMiddleware(
                req,
                res,
                (error) => {

                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }

                }
            );

        });

        if (!req.user || !req.user.id) {

            return res.status(401).json({
                success: false,
                message: "Недействительная авторизация"
            });

        }

        const user =
            await getUserById(req.user.id);

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
            "AUTH ERROR:",
            error
        );

        if (!res.headersSent) {

            return res.status(401).json({
                success: false,
                message: "Недействительный токен"
            });

        }

    }

}


/* =========================
   ADMIN
========================= */

function admin(req, res, next) {

    if (
        !req.user ||
        !req.user.is_admin
    ) {

        return res.status(403).json({
            success: false,
            message: "Доступ запрещён"
        });

    }

    next();

}


/* =========================
   HEALTH
========================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            const database =
                await testDatabase();

            res.json({
                status: "ok",
                service: "REWET HOST",
                version: "1.0.0",
                database:
                    database
                        ? "connected"
                        : "disconnected"
            });

        } catch (error) {

            res.status(500).json({
                status: "error",
                service: "REWET HOST",
                database: "disconnected"
            });

        }

    }
);


/* =========================
   AUTH API
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
                user
            });

        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                login,
                password
            } = req.body;

            const result =
                await loginUser(
                    login,
                    password
                );

            res.json({
                success: true,
                token: result.token,
                user: result.user
            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(401).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/auth/me",
    auth,
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

app.get(
    "/api/servers",
    auth,
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
                "GET SERVERS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers",
    auth,
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
                server
            });

        } catch (error) {

            console.error(
                "CREATE SERVER ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/servers/:id",
    auth,
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
                "GET SERVER ERROR:",
                error
            );

            res.status(404).json({
                success: false,
                message: error.message
            });

        }

    }
);


/* =========================
   ACCESS KEYS
========================= */

app.post(
    "/api/servers/:id/access-key",
    auth,
    async (req, res) => {

        try {

            const serverId =
                Number(req.params.id);

            const key =
                await createAccessKey(
                    req.user.id,
                    serverId
                );

            res.json({
                success: true,
                key
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/access-key/use",
    auth,
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


/* =========================
   SERVER CONTROL
========================= */

app.post(
    "/api/servers/:id/start",
    auth,
    async (req, res) => {

        try {

            const server =
                await startServer(
                    req.user.id,
                    Number(req.params.id)
                );

            res.json({
                success: true,
                server
            });

        } catch (error) {

            console.error(
                "START SERVER ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/stop",
    auth,
    async (req, res) => {

        try {

            const server =
                await stopServer(
                    req.user.id,
                    Number(req.params.id)
                );

            res.json({
                success: true,
                server
            });

        } catch (error) {

            console.error(
                "STOP SERVER ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/restart",
    auth,
    async (req, res) => {

        try {

            const server =
                await restartServer(
                    req.user.id,
                    Number(req.params.id)
                );

            res.json({
                success: true,
                server
            });

        } catch (error) {

            console.error(
                "RESTART SERVER ERROR:",
                error
            );

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/servers/:id/status",
    auth,
    async (req, res) => {

        try {

            const server =
                await getServerStatus(
                    Number(req.params.id)
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


/* =========================
   FILE MANAGER
========================= */

app.get(
    "/api/servers/:id/files",
    auth,
    async (req, res) => {

        try {

            const files =
                await listFiles(
                    req.user.id,
                    Number(req.params.id),
                    req.query.path || ""
                );

            res.json({
                success: true,
                files
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/servers/:id/file",
    auth,
    async (req, res) => {

        try {

            const file =
                await readFile(
                    req.user.id,
                    Number(req.params.id),
                    req.query.path
                );

            res.json({
                success: true,
                file
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/file",
    auth,
    async (req, res) => {

        try {

            const {
                path: filePath,
                content
            } = req.body;

            const file =
                await writeFile(
                    req.user.id,
                    Number(req.params.id),
                    filePath,
                    content
                );

            res.json({
                success: true,
                file
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/files/mkdir",
    auth,
    async (req, res) => {

        try {

            const {
                path: directoryPath
            } = req.body;

            await createDirectory(
                req.user.id,
                Number(req.params.id),
                directoryPath
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/files/touch",
    auth,
    async (req, res) => {

        try {

            const {
                path: filePath
            } = req.body;

            await createFile(
                req.user.id,
                Number(req.params.id),
                filePath
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.delete(
    "/api/servers/:id/file",
    auth,
    async (req, res) => {

        try {

            await deleteFile(
                req.user.id,
                Number(req.params.id),
                req.body.path ||
                req.query.path
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.post(
    "/api/servers/:id/files/rename",
    auth,
    async (req, res) => {

        try {

            const {
                oldPath,
                newPath
            } = req.body;

            await renameFile(
                req.user.id,
                Number(req.params.id),
                oldPath,
                newPath
            );

            res.json({
                success: true
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                message: error.message
            });

        }

    }
);


/* =========================
   ADMIN
========================= */

app.get(
    "/api/admin/stats",
    auth,
    admin,
    async (req, res) => {

        try {

            const stats =
                await getStats();

            res.json({
                success: true,
                stats
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/admin/users",
    auth,
    admin,
    async (req, res) => {

        try {

            const users =
                await getUsers();

            res.json({
                success: true,
                users
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);


app.get(
    "/api/admin/servers",
    auth,
    admin,
    async (req, res) => {

        try {

            const servers =
                await getServers();

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
    "/server",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "../public/server.html"
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
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "API маршрут не найден"
            });

        }

        res.status(404).send(
            "Страница не найдена"
        );

    }
);


/* =========================
   ERROR
========================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (!res.headersSent) {

            res.status(500).json({
                success: false,
                message:
                    "Внутренняя ошибка сервера"
            });

        }

    }
);


/* =========================
   START
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `REWET HOST запущен на порту ${PORT}`
        );

    }
);
