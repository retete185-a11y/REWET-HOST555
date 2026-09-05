const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "rewet-host-change-this-secret";

async function register(username, email, password) {
    if (!username || !email || !password) {
        throw new Error("Заполни все поля");
    }

    if (username.length < 3 || username.length > 32) {
        throw new Error("Логин должен быть от 3 до 32 символов");
    }

    if (password.length < 6) {
        throw new Error("Пароль должен содержать минимум 6 символов");
    }

    const existing = await query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
    );

    if (existing.rows.length > 0) {
        throw new Error("Пользователь с таким логином или email уже существует");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, balance, is_admin`,
        [username, email, passwordHash]
    );

    return result.rows[0];
}

async function login(login, password) {
    const result = await query(
        `SELECT id, username, email, password_hash, balance, is_admin
         FROM users
         WHERE username = $1 OR email = $1`,
        [login]
    );

    if (result.rows.length === 0) {
        throw new Error("Неверный логин или пароль");
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!validPassword) {
        throw new Error("Неверный логин или пароль");
    }

    const token = jwt.sign(
        {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            is_admin: user.is_admin
        }
    };
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Требуется авторизация"
        });
    }

    const token = header.substring(7);

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            message: "Недействительный или просроченный токен"
        });
    }
}

module.exports = {
    register,
    login,
    authMiddleware
};
