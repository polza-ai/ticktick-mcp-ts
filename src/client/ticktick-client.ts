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

	constructor(config: TickTickClientConfig = {}) {
		this.baseUrl = config.baseUrl || "https://api.ticktick.com/open/v1";
		this.timeout = config.timeout || 10000;
	}

	/**
	 * Выполнить запрос к API с авторизацией
	 */
	private async makeAuthenticatedRequest<T>(
		endpoint: string,
		accessToken: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${accessToken}`,
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

			return response.json();
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
	async getProjects(accessToken: string): Promise<Project[]> {
		return this.makeAuthenticatedRequest<Project[]>("/project", accessToken);
	}

	/**
	 * Получить проект по ID
	 */
	async getProject(projectId: string, accessToken: string): Promise<Project> {
		return this.makeAuthenticatedRequest<Project>(
			`/project/${projectId}`,
			accessToken
		);
	}

	/**
	 * Получить проект с данными (включая задачи)
	 */
	async getProjectWithData(
		projectId: string,
		accessToken: string
	): Promise<ProjectData> {
		return this.makeAuthenticatedRequest<ProjectData>(
			`/project/${projectId}/data`,
			accessToken
		);
	}

	/**
	 * Создать новый проект
	 */
	async createProject(
		project: CreateProjectRequest,
		accessToken: string
	): Promise<Project> {
		return this.makeAuthenticatedRequest<Project>("/project", accessToken, {
			method: "POST",
			body: JSON.stringify(project),
		});
	}

	/**
	 * Обновить проект
	 */
	async updateProject(
		projectId: string,
		project: UpdateProjectRequest,
		accessToken: string
	): Promise<Project> {
		return this.makeAuthenticatedRequest<Project>(
			`/project/${projectId}`,
			accessToken,
			{
				method: "POST",
				body: JSON.stringify(project),
			}
		);
	}

	/**
	 * Удалить проект
	 */
	async deleteProject(projectId: string, accessToken: string): Promise<void> {
		await this.makeAuthenticatedRequest<void>(
			`/project/${projectId}`,
			accessToken,
			{
				method: "DELETE",
			}
		);
	}

	/**
	 * Получить задачу по ID
	 */
	async getTask(
		projectId: string,
		taskId: string,
		accessToken: string
	): Promise<Task> {
		return this.makeAuthenticatedRequest<Task>(
			`/project/${projectId}/task/${taskId}`,
			accessToken
		);
	}

	/**
	 * Создать новую задачу
	 */
	async createTask(
		task: CreateTaskRequest,
		accessToken: string
	): Promise<Task> {
		return this.makeAuthenticatedRequest<Task>("/task", accessToken, {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	/**
	 * Обновить задачу
	 */
	async updateTask(
		taskId: string,
		task: UpdateTaskRequest,
		accessToken: string
	): Promise<Task> {
		return this.makeAuthenticatedRequest<Task>(`/task/${taskId}`, accessToken, {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	/**
	 * Завершить задачу
	 */
	async completeTask(
		projectId: string,
		taskId: string,
		accessToken: string
	): Promise<void> {
		await this.makeAuthenticatedRequest<void>(
			`/project/${projectId}/task/${taskId}/complete`,
			accessToken,
			{
				method: "POST",
			}
		);
	}

	/**
	 * Удалить задачу
	 */
	async deleteTask(
		projectId: string,
		taskId: string,
		accessToken: string
	): Promise<void> {
		await this.makeAuthenticatedRequest<void>(
			`/project/${projectId}/task/${taskId}`,
			accessToken,
			{
				method: "DELETE",
			}
		);
	}
}
