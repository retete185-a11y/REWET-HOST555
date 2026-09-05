const fs = require("fs");
const path = require("path");
const { query } = require("./db");

const SERVERS_ROOT =
    process.env.SERVERS_ROOT ||
    path.join(__dirname, "../server-data");

/*
 * Создаём основную папку серверов
 */
if (!fs.existsSync(SERVERS_ROOT)) {
    fs.mkdirSync(SERVERS_ROOT, {
        recursive: true
    });
}

/*
 * Проверка доступа пользователя к серверу
 */
async function checkServerAccess(
    userId,
    serverId
) {
    const result = await query(
        `
        SELECT
            s.id,
            s.owner_id,
            s.name,
            s.game,
            CASE
                WHEN s.owner_id = $1
                THEN 'owner'
                ELSE sm.role
            END AS role
        FROM servers s
        LEFT JOIN server_members sm
            ON sm.server_id = s.id
            AND sm.user_id = $1
        WHERE s.id = $2
          AND (
              s.owner_id = $1
              OR sm.user_id = $1
          )
        `,
        [userId, serverId]
    );

    if (result.rows.length === 0) {
        throw new Error(
            "Нет доступа к серверу"
        );
    }

    return result.rows[0];
}

/*
 * Папка конкретного сервера
 */
function getServerPath(serverId) {
    return path.join(
        SERVERS_ROOT,
        String(serverId)
    );
}

/*
 * Безопасный путь внутри сервера
 */
function getSafePath(
    serverId,
    requestedPath = ""
) {
    const serverPath =
        path.resolve(
            getServerPath(serverId)
        );

    const cleanPath =
        String(requestedPath || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

    const targetPath =
        path.resolve(
            serverPath,
            cleanPath
        );

    if (
        targetPath !== serverPath &&
        !targetPath.startsWith(
            serverPath + path.sep
        )
    ) {
        throw new Error(
            "Недопустимый путь"
        );
    }

    return targetPath;
}

/*
 * Создание папки сервера
 */
async function ensureServerDirectory(
    userId,
    serverId
) {
    await checkServerAccess(
        userId,
        serverId
    );

    const serverPath =
        getServerPath(serverId);

    if (!fs.existsSync(serverPath)) {
        fs.mkdirSync(serverPath, {
            recursive: true
        });
    }

    return serverPath;
}

/*
 * Список файлов
 */
async function listFiles(
    userId,
    serverId,
    requestedPath = ""
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    const currentPath =
        getSafePath(
            serverId,
            requestedPath
        );

    if (!fs.existsSync(currentPath)) {
        throw new Error(
            "Папка не найдена"
        );
    }

    const stat =
        fs.statSync(currentPath);

    if (!stat.isDirectory()) {
        throw new Error(
            "Указанный путь не является папкой"
        );
    }

    const entries =
        fs.readdirSync(
            currentPath,
            {
                withFileTypes: true
            }
        );

    return entries
        .map((entry) => {
            const fullPath =
                path.join(
                    currentPath,
                    entry.name
                );

            let size = 0;

            if (entry.isFile()) {
                try {
                    size =
                        fs.statSync(
                            fullPath
                        ).size;
                } catch {}
            }

            return {
                name: entry.name,
                type: entry.isDirectory()
                    ? "directory"
                    : "file",
                size,
                path: requestedPath
                    ? `${requestedPath}/${entry.name}`
                    : entry.name
            };
        })
        .sort((a, b) => {
            if (
                a.type !== b.type
            ) {
                return a.type === "directory"
                    ? -1
                    : 1;
            }

            return a.name.localeCompare(
                b.name
            );
        });
}

/*
 * Читать файл
 */
async function readFile(
    userId,
    serverId,
    requestedPath
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!requestedPath) {
        throw new Error(
            "Не указан файл"
        );
    }

    const filePath =
        getSafePath(
            serverId,
            requestedPath
        );

    if (!fs.existsSync(filePath)) {
        throw new Error(
            "Файл не найден"
        );
    }

    const stat =
        fs.statSync(filePath);

    if (!stat.isFile()) {
        throw new Error(
            "Это не файл"
        );
    }

    /*
     * Ограничиваем размер чтения,
     * чтобы нельзя было загрузить
     * огромный файл в память.
     */
    const MAX_SIZE =
        2 * 1024 * 1024;

    if (stat.size > MAX_SIZE) {
        throw new Error(
            "Файл слишком большой для редактора"
        );
    }

    return fs.readFileSync(
        filePath,
        "utf8"
    );
}

