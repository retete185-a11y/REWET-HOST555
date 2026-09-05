const { query } = require("./db");

/*
 * Получение сервера с проверкой доступа пользователя
 */
async function getServerForUser(userId, serverId) {
    const result = await query(
        `
        SELECT
            s.id,
            s.owner_id,
            s.name,
            s.game,
            s.status,
            s.expires_at,
            s.created_at,
            CASE
                WHEN s.owner_id = $1 THEN 'owner'
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
        throw new Error("Сервер не найден");
    }

    return result.rows[0];
}

/*
 * Запуск сервера
 */
async function startServer(userId, serverId) {
    const server =
        await getServerForUser(
            userId,
            serverId
        );

    if (
        server.role !== "owner" &&
        server.role !== "co_owner"
    ) {
        throw new Error(
            "Недостаточно прав"
        );
    }

    if (server.status === "running") {
        throw new Error(
            "Сервер уже запущен"
        );
    }

    if (server.status === "starting") {
        throw new Error(
            "Сервер уже запускается"
        );
    }

    await query(
        `
        UPDATE servers
        SET status = 'starting'
        WHERE id = $1
        `,
        [serverId]
    );

    return {
        id: server.id,
        name: server.name,
        game: server.game,
        status: "starting"
    };
}

/*
 * Остановка сервера
 */
async function stopServer(userId, serverId) {
    const server =
        await getServerForUser(
            userId,
            serverId
        );

    if (
        server.role !== "owner" &&
        server.role !== "co_owner"
    ) {
        throw new Error(
            "Недостаточно прав"
        );
    }

    if (server.status === "stopped") {
        throw new Error(
            "Сервер уже остановлен"
        );
    }

    if (server.status === "stopping") {
        throw new Error(
            "Сервер уже останавливается"
        );
    }

    await query(
        `
        UPDATE servers
        SET status = 'stopping'
        WHERE id = $1
        `,
        [serverId]
    );

    return {
        id: server.id,
        name: server.name,
        game: server.game,
        status: "stopping"
    };
}

/*
 * Перезапуск сервера
 */
async function restartServer(userId, serverId) {
    const server =
        await getServerForUser(
            userId,
            serverId
        );

    if (
        server.role !== "owner" &&
        server.role !== "co_owner"
    ) {
        throw new Error(
            "Недостаточно прав"
        );
    }

    await query(
        `
        UPDATE servers
        SET status = 'starting'
        WHERE id = $1
        `,
        [serverId]
    );

    return {
        id: server.id,
        name: server.name,
        game: server.game,
        status: "starting"
    };
}

/*
 * Изменение статуса серверного процесса.
 * Позже это будет вызываться игровым Node.
 */
async function setServerStatus(
    serverId,
    status
) {
    const allowedStatuses = [
        "stopped",
        "starting",
        "running",
        "stopping"
    ];

    if (
        !allowedStatuses.includes(status)
    ) {
        throw new Error(
            "Некорректный статус сервера"
        );
    }

    await query(
        `
        UPDATE servers
        SET status = $1
        WHERE id = $2
        `,
        [
            status,
            serverId
        ]
    );

    return true;
}

/*
 * Получить статус сервера
 */
async function getServerStatus(
    serverId
) {
    const result = await query(
        `
        SELECT
            id,
            name,
            game,
            status,
            expires_at
        FROM servers
        WHERE id = $1
        `,
        [serverId]
    );

    if (result.rows.length === 0) {
        throw new Error(
            "Сервер не найден"
        );
    }

    return result.rows[0];
}

module.exports = {
    getServerForUser,
    startServer,
    stopServer,
    restartServer,
    setServerStatus,
    getServerStatus
};
