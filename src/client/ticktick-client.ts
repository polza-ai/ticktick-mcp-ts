import {
	Task,
	Project,
	ProjectData,
	TickTickClientConfig,
	CreateTaskRequest,
	UpdateTaskRequest,
	CreateProjectRequest,
	UpdateProjectRequest,
	TickTickApiError,
	TickTickErrorCode,
	TickTickValidationError,
} from "../types/ticktick.js";
import {
	validateISO8601Date,
	formatDateToISO8601,
	validateTimeZone,
	validatePriority,
	validateProjectColor,
	validateViewMode,
	validateProjectKind,
} from "../utils/validators.js";

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

export class TickTickClient {
	private readonly logger = new Logger(TickTickClient.name);
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly accessToken: string;

	constructor(config: TickTickClientConfig = {}) {
		this.baseUrl = config.baseUrl || "https://api.ticktick.com/open/v1";
		this.timeout = config.timeout || 10000;

		if (!config.accessToken) {
			throw new Error("Access token обязателен для создания TickTickClient");
		}
		this.accessToken = config.accessToken;
	}

	/**
	 * Выполнить запрос к API с авторизацией, retry логикой и улучшенной обработкой ошибок
	 */
	private async makeAuthenticatedRequest<T>(
		endpoint: string,
		options: RequestInit = {},
		retryCount: number = 0
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const maxRetries = 3;
		const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			this.logger.log(`Making request to ${endpoint}`, {
				method: options.method || "GET",
				retryCount,
			});

			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${this.accessToken}`,
					"Content-Type": "application/json",
					...options.headers,
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			// Обработка различных HTTP статусов
			if (!response.ok) {
				let errorDetails: any = null;
				let errorText = "";

				try {
					errorText = await response.text();
					if (errorText) {
						try {
							errorDetails = JSON.parse(errorText);
						} catch {
							// Если не JSON, оставляем как текст
							errorDetails = { message: errorText };
						}
					}
				} catch {
					// Игнорируем ошибки чтения тела ответа
				}

				this.logger.error(
					`API request failed: ${response.status} ${response.statusText}`,
					{ endpoint, errorDetails, retryCount }
				);

				// Создаем более информативное сообщение об ошибке
				let enhancedMessage = "";
				if (response.status === 404) {
					if (endpoint.includes("/project/") && endpoint.includes("/task/")) {
						const pathParts = endpoint.split("/");
						const projectId = pathParts[2];
						const taskId = pathParts[4];
						enhancedMessage = `Задача с ID "${taskId}" не найдена в проекте "${projectId}". Проверьте правильность ID или используйте get_all_projects_with_tasks для получения актуальных ID.`;
					} else if (endpoint.includes("/project/")) {
						const projectId = endpoint.split("/")[2];
						enhancedMessage = `Проект с ID "${projectId}" не найден. Используйте get_projects для получения списка доступных проектов.`;
					} else {
						enhancedMessage = "Ресурс не найден. Проверьте правильность ID.";
					}
				} else if (
					response.status === 500 &&
					errorDetails?.errorCode === "unknown_exception"
				) {
					if (endpoint.includes("/project/") && endpoint.includes("/task/")) {
						const pathParts = endpoint.split("/");
						const projectId = pathParts[2];
						const taskId = pathParts[4];
						enhancedMessage = `Внутренняя ошибка сервера при работе с задачей "${taskId}" в проекте "${projectId}". Возможные причины: неверный ID проекта или задачи, задача уже завершена, или нет прав доступа. Используйте get_all_projects_with_tasks для проверки актуальных ID.`;
					} else {
						enhancedMessage =
							"Внутренняя ошибка сервера. Проверьте правильность параметров запроса.";
					}
				}

				const apiError = TickTickApiError.fromHttpStatus(
					response.status,
					enhancedMessage || undefined,
					errorDetails
				);

				// Retry для retryable ошибок, но не для 404 и некоторых 500 ошибок
				const shouldRetry =
					apiError.isRetryable() &&
					response.status !== 404 &&
					!(
						response.status === 500 &&
						errorDetails?.errorCode === "unknown_exception"
					);

				if (shouldRetry && retryCount < maxRetries) {
					this.logger.warn(
						`Retrying request to ${endpoint} in ${retryDelay}ms (attempt ${
							retryCount + 1
						}/${maxRetries})`
					);
					await new Promise((resolve) => setTimeout(resolve, retryDelay));
					return this.makeAuthenticatedRequest(
						endpoint,
						options,
						retryCount + 1
					);
				}

				throw apiError;
			}

			// Обработка успешных ответов
			const contentLength = response.headers.get("content-length");
			const contentType = response.headers.get("content-type");

			// Для методов DELETE и некоторых POST (complete) API возвращает пустой ответ
			if (
				response.status === 204 ||
				contentLength === "0" ||
				(!contentType?.includes("application/json") &&
					!contentType?.includes("text/"))
			) {
				this.logger.log(
					`Request to ${endpoint} completed successfully (no content)`
				);
				return undefined as T;
			}

			const text = await response.text();
			if (!text.trim()) {
				this.logger.log(
					`Request to ${endpoint} completed successfully (empty response)`
				);
				return undefined as T;
			}

			try {
				const result = JSON.parse(text);
				this.logger.log(`Request to ${endpoint} completed successfully`);
				return result;
			} catch (parseError) {
				this.logger.error("Failed to parse JSON response", {
					endpoint,
					responseText: text.substring(0, 200),
					parseError,
				});
				throw new TickTickApiError(
					"Ошибка парсинга ответа сервера",
					response.status,
					TickTickErrorCode.SERVER_ERROR,
					{ parseError, responseText: text.substring(0, 200) }
				);
			}
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof TickTickApiError) {
				throw error;
			}

			// Обработка network/timeout ошибок
			let errorCode = TickTickErrorCode.NETWORK_ERROR;
			let errorMessage = "Ошибка сети";
			let retryable = false;

			const errorObj = error as any;
			const errorName = errorObj?.name || "UnknownError";
			const errorMsg = errorObj?.message || String(error);

			if (errorName === "AbortError") {
				errorCode = TickTickErrorCode.TIMEOUT_ERROR;
				errorMessage = `Превышено время ожидания (${this.timeout}ms)`;
				retryable = true;
			} else if (errorMsg?.includes("fetch")) {
				retryable = true;
			}

			this.logger.error("Request failed", {
				endpoint,
				error: errorMsg,
				retryCount,
			});

			const networkError = new TickTickApiError(
				`${errorMessage}: ${errorMsg}`,
				undefined,
				errorCode,
				{ originalError: errorMsg },
				retryable
			);

			// Retry для network ошибок
			if (retryable && retryCount < maxRetries) {
				this.logger.warn(
					`Retrying request to ${endpoint} in ${retryDelay}ms (attempt ${
						retryCount + 1
					}/${maxRetries})`
				);
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
				return this.makeAuthenticatedRequest(endpoint, options, retryCount + 1);
			}

			throw networkError;
		}
	}

	/**
	 * Получить все проекты пользователя
	 */
	async getProjects(): Promise<Project[]> {
		return this.makeAuthenticatedRequest<Project[]>("/project");
	}

	/**
	 * Получить проект по ID
	 */
	async getProject(projectId: string): Promise<Project> {
		return this.makeAuthenticatedRequest<Project>(`/project/${projectId}`);
	}

	/**
	 * Получить проект с данными (включая задачи)
	 */
	async getProjectWithData(projectId: string): Promise<ProjectData> {
		return this.makeAuthenticatedRequest<ProjectData>(
			`/project/${projectId}/data`
		);
	}

	/**
	 * Создать новый проект с валидацией
	 */
	async createProject(project: CreateProjectRequest): Promise<Project> {
		// Валидация обязательных полей
		if (!project.name?.trim()) {
			throw new TickTickValidationError("Название проекта обязательно");
		}

		// Валидация цвета
		if (project.color && !validateProjectColor(project.color)) {
			throw new TickTickValidationError(
				`Невалидный цвет проекта: ${project.color}. Ожидается формат #RRGGBB`,
				{ field: "color", value: project.color }
			);
		}

		// Валидация режима отображения
		if (project.viewMode && !validateViewMode(project.viewMode)) {
			throw new TickTickValidationError(
				`Невалидный режим отображения: ${project.viewMode}. Допустимые значения: list, kanban, timeline`,
				{ field: "viewMode", value: project.viewMode }
			);
		}

		// Валидация типа проекта
		if (project.kind && !validateProjectKind(project.kind)) {
			throw new TickTickValidationError(
				`Невалидный тип проекта: ${project.kind}. Допустимые значения: TASK, NOTE`,
				{ field: "kind", value: project.kind }
			);
		}

		return this.makeAuthenticatedRequest<Project>("/project", {
			method: "POST",
			body: JSON.stringify(project),
		});
	}

	/**
	 * Обновить проект с валидацией
	 */
	async updateProject(
		projectId: string,
		project: UpdateProjectRequest
	): Promise<Project> {
		// Валидация ID проекта
		if (!projectId?.trim()) {
			throw new TickTickValidationError("ID проекта обязателен");
		}

		// Валидация названия (если указано)
		if (project.name !== undefined && !project.name?.trim()) {
			throw new TickTickValidationError(
				"Название проекта не может быть пустым"
			);
		}

		// Валидация цвета
		if (project.color && !validateProjectColor(project.color)) {
			throw new TickTickValidationError(
				`Невалидный цвет проекта: ${project.color}. Ожидается формат #RRGGBB`,
				{ field: "color", value: project.color }
			);
		}

		// Валидация режима отображения
		if (project.viewMode && !validateViewMode(project.viewMode)) {
			throw new TickTickValidationError(
				`Невалидный режим отображения: ${project.viewMode}. Допустимые значения: list, kanban, timeline`,
				{ field: "viewMode", value: project.viewMode }
			);
		}

		// Валидация типа проекта
		if (project.kind && !validateProjectKind(project.kind)) {
			throw new TickTickValidationError(
				`Невалидный тип проекта: ${project.kind}. Допустимые значения: TASK, NOTE`,
				{ field: "kind", value: project.kind }
			);
		}

		return this.makeAuthenticatedRequest<Project>(`/project/${projectId}`, {
			method: "POST",
			body: JSON.stringify(project),
		});
	}

	/**
	 * Удалить проект
	 */
	async deleteProject(projectId: string): Promise<void> {
		await this.makeAuthenticatedRequest<void>(`/project/${projectId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Получить задачу по ID
	 */
	async getTask(projectId: string, taskId: string): Promise<Task> {
		return this.makeAuthenticatedRequest<Task>(
			`/project/${projectId}/task/${taskId}`
		);
	}

	/**
	 * Создать новую задачу с валидацией
	 */
	async createTask(task: CreateTaskRequest): Promise<Task> {
		// Валидация обязательных полей
		if (!task.title?.trim()) {
			throw new TickTickValidationError("Название задачи обязательно");
		}

		if (!task.projectId?.trim()) {
			throw new TickTickValidationError("ID проекта обязателен");
		}

		// Валидация и нормализация дат
		if (task.startDate) {
			try {
				task.startDate = formatDateToISO8601(task.startDate);
			} catch (error) {
				throw new TickTickValidationError(
					`Невалидная дата начала: ${task.startDate}`,
					{ field: "startDate", value: task.startDate }
				);
			}
		}

		if (task.dueDate) {
			try {
				task.dueDate = formatDateToISO8601(task.dueDate);
			} catch (error) {
				throw new TickTickValidationError(
					`Невалидная дата окончания: ${task.dueDate}`,
					{ field: "dueDate", value: task.dueDate }
				);
			}
		}

		// Валидация временной зоны
		if (task.timeZone && !validateTimeZone(task.timeZone)) {
			throw new TickTickValidationError(
				`Невалидная временная зона: ${task.timeZone}`,
				{ field: "timeZone", value: task.timeZone }
			);
		}

		// Валидация приоритета
		if (task.priority !== undefined && !validatePriority(task.priority)) {
			throw new TickTickValidationError(
				`Невалидный приоритет: ${task.priority}. Допустимые значения: 0, 1, 3, 5`,
				{ field: "priority", value: task.priority }
			);
		}

		// Валидация подзадач
		if (task.items) {
			for (let i = 0; i < task.items.length; i++) {
				const item = task.items[i];
				if (!item.title?.trim()) {
					throw new TickTickValidationError(
						`Название подзадачи ${i + 1} обязательно`,
						{ field: `items[${i}].title`, value: item.title }
					);
				}

				if (item.startDate) {
					try {
						item.startDate = formatDateToISO8601(item.startDate);
					} catch (error) {
						throw new TickTickValidationError(
							`Невалидная дата начала подзадачи ${i + 1}: ${item.startDate}`,
							{ field: `items[${i}].startDate`, value: item.startDate }
						);
					}
				}

				if (item.timeZone && !validateTimeZone(item.timeZone)) {
					throw new TickTickValidationError(
						`Невалидная временная зона подзадачи ${i + 1}: ${item.timeZone}`,
						{ field: `items[${i}].timeZone`, value: item.timeZone }
					);
				}
			}
		}

		return this.makeAuthenticatedRequest<Task>("/task", {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	/**
	 * Обновить задачу с валидацией
	 */
	async updateTask(taskId: string, task: UpdateTaskRequest): Promise<Task> {
		// Валидация обязательных полей
		if (!taskId?.trim()) {
			throw new TickTickValidationError("ID задачи обязателен");
		}

		if (!task.id?.trim()) {
			throw new TickTickValidationError("ID задачи в теле запроса обязателен");
		}

		if (!task.projectId?.trim()) {
			throw new TickTickValidationError("ID проекта обязателен");
		}

		// Валидация и нормализация дат
		if (task.startDate) {
			try {
				task.startDate = formatDateToISO8601(task.startDate);
			} catch (error) {
				throw new TickTickValidationError(
					`Невалидная дата начала: ${task.startDate}`,
					{ field: "startDate", value: task.startDate }
				);
			}
		}

		if (task.dueDate) {
			try {
				task.dueDate = formatDateToISO8601(task.dueDate);
			} catch (error) {
				throw new TickTickValidationError(
					`Невалидная дата окончания: ${task.dueDate}`,
					{ field: "dueDate", value: task.dueDate }
				);
			}
		}

		// Валидация временной зоны
		if (task.timeZone && !validateTimeZone(task.timeZone)) {
			throw new TickTickValidationError(
				`Невалидная временная зона: ${task.timeZone}`,
				{ field: "timeZone", value: task.timeZone }
			);
		}

		// Валидация приоритета
		if (task.priority !== undefined && !validatePriority(task.priority)) {
			throw new TickTickValidationError(
				`Невалидный приоритет: ${task.priority}. Допустимые значения: 0, 1, 3, 5`,
				{ field: "priority", value: task.priority }
			);
		}

		// Валидация подзадач
		if (task.items) {
			for (let i = 0; i < task.items.length; i++) {
				const item = task.items[i];
				if (!item.id?.trim()) {
					throw new TickTickValidationError(
						`ID подзадачи ${i + 1} обязателен для обновления`,
						{ field: `items[${i}].id`, value: item.id }
					);
				}

				if (!item.title?.trim()) {
					throw new TickTickValidationError(
						`Название подзадачи ${i + 1} обязательно`,
						{ field: `items[${i}].title`, value: item.title }
					);
				}

				if (item.startDate) {
					try {
						item.startDate = formatDateToISO8601(item.startDate);
					} catch (error) {
						throw new TickTickValidationError(
							`Невалидная дата начала подзадачи ${i + 1}: ${item.startDate}`,
							{ field: `items[${i}].startDate`, value: item.startDate }
						);
					}
				}

				if (item.timeZone && !validateTimeZone(item.timeZone)) {
					throw new TickTickValidationError(
						`Невалидная временная зона подзадачи ${i + 1}: ${item.timeZone}`,
						{ field: `items[${i}].timeZone`, value: item.timeZone }
					);
				}
			}
		}

		return this.makeAuthenticatedRequest<Task>(`/task/${taskId}`, {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	/**
	 * Завершить задачу
	 */
	async completeTask(projectId: string, taskId: string): Promise<void> {
		await this.makeAuthenticatedRequest<void>(
			`/project/${projectId}/task/${taskId}/complete`,
			{
				method: "POST",
			}
		);
	}

	/**
	 * Удалить задачу
	 */
	async deleteTask(projectId: string, taskId: string): Promise<void> {
		await this.makeAuthenticatedRequest<void>(
			`/project/${projectId}/task/${taskId}`,
			{
				method: "DELETE",
			}
		);
	}

	/**
	 * Получить все проекты с их задачами
	 */
	async getAllProjectsWithTasks(): Promise<ProjectData[]> {
		const projects = await this.getProjects();
		const projectsWithData: ProjectData[] = [];

		for (const project of projects) {
			try {
				const projectData = await this.getProjectWithData(project.id);

				// Обрезаем content задач для экономии места
				const truncatedTasks = projectData.tasks.map((task) => ({
					...task,
					content:
						task.content && task.content.length > 200
							? task.content.substring(0, 200) + "..."
							: task.content,
				}));

				projectsWithData.push({
					...projectData,
					tasks: truncatedTasks,
				});
			} catch (error) {
				this.logger.warn(
					`Failed to get data for project ${project.id} (${project.name})`,
					error
				);
				// Добавляем проект без задач в случае ошибки
				projectsWithData.push({
					project: project,
					tasks: [],
					columns: [],
				});
			}
		}

		return projectsWithData;
	}
}
