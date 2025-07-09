#!/usr/bin/env node

import express from "express";
import { spawn } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Загружаем переменные окружения
dotenv.config();

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Конфигурация для TickTick или Dida365
const config = {
	baseUrl: process.env.TICKTICK_BASE_URL || "https://api.ticktick.com/open/v1",
	authUrl:
		process.env.TICKTICK_AUTH_URL || "https://ticktick.com/oauth/authorize",
	tokenUrl:
		process.env.TICKTICK_TOKEN_URL || "https://ticktick.com/oauth/token",
	clientId: process.env.TICKTICK_CLIENT_ID,
	clientSecret: process.env.TICKTICK_CLIENT_SECRET,
};

async function getToken() {
	console.log("🎯 TickTick Access Token Generator");
	console.log("==================================\n");

	// Проверяем наличие CLIENT_ID и CLIENT_SECRET
	if (!config.clientId || !config.clientSecret) {
		console.error(
			"❌ Ошибка: CLIENT_ID и CLIENT_SECRET не найдены в .env файле"
		);
		console.log("\n📝 Создайте .env файл со следующими параметрами:");
		console.log("TICKTICK_CLIENT_ID=your_client_id_here");
		console.log("TICKTICK_CLIENT_SECRET=your_client_secret_here");
		console.log(
			"\n🔗 Получить credentials: https://developer.ticktick.com/manage"
		);
		process.exit(1);
	}

	const app = express();
	let server: any;

	// Создаем Promise для получения кода авторизации
	const getAuthCode = (): Promise<string> => {
		return new Promise((resolve, reject) => {
			// Обработчик callback'а
			app.get("/callback", (req, res) => {
				const { code, error } = req.query;

				if (error) {
					res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: red;">❌ Ошибка авторизации</h2>
                <p>Ошибка: ${error}</p>
                <p>Вы можете закрыть это окно.</p>
              </body>
            </html>
          `);
					reject(new Error(`Authorization error: ${error}`));
					return;
				}

				if (!code) {
					res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: red;">❌ Код авторизации не получен</h2>
                <p>Вы можете закрыть это окно.</p>
              </body>
            </html>
          `);
					reject(new Error("No authorization code received"));
					return;
				}

				res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: green;">✅ Авторизация успешна!</h2>
              <p>Код получен. Обмениваем на access token...</p>
              <p>Вы можете закрыть это окно.</p>
            </body>
          </html>
        `);

				resolve(code as string);
			});

			// Запускаем сервер
			server = app.listen(PORT, () => {
				console.log(`🚀 Локальный сервер запущен на порту ${PORT}`);

				// Формируем URL для авторизации
				const authUrl = new URL(config.authUrl);
				authUrl.searchParams.set("client_id", config.clientId!);
				authUrl.searchParams.set("scope", "tasks:read tasks:write");
				authUrl.searchParams.set("response_type", "code");
				authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
				authUrl.searchParams.set("state", "ticktick-mcp");

				console.log("🌐 Открываем браузер для авторизации...");
				console.log(`📋 URL: ${authUrl.toString()}\n`);

				// Открываем браузер
				const platform = process.platform;
				let command: string;

				if (platform === "darwin") {
					command = "open";
				} else if (platform === "win32") {
					command = "start";
				} else {
					command = "xdg-open";
				}

				spawn(command, [authUrl.toString()], {
					detached: true,
					stdio: "ignore",
				});

				console.log("⏳ Ожидаем авторизации...");
			});

			// Таймаут на 5 минут
			setTimeout(() => {
				reject(new Error("Authorization timeout (5 minutes)"));
			}, 5 * 60 * 1000);
		});
	};

	try {
		// Получаем код авторизации
		const authCode = await getAuthCode();
		console.log("✅ Код авторизации получен");

		// Закрываем сервер
		server.close();

		// Обмениваем код на access token
		console.log("🔄 Обмениваем код на access token...");

		const tokenResponse = await fetch(config.tokenUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(
					`${config.clientId}:${config.clientSecret}`
				).toString("base64")}`,
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: authCode,
				redirect_uri: REDIRECT_URI,
				scope: "tasks:read tasks:write",
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			throw new Error(
				`Token exchange failed: ${tokenResponse.status} ${errorText}`
			);
		}

		const tokenData = await tokenResponse.json();

		if (!tokenData.access_token) {
			throw new Error("No access token in response");
		}

		console.log("✅ Access token получен успешно!\n");

		// Выводим токен
		console.log("🎉 ВАШ ACCESS TOKEN:");
		console.log("===================");
		console.log(tokenData.access_token);
		console.log("===================\n");

		// Автоматически обновляем .env файл
		const envPath = path.join(process.cwd(), ".env");
		let envContent = "";

		if (fs.existsSync(envPath)) {
			envContent = fs.readFileSync(envPath, "utf8");
		}

		// Удаляем старый токен если есть
		envContent = envContent.replace(/^TICKTICK_ACCESS_TOKEN=.*$/m, "");

		// Добавляем новый токен
		if (envContent && !envContent.endsWith("\n")) {
			envContent += "\n";
		}
		envContent += `TICKTICK_ACCESS_TOKEN=${tokenData.access_token}\n`;

		fs.writeFileSync(envPath, envContent);
		console.log("✅ Токен автоматически сохранен в .env файл");

		// Показываем информацию о токене
		if (tokenData.expires_in) {
			const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
			console.log(`⏰ Токен действителен до: ${expiresAt.toLocaleString()}`);
		}

		if (tokenData.refresh_token) {
			console.log("🔄 Refresh token также получен");
		}

		console.log("\n🚀 Готово! Теперь вы можете использовать MCP сервер:");
		console.log("npm test  # для тестирования");
		console.log("npm start # для запуска сервера");
		process.exit(0);
	} catch (error) {
		console.error(
			"\n❌ Ошибка:",
			error instanceof Error ? error.message : error
		);

		if (server) {
			server.close();
		}

		process.exit(1);
	}
}

// Обработка сигналов для корректного завершения
process.on("SIGINT", () => {
	console.log("\n👋 Прерывание пользователем");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n👋 Завершение работы");
	process.exit(0);
});

getToken();
