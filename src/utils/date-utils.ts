/**
 * Утилиты для работы с датами, временем и часовыми поясами в TickTick API
 */

/**
 * Проверяет, является ли строка валидной датой в формате ISO 8601
 */
export function validateISO8601Date(date: string): boolean {
	if (!date || typeof date !== "string") {
		return false;
	}

	// Проверяем формат ISO 8601:
	// - YYYY-MM-DDTHH:mm:ss+0000 или YYYY-MM-DDTHH:mm:ssZ
	// - YYYY-MM-DDTHH:mm:ss.sss+0000 или YYYY-MM-DDTHH:mm:ss.sssZ (с миллисекундами)
	const iso8601Regex =
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{4}|Z)$/;

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
 * Преобразует Unix timestamp (в миллисекундах) в формат ISO 8601
 */
export function timestampToISO8601(timestamp: number): string {
	if (typeof timestamp !== "number" || isNaN(timestamp)) {
		throw new Error(`Невалидный timestamp: ${timestamp}`);
	}

	const date = new Date(timestamp);
	return formatDateToISO8601(date);
}

/**
 * Преобразует дату в формате ISO 8601 в Unix timestamp (в миллисекундах)
 */
export function iso8601ToTimestamp(isoDate: string): number {
	if (!validateISO8601Date(isoDate)) {
		throw new Error(`Невалидная ISO 8601 дата: ${isoDate}`);
	}

	return new Date(isoDate).getTime();
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
 * Проверяет, что дата начала не позже даты окончания
 */
export function validateDateRange(
	startDate: string | Date,
	dueDate: string | Date
): boolean {
	if (!startDate || !dueDate) {
		return true; // Если одна из дат не указана, считаем валидным
	}

	const start = typeof startDate === "string" ? new Date(startDate) : startDate;
	const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;

	if (isNaN(start.getTime()) || isNaN(due.getTime())) {
		throw new Error("Невалидные даты для проверки диапазона");
	}

	return start.getTime() <= due.getTime();
}

/**
 * Пытается распарсить дату из различных форматов
 * и преобразовать в ISO 8601
 */
export function parseAndFormatDate(dateStr: string, timeZone?: string): string {
	if (!dateStr) {
		throw new Error("Дата не может быть пустой");
	}

	// Если уже в формате ISO 8601, просто возвращаем
	if (validateISO8601Date(dateStr)) {
		return formatDateToISO8601(dateStr);
	}

	// Пытаемся распознать различные форматы дат

	// Формат DD.MM.YYYY или MM.DD.YYYY
	const dotFormat =
		/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
	const dotMatch = dateStr.match(dotFormat);

	if (dotMatch) {
		// Определяем, какой формат использован (день.месяц или месяц.день)
		// Для этого проверяем валидность обоих вариантов
		const [
			_,
			part1,
			part2,
			year,
			hours = "00",
			minutes = "00",
			seconds = "00",
		] = dotMatch;

		// Пробуем как DD.MM.YYYY
		const dateDMY = new Date(
			`${year}-${part2}-${part1}T${hours}:${minutes}:${seconds}${
				timeZone ? "" : "Z"
			}`
		);

		// Пробуем как MM.DD.YYYY
		const dateMDY = new Date(
			`${year}-${part1}-${part2}T${hours}:${minutes}:${seconds}${
				timeZone ? "" : "Z"
			}`
		);

		// Выбираем более вероятный вариант (оба валидны - используем MM.DD.YYYY,
		// так как это стандарт в API)
		if (!isNaN(dateDMY.getTime()) && !isNaN(dateMDY.getTime())) {
			// Если обе даты валидны, предпочитаем формат DD.MM.YYYY, если день ≤ 12
			if (parseInt(part1) <= 12) {
				return formatDateToISO8601(dateMDY);
			} else {
				return formatDateToISO8601(dateDMY);
			}
		} else if (!isNaN(dateDMY.getTime())) {
			return formatDateToISO8601(dateDMY);
		} else if (!isNaN(dateMDY.getTime())) {
			return formatDateToISO8601(dateMDY);
		}
	}

	// Формат YYYY-MM-DD
	const dashFormat =
		/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
	const dashMatch = dateStr.match(dashFormat);

	if (dashMatch) {
		const [_, year, month, day, hours = "00", minutes = "00", seconds = "00"] =
			dashMatch;
		const date = new Date(
			`${year}-${month.padStart(2, "0")}-${day.padStart(
				2,
				"0"
			)}T${hours.padStart(2, "0")}:${minutes.padStart(
				2,
				"0"
			)}:${seconds.padStart(2, "0")}${timeZone ? "" : "Z"}`
		);

		if (!isNaN(date.getTime())) {
			return formatDateToISO8601(date);
		}
	}

	// Если не удалось распознать формат, пытаемся использовать стандартный парсер
	const date = new Date(dateStr);
	if (!isNaN(date.getTime())) {
		return formatDateToISO8601(date);
	}

	throw new Error(`Не удалось распознать формат даты: ${dateStr}`);
}

/**
 * Валидирует правило повторения в формате RRULE
 */
export function validateRRule(rrule: string): boolean {
	if (!rrule || typeof rrule !== "string") {
		return false;
	}

	// Базовая проверка на формат RRULE
	if (!rrule.startsWith("RRULE:")) {
		return false;
	}

	// Проверяем наличие обязательного параметра FREQ
	if (!rrule.includes("FREQ=")) {
		return false;
	}

	// Проверяем поддерживаемые значения FREQ
	const freqMatch = rrule.match(/FREQ=([^;]+)/);
	if (freqMatch) {
		const freq = freqMatch[1];
		if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) {
			return false;
		}
	}

	// Проверяем корректность INTERVAL, если он указан
	const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
	if (intervalMatch) {
		const interval = parseInt(intervalMatch[1]);
		if (isNaN(interval) || interval < 1) {
			return false;
		}
	}

	// Проверяем корректность COUNT, если он указан
	const countMatch = rrule.match(/COUNT=(\d+)/);
	if (countMatch) {
		const count = parseInt(countMatch[1]);
		if (isNaN(count) || count < 1) {
			return false;
		}
	}

	// Проверяем корректность UNTIL, если он указан
	const untilMatch = rrule.match(/UNTIL=([^;]+)/);
	if (untilMatch) {
		const until = untilMatch[1];
		// Формат UNTIL должен быть YYYYMMDDTHHMMSSZ
		const untilRegex = /^\d{8}T\d{6}Z$/;
		if (!untilRegex.test(until)) {
			return false;
		}
	}

	// Проверяем корректность BYDAY, если он указан
	const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
	if (bydayMatch) {
		const byday = bydayMatch[1].split(",");
		const validDays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
		for (const day of byday) {
			// Проверяем, что день недели валидный
			if (!validDays.includes(day)) {
				return false;
			}
		}
	}

	// Проверяем корректность BYMONTHDAY, если он указан
	const bymonthdayMatch = rrule.match(/BYMONTHDAY=([^;]+)/);
	if (bymonthdayMatch) {
		const bymonthday = bymonthdayMatch[1].split(",");
		for (const day of bymonthday) {
			const dayNum = parseInt(day);
			// Дни месяца должны быть от -31 до -1 или от 1 до 31
			if (isNaN(dayNum) || dayNum > 31 || dayNum < -31 || dayNum === 0) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Конвертирует дату между часовыми поясами
 */
export function convertDateBetweenTimeZones(
	date: Date | string,
	fromTimeZone: string,
	toTimeZone: string
): Date {
	if (!validateTimeZone(fromTimeZone) || !validateTimeZone(toTimeZone)) {
		throw new Error(`Невалидные часовые пояса: ${fromTimeZone}, ${toTimeZone}`);
	}

	const dateObj = typeof date === "string" ? new Date(date) : date;

	if (isNaN(dateObj.getTime())) {
		throw new Error(`Невалидная дата: ${date}`);
	}

	// Получаем смещение для исходного часового пояса
	const fromOffset = getTimeZoneOffset(dateObj, fromTimeZone);

	// Получаем смещение для целевого часового пояса
	const toOffset = getTimeZoneOffset(dateObj, toTimeZone);

	// Вычисляем разницу в миллисекундах
	const offsetDiff = toOffset - fromOffset;

	// Создаем новую дату с учетом разницы часовых поясов
	return new Date(dateObj.getTime() - offsetDiff);
}

/**
 * Получает смещение часового пояса в миллисекундах для указанной даты
 */
function getTimeZoneOffset(date: Date, timeZone: string): number {
	// Форматируем дату в указанном часовом поясе
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hour12: false,
	});

	// Получаем компоненты даты в указанном часовом поясе
	const parts = formatter.formatToParts(date);

	// Создаем объект с компонентами даты
	const dateComponents: Record<string, number> = {};
	parts.forEach((part) => {
		if (part.type !== "literal") {
			dateComponents[part.type] = parseInt(part.value);
		}
	});

	// Создаем новую дату в UTC на основе компонентов
	const utcDate = Date.UTC(
		dateComponents.year,
		dateComponents.month - 1,
		dateComponents.day,
		dateComponents.hour,
		dateComponents.minute,
		dateComponents.second
	);

	// Вычисляем разницу между UTC и локальным временем
	return date.getTime() - utcDate;
}
