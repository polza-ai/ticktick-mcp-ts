import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TickTickClient } from "../client/ticktick-client.js";
import { TickTickClientConfig, PRIORITY_MAP } from "../types/ticktick.js";

class Logger {
	constructor(private context: string) {}

	log(message: string, ...args: any[]) {
		console.log(`[${this.context}] ${message}`, ...args);
	}

	error(message: string, error?: any) {
		console.error(`[${this.context}] ${message}`, error);
	}

	warn(message: string, ...args: any[]) {
		console.warn(`[${this.context}] ${message}`, ...args);
	}
}

export class TickTickMcpServer {
	private readonly logger = new Logger(TickTickMcpServer.name);
	private readonly server: McpServer;
	private readonly tickTickClient: TickTickClient;

	constructor(config: TickTickClientConfig = {}) {
		this.tickTickClient = new TickTickClient(config);
		this.server = new McpServer({
			name: "ticktick-mcp-server",
			version: "1.0.0",
		});

		this.setupTools();
		this.setupResources();
	}

	/**
	 * Получить токен доступа из параметров или переменных окружения
	 */
	private getAccessToken(providedToken?: string): string {
		const token = providedToken || process.env.TICKTICK_ACCESS_TOKEN;
		if (!token) {
			throw new Error(
				"Access token не найден. Передайте accessToken в параметрах или установите TICKTICK_ACCESS_TOKEN в переменных окружения."
			);
		}
		return token;
	}

