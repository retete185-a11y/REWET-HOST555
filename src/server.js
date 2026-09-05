const crypto = require("crypto");
const { query } = require("./db");

const TEST_SERVER_DAYS = 20;

function getExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + TEST_SERVER_DAYS);
    return date;
}

function generateServerName() {
    return `REWET-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createServer(ownerId, name, game) {
    if (!name || !game) {
        throw new Error("Укажи название сервера и игру");
    }

    if (name.length < 3 || name.length > 64) {
        throw new Error("Название сервера должно быть от 3 до 64 символов");
    }

    if (game.length < 2 || game.length > 32) {
        throw new Error("Некорректное название игры");
    }

    const existing = await query(
        `SELECT id
         FROM servers
         WHERE owner_id = $1`,
        [ownerId]
    );

    if (existing.rows.length >= 5) {
        throw new Error("Можно создать максимум 5 серверов");
    }

    const expiresAt = getExpirationDate();

    const result = await query(
        `INSERT INTO servers
            (owner_id, name, game, status, expires_at)
         VALUES
            ($1, $2, $3, 'stopped', $4)
         RETURNING id, owner_id, name, game, status, expires_at, created_at`,
        [
            ownerId,
            name,
            game,
            expiresAt
        ]
    );

    return result.rows[0];
}

async function getUserServers(userId) {
    const result = await query(
        `SELECT
            s.id,
            s.name,
            s.game,
            s.status,
            s.expires_at,
            s.created_at,
            'owner' AS role
         FROM servers s
         WHERE s.owner_id = $1

         UNION

         SELECT
            s.id,
            s.name,
            s.game,
            s.status,
            s.expires_at,
            s.created_at,
            sm.role
         FROM servers s
         INNER JOIN server_members sm
            ON sm.server_id = s.id
         WHERE sm.user_id = $1

         ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows;
}

async function getServer(userId, serverId) {
    const result = await query(
        `SELECT
            s.id,
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
           )`,
        [userId, serverId]
    );

    if (result.rows.length === 0) {
        throw new Error("Сервер не найден");
    }

    return result.rows[0];
}

async function createAccessKey(userId, serverId) {

    const server = await getServer(userId, serverId);

    if (server.role !== "owner") {
        throw new Error(
            "Только владелец сервера может создавать ключ"
        );
    }

    const key = crypto
        .randomBytes(16)
        .toString("hex")
        .toUpperCase();

    await query(
        `INSERT INTO access_keys
            (server_id, key)
         VALUES
            ($1, $2)`,
        [serverId, key]
    );

    return key;
}

async function useAccessKey(userId, key) {

    if (!key) {
        throw new Error("Введи ключ доступа");
    }

    const result = await query(
        `SELECT
            ak.id,
            ak.server_id,
            ak.used,
            s.owner_id
         FROM access_keys ak
         INNER JOIN servers s
            ON s.id = ak.server_id
         WHERE ak.key = $1`,
        [key.toUpperCase()]
    );

    if (result.rows.length === 0) {
        throw new Error("Ключ не найден");
    }

    const accessKey = result.rows[0];

    if (accessKey.used) {
        throw new Error("Этот ключ уже использован");
    }

    if (accessKey.owner_id === userId) {
        throw new Error("Нельзя добавить собственный сервер");
    }

    const alreadyMember = await query(
        `SELECT id
         FROM server_members
         WHERE server_id = $1
           AND user_id = $2`,
        [
            accessKey.server_id,
            userId
        ]
    );

    if (alreadyMember.rows.length > 0) {
        throw new Error("У тебя уже есть доступ к этому серверу");
    }

    await query(
        `INSERT INTO server_members
            (server_id, user_id, role)
         VALUES
            ($1, $2, 'co_owner')`,
        [
            accessKey.server_id,
            userId
        ]
    );

    await query(
        `UPDATE access_keys
         SET used = TRUE,
             used_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [accessKey.id]
    );

    return {
        success: true,
        server_id: accessKey.server_id
    };
}

module.exports = {
    createServer,
    getUserServers,
    getServer,
    createAccessKey,
    useAccessKey
};
