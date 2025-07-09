#!/usr/bin/env node

import { TickTickMcpServer } from "./server/ticktick-mcp-server.js";
import { TickTickClientConfig } from "./types/ticktick.js";
import dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function main() {
	// Проверяем наличие access token
	const accessToken = process.env.TICKTICK_ACCESS_TOKEN;

	if (!accessToken) {
		console.error(
			"❌ Ошибка: TICKTICK_ACCESS_TOKEN должен быть установлен в .env файле"
		);
		console.error(
			"Пожалуйста, запустите 'npm run get-token' для получения токена"
		);
		console.error(
			"или установите TICKTICK_ACCESS_TOKEN в переменных окружения"
		);
		process.exit(1);
	}

	// Создаем конфигурацию
	const config: TickTickClientConfig = {
		baseUrl:
			process.env.TICKTICK_BASE_URL || "https://api.ticktick.com/open/v1",
		timeout: 10000,
	};

	try {
		// Создаем и запускаем сервер
		const server = new TickTickMcpServer(config);
		await server.start();
	} catch (error) {
		console.error("❌ Ошибка при запуске сервера:", error);
		process.exit(1);
	}
}

// Обработка сигналов завершения
process.on("SIGINT", () => {
	console.log("\n🛑 Получен сигнал SIGINT, завершение работы...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n🛑 Получен сигнал SIGTERM, завершение работы...");
	process.exit(0);
});

// Запускаем сервер
main().catch((error) => {
	console.error("❌ Критическая ошибка:", error);
	process.exit(1);
});
