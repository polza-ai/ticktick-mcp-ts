/**
 * Утилиты для валидации данных TickTick API
 */

/**
 * Проверяет, является ли строка валидной датой в формате ISO 8601
 */
export function validateISO8601Date(date: string): boolean {
	if (!date || typeof date !== "string") {
		return false;
	}

	// Проверяем формат ISO 8601: YYYY-MM-DDTHH:mm:ss+0000 или YYYY-MM-DDTHH:mm:ssZ
	const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{4}|Z)$/;

	if (!iso8601Regex.test(date)) {
		return false;
	}

	// Проверяем, что дата действительно валидна
	const parsedDate = new Date(date);
	return !isNaN(parsedDate.getTime());
}

/**
 * Преобразует Date объект или строку в формат ISO 8601, требуемый TickTick API
 */
export function formatDateToISO8601(date: Date | string): string {
	if (typeof date === "string") {
		if (validateISO8601Date(date)) {
			// Принудительно заменяем "Z" на "+0000" для совместимости с TickTick API
			return date.endsWith("Z") ? date.replace("Z", "+0000") : date;
		}
		// Пытаемся распарсить строку как дату
		const parsedDate = new Date(date);
		if (isNaN(parsedDate.getTime())) {
			throw new Error(`Невалидная дата: ${date}`);
		}
		date = parsedDate;
	}

	if (!(date instanceof Date)) {
		throw new Error("Дата должна быть объектом Date или строкой");
	}

	if (isNaN(date.getTime())) {
		throw new Error("Невалидная дата");
	}

	// Форматируем в ISO 8601 с UTC offset +0000
	return date.toISOString().replace("Z", "+0000");
}

/**
 * Валидирует временную зону
 */
export function validateTimeZone(timeZone: string): boolean {
	if (!timeZone || typeof timeZone !== "string") {
		return false;
	}

	try {
		// Проверяем, что временная зона валидна
		Intl.DateTimeFormat(undefined, { timeZone });
		return true;
	} catch {
		return false;
	}
}

/**
 * Валидирует приоритет задачи
 */
export function validatePriority(priority: number): boolean {
	return [0, 1, 3, 5].includes(priority);
}

/**
 * Валидирует статус задачи
 */
export function validateTaskStatus(status: number): boolean {
	return [0, 2].includes(status); // 0=Normal, 2=Completed
}

/**
 * Валидирует статус подзадачи
 */
export function validateSubtaskStatus(status: number): boolean {
	return [0, 1].includes(status); // 0=Normal, 1=Completed
}

/**
 * Валидирует цвет проекта (hex формат)
 */
export function validateProjectColor(color: string): boolean {
	if (!color || typeof color !== "string") {
		return false;
	}

	// Проверяем hex формат: #RRGGBB
	const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
	return hexColorRegex.test(color);
}

/**
 * Валидирует режим отображения проекта
 */
export function validateViewMode(viewMode: string): boolean {
	return ["list", "kanban", "timeline"].includes(viewMode);
}

/**
 * Валидирует тип проекта
 */
export function validateProjectKind(kind: string): boolean {
	return ["TASK", "NOTE"].includes(kind);
}
