const { query } = require("./db");

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

    await query(
        `
        UPDATE servers
        SET status = 'starting'
        WHERE id = $1
        `,
        [serverId]
    );

    /*
     * Здесь позже будет команда
     * игровому node REWET HOST.
     */

    return {
        id: server.id,
        name: server.name,
        status: "starting"
    };
}


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
        status: "stopping"
    };
}


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
        status: "starting"
    };
}


async function setServerStatus(
    serverId,
    status
) {

    const allowed = [
        "stopped",
        "starting",
        "running",
        "stopping"
    ];

    if (!allowed.includes(status)) {
        throw new Error(
            "Некорректный статус"
        );
    }

    await query(
        `
        UPDATE servers
        SET status = $1
        WHERE id = $2
        `,
        [status, serverId]
    );

    return true;
}


module.exports = {
    getServerForUser,
    startServer,
    stopServer,
    restartServer,
    setServerStatus
};
