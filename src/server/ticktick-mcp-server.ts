import {
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TickTickClient } from "../client/ticktick-client.js";
import {
	TickTickClientConfig,
	PRIORITY_MAP,
	McpResponse,
	ProjectsResponseData,
	ProjectTasksResponseData,
	TaskResponseData,
	CreateTaskResponseData,
	CreateProjectResponseData,
	OperationResponseData,
	TodayTasksResponseData,
	OverdueTasksResponseData,
	StatsResponseData,
} from "../types/ticktick.js";

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

	/**
	 * Создать успешный ответ в формате JSON
	 */
	private createSuccessResponse<T>(data: T, message: string) {
		const responseData: McpResponse<T> = {
			success: true,
			data: data,
			message: message,
			timestamp: new Date().toISOString(),
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(responseData, null, 2),
				},
			],
		};
	}

	/**
	 * Создать ответ об ошибке в формате JSON
	 */
	private createErrorResponse(error: any, message: string) {
		const responseData: McpResponse = {
			success: false,
			error: error.message || error.toString(),
			message: message,
			timestamp: new Date().toISOString(),
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(responseData, null, 2),
				},
			],
			isError: true,
		};
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

					const responseData: ProjectsResponseData = {
						count: projects.length,
						projects: projects,
					};

					return this.createSuccessResponse(
						responseData,
						`Найдено ${projects.length} проектов`
					);
				} catch (error) {
					this.logger.error("Failed to get projects", error);
					return this.createErrorResponse(
						error,
						`Ошибка при получении проектов: ${error}`
					);
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
					const responseData: ProjectTasksResponseData = {
						project: projectData.project,
						taskCount: tasks.length,
						tasks: tasks,
					};

					return this.createSuccessResponse(
						responseData,
						`Проект "${projectData.project.name}" содержит ${tasks.length} задач`
					);
				} catch (error) {
					this.logger.error("Failed to get project tasks", error);
					return this.createErrorResponse(
						error,
						`Ошибка при получении задач проекта: ${error}`
					);
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

					const responseData: TaskResponseData = {
						task: task,
					};

					return this.createSuccessResponse(
						responseData,
						`Получена задача: ${task.title}`
					);
				} catch (error) {
					this.logger.error("Failed to get task", error);
					return this.createErrorResponse(
						error,
						`Ошибка при получении задачи: ${error}`
					);
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
					desc: z.string().optional().describe("Дополнительное описание"),
					isAllDay: z.boolean().optional().describe("Задача на весь день"),
					startDate: z
						.string()
						.optional()
						.describe("Дата начала (ISO 8601 формат)"),
					dueDate: z
						.string()
						.optional()
						.describe("Срок выполнения (ISO 8601 формат)"),
					timeZone: z
						.string()
						.optional()
						.describe("Временная зона (например, America/Los_Angeles)"),
					reminders: z
						.array(z.string())
						.optional()
						.describe("Напоминания (например, ['TRIGGER:P0DT9H0M0S'])"),
					repeatFlag: z
						.string()
						.optional()
						.describe(
							"Правило повторения (например, 'RRULE:FREQ=DAILY;INTERVAL=1')"
						),
					priority: z
						.enum(["none", "low", "medium", "high"])
						.optional()
						.describe("Приоритет задачи"),
					sortOrder: z.number().optional().describe("Порядок сортировки"),
					items: z
						.array(
							z.object({
								title: z.string().describe("Название подзадачи"),
								status: z
									.number()
									.default(0)
									.describe("Статус подзадачи (0=Normal, 1=Completed)"),
								isAllDay: z
									.boolean()
									.optional()
									.describe("Подзадача на весь день"),
								startDate: z
									.string()
									.optional()
									.describe("Дата начала подзадачи"),
								timeZone: z
									.string()
									.optional()
									.describe("Временная зона подзадачи"),
								sortOrder: z
									.number()
									.optional()
									.describe("Порядок сортировки подзадачи"),
							})
						)
						.optional()
						.describe("Подзадачи"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({
				title,
				projectId,
				content,
				desc,
				isAllDay,
				startDate,
				dueDate,
				timeZone,
				reminders,
				repeatFlag,
				priority,
				sortOrder,
				items,
				accessToken,
			}) => {
				try {
					const token = this.getAccessToken(accessToken);
					const task = await this.tickTickClient.createTask(
						{
							title,
							projectId,
							content,
							desc,
							isAllDay,
							startDate,
							dueDate,
							timeZone,
							reminders,
							repeatFlag,
							priority: priority ? PRIORITY_MAP[priority] : undefined,
							sortOrder,
							items,
						},
						token
					);

					const responseData: CreateTaskResponseData = {
						task: task,
					};

					return this.createSuccessResponse(
						responseData,
						`Задача "${task.title}" успешно создана с ID: ${task.id}`
					);
				} catch (error) {
					this.logger.error("Failed to create task", error);
					return this.createErrorResponse(
						error,
						`Ошибка при создании задачи: ${error}`
					);
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
					desc: z.string().optional().describe("Новое дополнительное описание"),
					isAllDay: z.boolean().optional().describe("Задача на весь день"),
					startDate: z
						.string()
						.optional()
						.describe("Новая дата начала (ISO 8601 формат)"),
					dueDate: z
						.string()
						.optional()
						.describe("Новый срок выполнения (ISO 8601 формат)"),
					timeZone: z
						.string()
						.optional()
						.describe("Новая временная зона (например, America/Los_Angeles)"),
					reminders: z
						.array(z.string())
						.optional()
						.describe("Новые напоминания (например, ['TRIGGER:P0DT9H0M0S'])"),
					repeatFlag: z
						.string()
						.optional()
						.describe(
							"Новое правило повторения (например, 'RRULE:FREQ=DAILY;INTERVAL=1')"
						),
					priority: z
						.enum(["none", "low", "medium", "high"])
						.optional()
						.describe("Новый приоритет задачи"),
					sortOrder: z.number().optional().describe("Новый порядок сортировки"),
					items: z
						.array(
							z.object({
								id: z
									.string()
									.describe("ID подзадачи (обязательно для обновления)"),
								title: z.string().describe("Название подзадачи"),
								status: z
									.number()
									.default(0)
									.describe("Статус подзадачи (0=Normal, 1=Completed)"),
								isAllDay: z
									.boolean()
									.optional()
									.describe("Подзадача на весь день"),
								startDate: z
									.string()
									.optional()
									.describe("Дата начала подзадачи"),
								timeZone: z
									.string()
									.optional()
									.describe("Временная зона подзадачи"),
								sortOrder: z
									.number()
									.optional()
									.describe("Порядок сортировки подзадачи"),
							})
						)
						.optional()
						.describe("Подзадачи"),
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
				desc,
				isAllDay,
				startDate,
				dueDate,
				timeZone,
				reminders,
				repeatFlag,
				priority,
				sortOrder,
				items,
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
							desc,
							isAllDay,
							startDate,
							dueDate,
							timeZone,
							reminders,
							repeatFlag,
							priority: priority ? PRIORITY_MAP[priority] : undefined,
							sortOrder,
							items,
						},
						token
					);

					const responseData: TaskResponseData = {
						task: task,
					};

					return this.createSuccessResponse(
						responseData,
						`Задача "${task.title}" успешно обновлена`
					);
				} catch (error) {
					this.logger.error("Failed to update task", error);
					return this.createErrorResponse(
						error,
						`Ошибка при обновлении задачи: ${error}`
					);
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

					const responseData: OperationResponseData = {
						success: true,
						operationType: "complete_task",
						targetId: taskId,
						details: `Задача с ID ${taskId} в проекте ${projectId}`,
					};

					return this.createSuccessResponse(
						responseData,
						`Задача с ID ${taskId} успешно завершена`
					);
				} catch (error) {
					this.logger.error("Failed to complete task", error);
					return this.createErrorResponse(
						error,
						`Ошибка при завершении задачи: ${error}`
					);
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

					const responseData: OperationResponseData = {
						success: true,
						operationType: "delete_task",
						targetId: taskId,
						details: `Задача с ID ${taskId} в проекте ${projectId}`,
					};

					return this.createSuccessResponse(
						responseData,
						`Задача с ID ${taskId} успешно удалена`
					);
				} catch (error) {
					this.logger.error("Failed to delete task", error);
					return this.createErrorResponse(
						error,
						`Ошибка при удалении задачи: ${error}`
					);
				}
			}
		);

		// Инструмент для получения задач на сегодня
		this.server.registerTool(
			"get_today_tasks",
			{
				title: "Получить задачи на сегодня",
				description: "Получить все задачи со сроком выполнения на сегодня",
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

					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const tomorrow = new Date(today);
					tomorrow.setDate(tomorrow.getDate() + 1);

					const todayTasks = [];

					for (const project of projects) {
						try {
							const projectData = await this.tickTickClient.getProjectWithData(
								project.id,
								token
							);

							const projectTodayTasks = projectData.tasks.filter((task) => {
								if (!task.dueDate || task.status === 2) return false; // Skip completed tasks

								const dueDate = new Date(task.dueDate);
								return dueDate >= today && dueDate < tomorrow;
							});

							todayTasks.push(...projectTodayTasks);
						} catch (error) {
							this.logger.warn(
								`Failed to get tasks for project ${project.id}`,
								error
							);
						}
					}

					const responseData: TodayTasksResponseData = {
						date: today.toISOString().split("T")[0],
						taskCount: todayTasks.length,
						tasks: todayTasks,
					};

					return this.createSuccessResponse(
						responseData,
						`Найдено ${todayTasks.length} задач на сегодня`
					);
				} catch (error) {
					this.logger.error("Failed to get today tasks", error);
					return this.createErrorResponse(
						error,
						`Ошибка при получении задач на сегодня: ${error}`
					);
				}
			}
		);

		// Инструмент для получения просроченных задач
		this.server.registerTool(
			"get_overdue_tasks",
			{
				title: "Получить просроченные задачи",
				description: "Получить все просроченные задачи",
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

					const now = new Date();
					now.setHours(0, 0, 0, 0);

					const overdueTasks = [];

					for (const project of projects) {
						try {
							const projectData = await this.tickTickClient.getProjectWithData(
								project.id,
								token
							);

							const projectOverdueTasks = projectData.tasks.filter((task) => {
								if (!task.dueDate || task.status === 2) return false; // Skip completed tasks

								const dueDate = new Date(task.dueDate);
								return dueDate < now;
							});

							overdueTasks.push(...projectOverdueTasks);
						} catch (error) {
							this.logger.warn(
								`Failed to get tasks for project ${project.id}`,
								error
							);
						}
					}

					const responseData: OverdueTasksResponseData = {
						currentDate: now.toISOString().split("T")[0],
						overdueCount: overdueTasks.length,
						tasks: overdueTasks,
					};

					return this.createSuccessResponse(
						responseData,
						`Найдено ${overdueTasks.length} просроченных задач`
					);
				} catch (error) {
					this.logger.error("Failed to get overdue tasks", error);
					return this.createErrorResponse(
						error,
						`Ошибка при получении просроченных задач: ${error}`
					);
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
					sortOrder: z
						.number()
						.optional()
						.describe("Порядок сортировки проекта"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ name, color, viewMode, sortOrder, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const project = await this.tickTickClient.createProject(
						{
							name,
							color,
							viewMode,
							sortOrder,
							kind: "TASK",
						},
						token
					);

					const responseData: CreateProjectResponseData = {
						project: project,
					};

					return this.createSuccessResponse(
						responseData,
						`Проект "${project.name}" успешно создан с ID: ${project.id}`
					);
				} catch (error) {
					this.logger.error("Failed to create project", error);
					return this.createErrorResponse(
						error,
						`Ошибка при создании проекта: ${error}`
					);
				}
			}
		);

		// Инструмент для обновления проекта
		this.server.registerTool(
			"update_project",
			{
				title: "Обновить проект",
				description: "Обновить существующий проект в TickTick",
				inputSchema: {
					projectId: z.string().describe("ID проекта"),
					name: z.string().optional().describe("Новое название проекта"),
					color: z
						.string()
						.optional()
						.describe("Новый цвет проекта (например, #FF0000)"),
					viewMode: z
						.enum(["list", "kanban", "timeline"])
						.optional()
						.describe("Новый режим отображения проекта"),
					sortOrder: z
						.number()
						.optional()
						.describe("Новый порядок сортировки проекта"),
					accessToken: z
						.string()
						.optional()
						.describe("Access token (если не указан, берется из env)"),
				},
			},
			async ({ projectId, name, color, viewMode, sortOrder, accessToken }) => {
				try {
					const token = this.getAccessToken(accessToken);
					const project = await this.tickTickClient.updateProject(
						projectId,
						{
							name,
							color,
							viewMode,
							sortOrder,
						},
						token
					);

					const responseData: CreateProjectResponseData = {
						project: project,
					};

					return this.createSuccessResponse(
						responseData,
						`Проект "${project.name}" успешно обновлен`
					);
				} catch (error) {
					this.logger.error("Failed to update project", error);
					return this.createErrorResponse(
						error,
						`Ошибка при обновлении проекта: ${error}`
					);
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

					const responseData: OperationResponseData = {
						success: true,
						operationType: "delete_project",
						targetId: projectId,
						details: `Проект с ID ${projectId}`,
					};

					return this.createSuccessResponse(
						responseData,
						`Проект с ID ${projectId} успешно удален`
					);
				} catch (error) {
					this.logger.error("Failed to delete project", error);
					return this.createErrorResponse(
						error,
						`Ошибка при удалении проекта: ${error}`
					);
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
				description: `Получить информацию о текущей конфигурации

Возвращает:
- Base URL сервера TickTick API
- Статус наличия access token в переменных окружения
- Версию MCP сервера

Пример ответа:
\`\`\`
Конфигурация TickTick MCP Server:
Base URL: https://api.ticktick.com/open/v1
Access Token в env: Да
Версия: 1.0.0
\`\`\``,
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

		// Динамический ресурс для проекта
		this.server.registerResource(
			"project_info",
			new ResourceTemplate("ticktick://project/{projectId}", {
				list: undefined,
			}),
			{
				title: "Информация о проекте",
				description: `Получить детальную информацию о конкретном проекте

Возвращает JSON с:
- Полной информацией о проекте (название, цвет, режим отображения и т.д.)
- URI ресурса
- Временной меткой запроса

Пример ответа:
\`\`\`json
{
  "project": {
    "id": "6226ff9877acee87727f6bca",
    "name": "Рабочие задачи",
    "color": "#F18181",
    "sortOrder": 0,
    "closed": false,
    "groupId": "6436176a47fd2e05f26ef56e",
    "viewMode": "list",
    "permission": "write",
    "kind": "TASK"
  },
  "uri": "ticktick://project/6226ff9877acee87727f6bca",
  "timestamp": "2025-01-09T10:09:00.000Z"
}
\`\`\``,
			},
			async (uri, { projectId }) => {
				try {
					const token = this.getAccessToken();
					const projectIdStr = Array.isArray(projectId)
						? projectId[0]
						: projectId;
					const project = await this.tickTickClient.getProject(
						projectIdStr,
						token
					);

					return {
						contents: [
							{
								uri: uri.href,
								text: JSON.stringify(
									{
										project: project,
										uri: uri.href,
										timestamp: new Date().toISOString(),
									},
									null,
									2
								),
								mimeType: "application/json",
							},
						],
					};
				} catch (error) {
					return {
						contents: [
							{
								uri: uri.href,
								text: `Ошибка при получении проекта ${projectId}: ${error}`,
							},
						],
					};
				}
			}
		);

		// Динамический ресурс для задач проекта
		this.server.registerResource(
			"project_tasks",
			new ResourceTemplate("ticktick://project/{projectId}/tasks", {
				list: undefined,
			}),
			{
				title: "Задачи проекта",
				description: `Получить все задачи конкретного проекта

Возвращает JSON с:
- Информацией о проекте
- Количеством задач в проекте
- Массивом всех задач проекта (включая подзадачи, напоминания и т.д.)
- URI ресурса и временной меткой

Пример ответа:
\`\`\`json
{
  "project": {
    "id": "6226ff9877acee87727f6bca",
    "name": "Рабочие задачи",
    "color": "#F18181"
  },
  "taskCount": 3,
  "tasks": [
    {
      "id": "6247ee29630c800f064fd145",
      "title": "Завершить отчет",
      "content": "Подготовить квартальный отчет",
      "dueDate": "2025-01-10T15:00:00+0000",
      "priority": 3,
      "status": 0,
      "items": [
        {
          "id": "6435074647fd2e6387145f20",
          "title": "Собрать данные",
          "status": 1
        }
      ]
    }
  ],
  "uri": "ticktick://project/6226ff9877acee87727f6bca/tasks",
  "timestamp": "2025-01-09T10:09:00.000Z"
}
\`\`\``,
			},
			async (uri, { projectId }) => {
				try {
					const token = this.getAccessToken();
					const projectIdStr = Array.isArray(projectId)
						? projectId[0]
						: projectId;
					const projectData = await this.tickTickClient.getProjectWithData(
						projectIdStr,
						token
					);

					return {
						contents: [
							{
								uri: uri.href,
								text: JSON.stringify(
									{
										project: projectData.project,
										taskCount: projectData.tasks.length,
										tasks: projectData.tasks,
										uri: uri.href,
										timestamp: new Date().toISOString(),
									},
									null,
									2
								),
								mimeType: "application/json",
							},
						],
					};
				} catch (error) {
					return {
						contents: [
							{
								uri: uri.href,
								text: `Ошибка при получении задач проекта ${projectId}: ${error}`,
							},
						],
					};
				}
			}
		);

		// Динамический ресурс для конкретной задачи
		this.server.registerResource(
			"task_info",
			new ResourceTemplate("ticktick://project/{projectId}/task/{taskId}", {
				list: undefined,
			}),
			{
				title: "Информация о задаче",
				description: `Получить детальную информацию о конкретной задаче

Возвращает JSON с:
- Полной информацией о задаче (название, описание, сроки, приоритет и т.д.)
- Подзадачами (если есть)
- Напоминаниями и правилами повторения
- URI ресурса и временной меткой

Пример ответа:
\`\`\`json
{
  "task": {
    "id": "6247ee29630c800f064fd145",
    "projectId": "6226ff9877acee87727f6bca",
    "title": "Завершить отчет",
    "content": "Подготовить квартальный отчет",
    "desc": "Включить данные за Q4",
    "dueDate": "2025-01-10T15:00:00+0000",
    "priority": 3,
    "status": 0,
    "timeZone": "Europe/Moscow",
    "reminders": ["TRIGGER:P0DT1H0M0S"],
    "items": [
      {
        "id": "6435074647fd2e6387145f20",
        "title": "Собрать данные",
        "status": 1,
        "completedTime": "2025-01-09T10:00:00+0000"
      }
    ]
  },
  "uri": "ticktick://project/6226ff9877acee87727f6bca/task/6247ee29630c800f064fd145",
  "timestamp": "2025-01-09T10:09:00.000Z"
}
\`\`\``,
			},
			async (uri, { projectId, taskId }) => {
				try {
					const token = this.getAccessToken();
					const projectIdStr = Array.isArray(projectId)
						? projectId[0]
						: projectId;
					const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId;
					const task = await this.tickTickClient.getTask(
						projectIdStr,
						taskIdStr,
						token
					);

					return {
						contents: [
							{
								uri: uri.href,
								text: JSON.stringify(
									{
										task: task,
										uri: uri.href,
										timestamp: new Date().toISOString(),
									},
									null,
									2
								),
								mimeType: "application/json",
							},
						],
					};
				} catch (error) {
					return {
						contents: [
							{
								uri: uri.href,
								text: `Ошибка при получении задачи ${taskId} из проекта ${projectId}: ${error}`,
							},
						],
					};
				}
			}
		);

		// Ресурс для статистики
		this.server.registerResource(
			"stats",
			new ResourceTemplate("ticktick://stats", { list: undefined }),
			{
				title: "Статистика TickTick",
				description: `Получить общую статистику по проектам и задачам

Возвращает JSON с:
- Общей статистикой (количество проектов, задач, выполненных, просроченных)
- Задачами на сегодня
- Детальной статистикой по каждому проекту
- URI ресурса и временной меткой

Пример ответа:
\`\`\`json
{
  "stats": {
    "totalProjects": 3,
    "totalTasks": 15,
    "completedTasks": 8,
    "pendingTasks": 7,
    "overdueTasksCount": 2,
    "todayTasksCount": 3,
    "projectStats": [
      {
        "projectId": "6226ff9877acee87727f6bca",
        "projectName": "Рабочие задачи",
        "totalTasks": 8,
        "completedTasks": 5,
        "pendingTasks": 3
      },
      {
        "projectId": "6226ff9877acee87727f6bcb",
        "projectName": "Личные дела",
        "totalTasks": 7,
        "completedTasks": 3,
        "pendingTasks": 4
      }
    ]
  },
  "uri": "ticktick://stats",
  "timestamp": "2025-01-09T10:09:00.000Z"
}
\`\`\``,
			},
			async (uri) => {
				try {
					const token = this.getAccessToken();
					const projects = await this.tickTickClient.getProjects(token);

					let totalTasks = 0;
					let completedTasks = 0;
					let pendingTasks = 0;
					let overdueTasksCount = 0;
					let todayTasksCount = 0;

					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const tomorrow = new Date(today);
					tomorrow.setDate(tomorrow.getDate() + 1);

					const projectStats = [];

					for (const project of projects) {
						try {
							const projectData = await this.tickTickClient.getProjectWithData(
								project.id,
								token
							);
							const tasks = projectData.tasks;

							const projectTotalTasks = tasks.length;
							const projectCompletedTasks = tasks.filter(
								(task) => task.status === 2
							).length;
							const projectPendingTasks =
								projectTotalTasks - projectCompletedTasks;

							// Подсчет просроченных и сегодняшних задач
							for (const task of tasks) {
								if (task.status === 2) continue; // Skip completed tasks

								if (task.dueDate) {
									const dueDate = new Date(task.dueDate);

									if (dueDate < today) {
										overdueTasksCount++;
									} else if (dueDate >= today && dueDate < tomorrow) {
										todayTasksCount++;
									}
								}
							}

							totalTasks += projectTotalTasks;
							completedTasks += projectCompletedTasks;
							pendingTasks += projectPendingTasks;

							projectStats.push({
								projectId: project.id,
								projectName: project.name,
								totalTasks: projectTotalTasks,
								completedTasks: projectCompletedTasks,
								pendingTasks: projectPendingTasks,
							});
						} catch (error) {
							this.logger.warn(
								`Failed to get stats for project ${project.id}`,
								error
							);
						}
					}

					const statsData: StatsResponseData = {
						totalProjects: projects.length,
						totalTasks,
						completedTasks,
						pendingTasks,
						overdueTasksCount,
						todayTasksCount,
						projectStats,
					};

					return {
						contents: [
							{
								uri: uri.href,
								text: JSON.stringify(
									{
										stats: statsData,
										uri: uri.href,
										timestamp: new Date().toISOString(),
									},
									null,
									2
								),
								mimeType: "application/json",
							},
						],
					};
				} catch (error) {
					return {
						contents: [
							{
								uri: uri.href,
								text: `Ошибка при получении статистики: ${error}`,
							},
						],
					};
				}
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