/*
 * Записать файл
 */
async function writeFile(
    userId,
    serverId,
    requestedPath,
    content
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!requestedPath) {
        throw new Error(
            "Не указан файл"
        );
    }

    const filePath =
        getSafePath(
            serverId,
            requestedPath
        );

    const parentDirectory =
        path.dirname(filePath);

    if (!fs.existsSync(parentDirectory)) {
        fs.mkdirSync(
            parentDirectory,
            {
                recursive: true
            }
        );
    }

    if (
        typeof content !== "string"
    ) {
        throw new Error(
            "Некорректное содержимое файла"
        );
    }

    const MAX_WRITE_SIZE =
        5 * 1024 * 1024;

    if (
        Buffer.byteLength(
            content,
            "utf8"
        ) > MAX_WRITE_SIZE
    ) {
        throw new Error(
            "Файл слишком большой"
        );
    }

    fs.writeFileSync(
        filePath,
        content,
        "utf8"
    );

    return true;
}

/*
 * Создать папку
 */
async function createDirectory(
    userId,
    serverId,
    requestedPath
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!requestedPath) {
        throw new Error(
            "Не указано имя папки"
        );
    }

    const directoryPath =
        getSafePath(
            serverId,
            requestedPath
        );

    if (
        fs.existsSync(directoryPath)
    ) {
        throw new Error(
            "Такая папка уже существует"
        );
    }

    fs.mkdirSync(
        directoryPath,
        {
            recursive: true
        }
    );

    return true;
}

/*
 * Создать файл
 */
async function createFile(
    userId,
    serverId,
    requestedPath
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!requestedPath) {
        throw new Error(
            "Не указано имя файла"
        );
    }

    const filePath =
        getSafePath(
            serverId,
            requestedPath
        );

    if (
        fs.existsSync(filePath)
    ) {
        throw new Error(
            "Такой файл уже существует"
        );
    }

    const parentDirectory =
        path.dirname(filePath);

    if (
        !fs.existsSync(
            parentDirectory
        )
    ) {
        fs.mkdirSync(
            parentDirectory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(
        filePath,
        "",
        "utf8"
    );

    return true;
}

/*
 * Удалить файл или папку
 */
async function deleteFile(
    userId,
    serverId,
    requestedPath
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!requestedPath) {
        throw new Error(
            "Нельзя удалить корень сервера"
        );
    }

    const targetPath =
        getSafePath(
            serverId,
            requestedPath
        );

    if (
        !fs.existsSync(targetPath)
    ) {
        throw new Error(
            "Файл или папка не найдены"
        );
    }

    fs.rmSync(
        targetPath,
        {
            recursive: true,
            force: true
        }
    );

    return true;
}

/*
 * Переименовать файл или папку
 */
async function renameFile(
    userId,
    serverId,
    oldPath,
    newName
) {
    await ensureServerDirectory(
        userId,
        serverId
    );

    if (!oldPath) {
        throw new Error(
            "Не указан старый путь"
        );
    }

    if (!newName) {
        throw new Error(
            "Не указано новое имя"
        );
    }

    if (
        newName.includes("/") ||
        newName.includes("\\") ||
        newName === "." ||
        newName === ".."
    ) {
        throw new Error(
            "Некорректное имя"
        );
    }

    const oldFullPath =
        getSafePath(
            serverId,
            oldPath
        );

    if (
        !fs.existsSync(oldFullPath)
    ) {
        throw new Error(
            "Файл или папка не найдены"
        );
    }

    const newFullPath =
        path.join(
            path.dirname(oldFullPath),
            newName
        );

    const safeNewPath =
        getSafePath(
            serverId,
            path.relative(
                getServerPath(serverId),
                newFullPath
            )
        );

    if (
        fs.existsSync(safeNewPath)
    ) {
        throw new Error(
            "Такой файл или папка уже существует"
        );
    }

    fs.renameSync(
        oldFullPath,
        safeNewPath
    );

    return true;
}

module.exports = {
    checkServerAccess,
    ensureServerDirectory,
    listFiles,
    readFile,
    writeFile,
    createDirectory,
    createFile,
    deleteFile,
    renameFile
};
