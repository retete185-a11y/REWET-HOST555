const { query } = require("./db");

async function getStats() {
    const users = await query(
        "SELECT COUNT(*)::int AS count FROM users"
    );

    const servers = await query(
        "SELECT COUNT(*)::int AS count FROM servers"
    );

    const running = await query(
        "SELECT COUNT(*)::int AS count FROM servers WHERE status = 'running'"
    );

    return {
        users: users.rows[0].count,
        servers: servers.rows[0].count,
        runningServers: running.rows[0].count
    };
}

async function getUsers() {
    const result = await query(`
        SELECT
            id,
            username,
            email,
            balance,
            is_admin,
            created_at
        FROM users
        ORDER BY id DESC
    `);

    return result.rows;
}

async function getServers() {
    const result = await query(`
        SELECT
            s.id,
            s.owner_id,
            s.name,
            s.game,
            s.status,
            s.expires_at,
            s.created_at,
            u.username AS owner_username
        FROM servers s
        LEFT JOIN users u
            ON u.id = s.owner_id
        ORDER BY s.id DESC
    `);

    return result.rows;
}

module.exports = {
    getStats,
    getUsers,
    getServers
};
