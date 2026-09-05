const express = require("express");
const path = require("path");
const { testDatabase } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", async (req, res) => {
    const database = await testDatabase();

    res.json({
        status: "ok",
        service: "REWET HOST",
        version: "1.0.0",
        database: database ? "connected" : "disconnected"
    });
});

app.get("/api", (req, res) => {
    res.json({
        name: "REWET HOST",
        message: "Gaming Hosting API",
        status: "online"
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
    console.log(`REWET HOST запущен на порту ${PORT}`);
});
