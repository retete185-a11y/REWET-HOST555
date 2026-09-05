const API = "/api";

function getToken() {
    return localStorage.getItem("rewet_token");
}

function saveToken(token) {
    localStorage.setItem("rewet_token", token);
}

function removeToken() {
    localStorage.removeItem("rewet_token");
}

async function apiRequest(url, options = {}) {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API}${url}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Произошла ошибка");
    }

    return data;
}

async function checkServer() {
    try {
        const data = await apiRequest("/health");
        console.log("REWET HOST:", data);
    } catch (error) {
        console.error("Ошибка подключения:", error);
    }
}

function logout() {
    removeToken();
    window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", () => {
    checkServer();
});