	private setupTools() {
		// Инструмент для получения проектов
		this.server.registerTool(
			"get_projects",
			{
				title: "Получить проекты",
				description: "Получить все проекты пользователя TickTick",
				inputSchema: {
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const projects = await this.tickTickClient.getProjects(token);

					return {
						content: [
							{
								type: "text",
								text: `Найдено ${projects.length} проектов:\n${projects
									.map((p) => `- ${p.name} (ID: ${p.id})`)
									.join("\n")}`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to get projects", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при получении проектов: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для получения задач проекта
		this.server.registerTool(
			"get_project_tasks",
			{
				title: "Получить задачи проекта",
				description: "Получить все задачи конкретного проекта",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const projectData = await this.tickTickClient.getProjectWithData(
						projectId,
						token
					);

					const tasks = projectData.tasks || [];
					return {
						content: [
							{
								type: "text",
								text: `Проект "${projectData.project.name}" содержит ${
									tasks.length
								} задач:\n${tasks
									.map(
										(t) =>
											`- ${t.title} (ID: ${t.id}, Статус: ${
												t.status === 0 ? "Активная" : "Завершена"
											})`
									)
									.join("\n")}`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to get project tasks", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при получении задач проекта: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для получения конкретной задачи
		this.server.registerTool(
			"get_task",
			{
				title: "Получить задачу",
				description: "Получить детали конкретной задачи",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					taskId: z.string().describe("ID задачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, taskId, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const task = await this.tickTickClient.getTask(
						projectId,
						taskId,
						token
					);

					return {
						content: [
							{
								type: "text",
								text: `Задача: ${task.title}
ID: ${task.id}
Проект: ${task.projectId}
Описание: ${task.content || "Нет описания"}
Статус: ${task.status === 0 ? "Активная" : "Завершена"}
Приоритет: ${task.priority || 0}
Срок: ${task.dueDate || "Не установлен"}`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to get task", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при получении задачи: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для создания задачи
		this.server.registerTool(
			"create_task",
			{
				title: "Создать задачу",
				description: "Создать новую задачу в TickTick",
				inputSchema: {
					title: z.string().describe("Название задачи"),
					projectId: z.string().describe("ID проекта"),
					content: z.string().optional().describe("Описание задачи"),
					dueDate: z
						.string()
						.optional()
						.describe("Срок выполнения (ISO 8601 формат)"),
					priority: z
						.enum(["none", "low", "medium", "high"])
						.optional()
						.describe("Приоритет задачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ title, projectId, content, dueDate, priority, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const task = await this.tickTickClient.createTask(
						{
							title,
							projectId,
							content,
							dueDate,
							priority: priority ? PRIORITY_MAP[priority] : undefined,
						},
						token
					);

					return {
						content: [
							{
								type: "text",
								text: `Задача "${task.title}" успешно создана с ID: ${task.id}`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to create task", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при создании задачи: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для обновления задачи
		this.server.registerTool(
			"update_task",
			{
				title: "Обновить задачу",
				description: "Обновить существующую задачу",
				inputSchema: {
					taskId: z.string().describe("ID задачи"),
					projectId: z.string().describe("ID проекта"),
					title: z.string().optional().describe("Новое название задачи"),
					content: z.string().optional().describe("Новое описание задачи"),
					dueDate: z
						.string()
						.optional()
						.describe("Новый срок выполнения (ISO 8601 формат)"),
					priority: z
						.enum(["none", "low", "medium", "high"])
						.optional()
						.describe("Новый приоритет задачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({
				taskId,
				projectId,
				title,
				content,
				dueDate,
				priority,
				accessToken,
			}) => {
				try {
					const token = this.getAccessToken(accessToken);
					const task = await this.tickTickClient.updateTask(
						taskId,
						{
							id: taskId,
							projectId,
							title,
							content,
							dueDate,
							priority: priority ? PRIORITY_MAP[priority] : undefined,
						},
						token
					);

					return {
						content: [
							{
								type: "text",
								text: `Задача "${task.title}" успешно обновлена`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to update task", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при обновлении задачи: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для завершения задачи
		this.server.registerTool(
			"complete_task",
			{
				title: "Завершить задачу",
				description: "Отметить задачу как выполненную",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					taskId: z.string().describe("ID задачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, taskId, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					await this.tickTickClient.completeTask(projectId, taskId, token);

					return {
						content: [
							{
								type: "text",
								text: `Задача с ID ${taskId} успешно завершена`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to complete task", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при завершении задачи: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для удаления задачи
		this.server.registerTool(
			"delete_task",
			{
				title: "Удалить задачу",
				description: "Удалить задачу из TickTick",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					taskId: z.string().describe("ID задачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, taskId, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					await this.tickTickClient.deleteTask(projectId, taskId, token);

					return {
						content: [
							{
								type: "text",
								text: `Задача с ID ${taskId} успешно удалена`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to delete task", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при удалении задачи: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для создания проекта
		this.server.registerTool(
			"create_project",
			{
				title: "Создать проект",
				description: "Создать новый проект в TickTick",
				inputSchema: {
					name: z.string().describe("Название проекта"),
					color: z
						.string()
						.optional()
						.describe("Цвет проекта (например, #FF0000)"),
					viewMode: z
						.enum(["list", "kanban", "timeline"])
						.optional()
						.describe("Режим отображения проекта"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ name, color, viewMode, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const project = await this.tickTickClient.createProject(
						{
							name,
							color,
							viewMode,
							kind: "TASK",
						},
						token
					);

					return {
						content: [
							{
								type: "text",
								text: `Проект "${project.name}" успешно создан с ID: ${project.id}`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to create project", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при создании проекта: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Инструмент для удаления проекта
		this.server.registerTool(
			"delete_project",
			{
				title: "Удалить проект",
				description: "Удалить проект из TickTick",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					await this.tickTickClient.deleteProject(projectId, token);

					return {
						content: [
							{
								type: "text",
								text: `Проект с ID ${projectId} успешно удален`,
							},
						],
					};
				} catch (error) {
					this.logger.error("Failed to delete project", error);
					return {
						content: [
							{
								type: "text",
								text: `Ошибка при удалении проекта: ${error}`,
							},
						],
						isError: true,
					};
				}
			}
		);
	}

	private setupResources() {
		// Ресурс для получения информации о конфигурации
		this.server.registerResource(
			"config_info",
			new ResourceTemplate("ticktick://config", { list: undefined }),
			{
				title: "Информация о конфигурации TickTick",
				description: "Получить информацию о текущей конфигурации",
			},
			async (uri) => {
				const hasEnvToken = !!process.env.TICKTICK_ACCESS_TOKEN;
				const baseUrl =
					this.tickTickClient["baseUrl"] || "https://api.ticktick.com/open/v1";

				return {
					contents: [
						{
							uri: uri.href,
							text: `Конфигурация TickTick MCP Server:
Base URL: ${baseUrl}
Access Token в env: ${hasEnvToken ? "Да" : "Нет"}
Версия: 1.0.0`,
						},
					],
				};
			}
		);
	}

	/**
	 * Запустить MCP сервер
	 */
	async start() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		this.logger.log("TickTick MCP Server запущен");
	}
}
