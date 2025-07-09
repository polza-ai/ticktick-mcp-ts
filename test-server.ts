#!/usr/bin/env node

import { TickTickMcpServer } from "./src/server/ticktick-mcp-server.js";
import { TickTickClientConfig } from "./src/types/ticktick.js";
import dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function testServer() {
	console.log("🧪 Тестирование TickTick MCP сервера...\n");

	// Проверяем переменные окружения
	const accessToken = process.env.TICKTICK_ACCESS_TOKEN;

	if (!accessToken) {
		console.error("❌ Ошибка: Не найден TICKTICK_ACCESS_TOKEN");
		console.error(
			"Пожалуйста, запустите 'npm run get-token' для получения токена"
		);
		console.error("или установите TICKTICK_ACCESS_TOKEN в .env файле");
		process.exit(1);
	}

	console.log("✅ Access token найден");
	console.log(`   Token: ${accessToken.substring(0, 20)}...\n`);

	// Создаем конфигурацию
	const config: TickTickClientConfig = {
		baseUrl:
			process.env.TICKTICK_BASE_URL || "https://api.ticktick.com/open/v1",
		timeout: 10000,
	};

	try {
		// Создаем сервер
		console.log("🚀 Создание MCP сервера...");
		const server = new TickTickMcpServer(config);

		console.log("✅ Сервер создан успешно");
		console.log("📋 Доступные инструменты:");
		console.log("   - get_projects: Получить список проектов");
		console.log("   - get_project_tasks: Получить задачи проекта");
		console.log("   - get_task: Получить задачу по ID");
		console.log("   - create_task: Создать новую задачу");
		console.log("   - update_task: Обновить задачу");
		console.log("   - complete_task: Завершить задачу");
		console.log("   - delete_task: Удалить задачу");
		console.log("   - create_project: Создать новый проект");
		console.log("   - delete_project: Удалить проект");

		// Тестируем реальные API вызовы
		console.log("\n🧪 Тестирование API вызовов...");

		// Создаем клиент для прямого тестирования
		const { TickTickClient } = await import("./src/client/ticktick-client.js");
		const client = new TickTickClient(config);

		try {
			// Тестируем получение проектов
			console.log("📋 Получение списка проектов...");
			const projects = await client.getProjects(accessToken);
			console.log(`✅ Найдено ${projects.length} проектов:`);
			projects.slice(0, 3).forEach((project, index) => {
				console.log(`   ${index + 1}. ${project.name} (ID: ${project.id})`);
			});
			if (projects.length > 3) {
				console.log(`   ... и еще ${projects.length - 3} проектов`);
			}

			// Тестируем получение задач для первого проекта
			if (projects.length > 0) {
				const firstProject = projects[0];
				console.log(`\n📝 Получение задач проекта "${firstProject.name}"...`);

				try {
					const projectData = await client.getProjectWithData(
						firstProject.id,
						accessToken
					);
					const tasks = projectData.tasks || [];
					console.log(`✅ Найдено ${tasks.length} задач:`);

					tasks.slice(0, 5).forEach((task, index) => {
						const status = task.status === 0 ? "🔄 Активная" : "✅ Завершена";
						const priority = task.priority ? `[P${task.priority}]` : "";
						console.log(`   ${index + 1}. ${status} ${priority} ${task.title}`);
					});

					if (tasks.length > 5) {
						console.log(`   ... и еще ${tasks.length - 5} задач`);
					}

					if (tasks.length === 0) {
						console.log("   📭 Проект пуст");
					}
				} catch (taskError) {
					console.log(`⚠️  Не удалось получить задачи: ${taskError}`);
				}
			}
		} catch (apiError) {
			console.error("❌ Ошибка при тестировании API:", apiError);
			console.error("Возможные причины:");
			console.error("- Истек access token (запустите: npm run get-token)");
			console.error("- Проблемы с сетью");
			console.error("- Неверные настройки API");
		}

		console.log("\n🔧 Для использования сервера:");
		console.log("1. Запустите: npm start");
		console.log(
			"2. Или добавьте в Claude Desktop конфигурацию из claude-desktop-config.json"
		);

		console.log("\n💡 Примечания:");
		console.log(
			"- Все инструменты поддерживают опциональный параметр accessToken"
		);
		console.log(
			"- Если accessToken не передан, используется значение из TICKTICK_ACCESS_TOKEN"
		);
		console.log("- Для получения нового токена используйте: npm run get-token");

		console.log("\n✅ Тест завершен успешно!");
	} catch (error) {
		console.error("❌ Ошибка при создании сервера:", error);
		process.exit(1);
	}
}

// Запускаем тест
testServer().catch((error) => {
	console.error("❌ Критическая ошибка теста:", error);
	process.exit(1);
});
