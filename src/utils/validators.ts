/**
 * Утилиты для валидации данных TickTick API
 */

import {
	validateISO8601Date,
	formatDateToISO8601,
	validateTimeZone,
	validateDateRange,
	parseAndFormatDate,
	validateRRule,
	convertDateBetweenTimeZones,
	timestampToISO8601,
	iso8601ToTimestamp,
} from "./date-utils.js";

// Реэкспортируем функции из date-utils для обратной совместимости
export {
	validateISO8601Date,
	formatDateToISO8601,
	validateTimeZone,
	validateDateRange,
	parseAndFormatDate,
	validateRRule,
	convertDateBetweenTimeZones,
	timestampToISO8601,
	iso8601ToTimestamp,
};

/**
 * Валидирует даты задачи (startDate и dueDate)
 * @throws {Error} Если даты невалидны или startDate позже dueDate
 */
export function validateTaskDates(startDate?: string, dueDate?: string): void {
	// Если даты не указаны, считаем валидными
	if (!startDate && !dueDate) {
		return;
	}

	// Проверяем формат дат
	if (startDate && !validateISO8601Date(startDate)) {
		throw new Error(`Невалидный формат даты начала: ${startDate}`);
	}

	if (dueDate && !validateISO8601Date(dueDate)) {
		throw new Error(`Невалидный формат даты окончания: ${dueDate}`);
	}

	// Проверяем, что дата начала не позже даты окончания
	if (startDate && dueDate && !validateDateRange(startDate, dueDate)) {
		throw new Error(
			`Дата начала (${startDate}) позже даты окончания (${dueDate})`
		);
	}
}

/**
 * Валидирует правило повторения задачи
 * @throws {Error} Если правило повторения невалидно
 */
export function validateTaskRepeatFlag(repeatFlag?: string): void {
	if (!repeatFlag) {
		return;
	}

	if (!validateRRule(repeatFlag)) {
		throw new Error(`Невалидное правило повторения: ${repeatFlag}`);
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
