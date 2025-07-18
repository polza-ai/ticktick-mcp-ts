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
	 * Выполнить запрос к API с авторизацией
	 */
	private async makeAuthenticatedRequest<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
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

			if (!response.ok) {
				const errorText = await response.text();
				this.logger.error(
					`API request failed: ${response.status} ${response.statusText}`,
					errorText
				);
				throw new TickTickApiError(
					`API request failed: ${response.status} ${response.statusText}`,
					response.status
				);
			}

			// Проверяем, есть ли содержимое в ответе
			const contentLength = response.headers.get("content-length");
			const contentType = response.headers.get("content-type");

			// Если нет содержимого или это не JSON, возвращаем undefined
			if (contentLength === "0" || !contentType?.includes("application/json")) {
				return undefined as T;
			}

			const text = await response.text();
			if (!text.trim()) {
				return undefined as T;
			}

			return JSON.parse(text);
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof TickTickApiError) {
				throw error;
			}
			this.logger.error("Request failed", error);
			throw new TickTickApiError(`Request failed: ${error}`);
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
	 * Создать новый проект
	 */
	async createProject(project: CreateProjectRequest): Promise<Project> {
		return this.makeAuthenticatedRequest<Project>("/project", {
			method: "POST",
			body: JSON.stringify(project),
		});
	}

	/**
	 * Обновить проект
	 */
	async updateProject(
		projectId: string,
		project: UpdateProjectRequest
	): Promise<Project> {
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
	 * Создать новую задачу
	 */
	async createTask(task: CreateTaskRequest): Promise<Task> {
		return this.makeAuthenticatedRequest<Task>("/task", {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	/**
	 * Обновить задачу
	 */
	async updateTask(taskId: string, task: UpdateTaskRequest): Promise<Task> {
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
				projectsWithData.push(projectData);
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
