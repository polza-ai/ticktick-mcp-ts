// TickTick API Types - Simplified Version
// Убраны все OAuth и пользовательские типы, оставлены только API типы

// ============================================================================
// CORE API TYPES
// ============================================================================

export interface Task {
	id: string;
	projectId: string;
	title: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: string; // ISO 8601 format: "2019-11-13T03:00:00+0000"
	dueDate?: string; // ISO 8601 format: "2019-11-13T03:00:00+0000"
	timeZone?: string; // e.g., "America/Los_Angeles"
	reminders?: string[]; // e.g., ["TRIGGER:P0DT9H0M0S", "TRIGGER:PT0S"]
	repeatFlag?: string; // e.g., "RRULE:FREQ=DAILY;INTERVAL=1"
	priority?: number; // 0=None, 1=Low, 3=Medium, 5=High
	status?: number; // 0=Normal, 2=Completed
	completedTime?: string; // ISO 8601 format
	sortOrder?: number;
	items?: ChecklistItem[]; // Subtasks
}

export interface ChecklistItem {
	id: string;
	title: string;
	status: number; // 0=Normal, 1=Completed
	completedTime?: string; // ISO 8601 format
	isAllDay?: boolean;
	sortOrder?: number;
	startDate?: string; // ISO 8601 format
	timeZone?: string;
}

export interface Project {
	id: string;
	name: string;
	color?: string; // e.g., "#F18181"
	sortOrder?: number;
	closed?: boolean;
	groupId?: string;
	viewMode?: "list" | "kanban" | "timeline";
	permission?: "read" | "write" | "comment";
	kind?: "TASK" | "NOTE";
}

export interface Column {
	id: string;
	projectId: string;
	name: string;
	sortOrder: number;
}

export interface ProjectData {
	project: Project;
	tasks: Task[];
	columns: Column[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTaskRequest {
	title: string;
	projectId: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: string;
	dueDate?: string;
	timeZone?: string;
	reminders?: string[];
	repeatFlag?: string;
	priority?: number;
	sortOrder?: number;
	items?: Omit<ChecklistItem, "id">[];
}

export interface UpdateTaskRequest {
	id: string;
	projectId: string;
	title?: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: string;
	dueDate?: string;
	timeZone?: string;
	reminders?: string[];
	repeatFlag?: string;
	priority?: number;
	sortOrder?: number;
	items?: ChecklistItem[];
}

export interface CreateProjectRequest {
	name: string;
	color?: string;
	sortOrder?: number;
	viewMode?: "list" | "kanban" | "timeline";
	kind?: "TASK" | "NOTE";
}

export interface UpdateProjectRequest {
	name?: string;
	color?: string;
	sortOrder?: number;
	viewMode?: "list" | "kanban" | "timeline";
	kind?: "TASK" | "NOTE";
}

// ============================================================================
// MCP TOOL PARAMETERS
// ============================================================================

export interface GetProjectsParams {
	// No parameters needed
}

export interface GetProjectParams {
	projectId: string;
}

export interface GetProjectTasksParams {
	projectId: string;
}

export interface GetTaskParams {
	projectId: string;
	taskId: string;
}

export interface CreateTaskParams {
	title: string;
	projectId: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: string;
	dueDate?: string;
	timeZone?: string;
	reminders?: string[];
	repeatFlag?: string;
	priority?: "none" | "low" | "medium" | "high";
	sortOrder?: number;
	items?: Omit<ChecklistItem, "id">[];
}

export interface UpdateTaskParams {
	taskId: string;
	projectId: string;
	title?: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: string;
	dueDate?: string;
	timeZone?: string;
	reminders?: string[];
	repeatFlag?: string;
	priority?: "none" | "low" | "medium" | "high";
	sortOrder?: number;
	items?: ChecklistItem[];
}

export interface CompleteTaskParams {
	projectId: string;
	taskId: string;
}

export interface DeleteTaskParams {
	projectId: string;
	taskId: string;
}

export interface CreateProjectParams {
	name: string;
	color?: string;
	viewMode?: "list" | "kanban" | "timeline";
	sortOrder?: number;
}

export interface UpdateProjectParams {
	projectId: string;
	name?: string;
	color?: string;
	viewMode?: "list" | "kanban" | "timeline";
	sortOrder?: number;
}

export interface DeleteProjectParams {
	projectId: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Priority = "none" | "low" | "medium" | "high";

export const PRIORITY_MAP: Record<Priority, number> = {
	none: 0,
	low: 1,
	medium: 3,
	high: 5,
};

export const PRIORITY_REVERSE_MAP: Record<number, Priority> = {
	0: "none",
	1: "low",
	3: "medium",
	5: "high",
};

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface TickTickError {
	message: string;
	status?: number;
	code?: string;
}

export class TickTickApiError extends Error {
	public status?: number;
	public code?: string;

	constructor(message: string, status?: number, code?: string) {
		super(message);
		this.name = "TickTickApiError";
		this.status = status;
		this.code = code;
	}
}

// ============================================================================
// MCP RESPONSE TYPES
// ============================================================================

export interface McpResponse<T = any> {
	success: boolean;
	data?: T;
	message: string;
	error?: string;
	timestamp: string;
}

export interface ProjectsResponseData {
	count: number;
	projects: Project[];
}

export interface ProjectTasksResponseData {
	project: Project;
	taskCount: number;
	tasks: Task[];
}

export interface TaskResponseData {
	task: Task;
}

export interface CreateTaskResponseData {
	task: Task;
}

export interface CreateProjectResponseData {
	project: Project;
}

export interface OperationResponseData {
	success: boolean;
	operationType: string;
	targetId: string;
	details?: string;
}

export interface StatsResponseData {
	totalProjects: number;
	totalTasks: number;
	completedTasks: number;
	pendingTasks: number;
	overdueTasksCount: number;
	todayTasksCount: number;
	projectStats: {
		projectId: string;
		projectName: string;
		totalTasks: number;
		completedTasks: number;
		pendingTasks: number;
	}[];
}

export interface AllProjectsWithTasksResponseData {
	totalProjects: number;
	totalTasks: number;
	projectsWithTasks: ProjectData[];
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface TickTickClientConfig {
	baseUrl?: string;
	timeout?: number;
	accessToken?: string;
}
