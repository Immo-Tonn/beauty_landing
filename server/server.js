import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

// Исправление __dirname для ES-модуля
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Защита от спама: не больше 10 заявок с одного IP за 15 минут
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use("/api/contact", limiter);

// Настройка Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ========================
// Маршрут для формы — ДОЛЖЕН идти перед app.get("*")
// ========================
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message, company, lang } = req.body;

  // Honeypot: если поле заполнено, это бот
  if (company) return res.status(400).json({ error: "Spam detected" });

  // Сообщения на разных языках
  const messages = {
    de: "Bitte geben Sie Name, E-Mail und Telefon ein",
    ru: "Введите имя, email и телефон",
    en: "Please enter name, email, and phone",
  };

  // По умолчанию немецкий
  const language = messages[lang] ? lang : "de";

  // Проверка обязательных полей
  if (!name || !email || !phone)
    return res.status(400).json({ error: messages[language] });

  try {
    await transporter.sendMail({
      from: `"BeautyTime Kontaktformular" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Neue BeautyTime Anfrage von ${name}`,
      text: `Name: ${name}\nE-Mail: ${email}\nTelefon: ${phone}\nNachricht: ${message}`,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mail error:", error);
    res.status(500).json({ error: "Mail error" });
  }
});

// ========================
// Статика фронтенда
// ========================
app.use(express.static(path.join(__dirname, "../dist")));

// ========================
// Все GET-запросы → index.html (SPA)
// ========================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// ========================
// Запуск сервера
// ========================
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});
