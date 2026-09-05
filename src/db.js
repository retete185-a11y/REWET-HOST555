const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

pool.on("error", (error) => {
    console.error("Ошибка PostgreSQL:", error);
});

async function query(text, params = []) {
    return pool.query(text, params);
}

async function testDatabase() {
    try {
        await pool.query("SELECT NOW()");
        console.log("PostgreSQL подключён");
        return true;
    } catch (error) {
        console.error("PostgreSQL недоступен:", error.message);
        return false;
    }
}

module.exports = {
    pool,
    query,
    testDatabase
};
