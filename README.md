# TickTick MCP Server (TypeScript)

Cервер [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) для интеграции с TickTick API, написанный на TypeScript.

## Возможности

- 🔑 **Простая авторизация** - используйте access token из переменных окружения или передавайте в каждом запросе
- 📋 **Управление проектами** - создание, просмотр и удаление проектов
- ✅ **Управление задачами** - создание, обновление, завершение и удаление задач
- 🛠️ **Отдельный скрипт для получения токена** - простой способ получить access token
- 📊 **Информация о конфигурации** - просмотр текущих настроек через ресурсы
- 🔌 **Бесшовная интеграция с Claude** и другими MCP клиентами

## Предварительные требования

- Node.js 18 или выше
- npm или yarn
- TickTick API credentials (Client ID, Client Secret)

## Установка

1. **Клонируйте репозиторий**:
```bash
git clone <repository-url>
cd ticktick-mcp-ts
```

2. **Установите зависимости**:
```bash
npm install
```

3. **Соберите проект**:
```bash
npm run build
```

## Аутентификация с TickTick

Этот сервер использует OAuth2 для аутентификации с TickTick. Процесс настройки простой:

### Шаг 1: Регистрация приложения

1. Зарегистрируйте ваше приложение в [TickTick Developer Center](https://developer.ticktick.com/manage)
   - Установите redirect URI как `http://localhost:8080/callback`
   - Запишите ваш Client ID и Client Secret

### Шаг 2: Настройка переменных окружения

2. Создайте файл `.env` на основе `.env.example`:

```env
# TickTick API credentials (ТОЛЬКО для получения access token)
# Получите их на https://developer.ticktick.com/manage
TICKTICK_CLIENT_ID=your_client_id_here
TICKTICK_CLIENT_SECRET=your_client_secret_here

# TickTick Access Token (ОБЯЗАТЕЛЬНО для работы)
# Получите его запустив 'npm run get-token'
TICKTICK_ACCESS_TOKEN=your_access_token_here

# TickTick API endpoints (значения по умолчанию)
TICKTICK_BASE_URL=https://api.ticktick.com/open/v1
TICKTICK_AUTH_URL=https://ticktick.com/oauth/authorize
TICKTICK_TOKEN_URL=https://ticktick.com/oauth/token

# Для Dida365 (китайская версия), раскомментируйте и используйте вместо:
# TICKTICK_BASE_URL=https://api.dida365.com/open/v1
# TICKTICK_AUTH_URL=https://dida365.com/oauth/authorize
# TICKTICK_TOKEN_URL=https://dida365.com/oauth/token
```

### Шаг 3: Получение токена доступа

3. Запустите процесс аутентификации:
```bash
npm run get-token
```

Это:
- Запустит локальный сервер на порту 8080
- Откроет окно браузера для входа в TickTick
- Автоматически сохранит ваши токены доступа в файл `.env`

### Шаг 4: Тестирование конфигурации

4. Протестируйте вашу конфигурацию:
```bash
npm test
```

Это проверит, что ваши учетные данные TickTick работают корректно и покажет реальные данные из вашего аккаунта.

## Аутентификация с Dida365

[滴答清单 - Dida365](https://dida365.com/home) - это китайская версия TickTick, и процесс аутентификации аналогичен TickTick:

1. Зарегистрируйте ваше приложение в [Dida365 Developer Center](https://developer.dida365.com/manage)
   - Установите redirect URI как `http://localhost:8080/callback`
   - Запишите ваш Client ID и Client Secret

2. Добавьте переменные окружения в ваш файл `.env`:
   ```env
   TICKTICK_BASE_URL=https://api.dida365.com/open/v1
   TICKTICK_AUTH_URL=https://dida365.com/oauth/authorize
   TICKTICK_TOKEN_URL=https://dida365.com/oauth/token
   ```

3. Следуйте тем же шагам аутентификации, что и для TickTick

## Использование с Claude for Desktop

1. Установите [Claude for Desktop](https://claude.ai/download)

2. Отредактируйте файл конфигурации Claude for Desktop:

   **macOS**:
   ```bash
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   **Windows**:
   ```bash
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

3. Добавьте конфигурацию TickTick MCP сервера, используя абсолютные пути:
   ```json
   {
      "mcpServers": {
         "ticktick": {
            "command": "node",
            "args": ["/absolute/path/to/ticktick-mcp-ts/dist/index.js"],
            "env": {
              "TICKTICK_ACCESS_TOKEN": "your_access_token_here",
              "TICKTICK_BASE_URL": "https://api.ticktick.com/open/v1"
            }
         }
      }
   }
   ```

4. Перезапустите Claude for Desktop

После подключения вы увидите инструменты TickTick MCP сервера доступными в Claude, обозначенные иконкой 🔨 (tools).

## Доступные MCP инструменты

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `get_projects` | Список всех ваших TickTick проектов | `accessToken` (опционально) |
| `get_project_tasks` | Список всех задач в проекте | `projectId`, `accessToken` (опционально) |
| `get_task` | Получить детали конкретной задачи | `projectId`, `taskId`, `accessToken` (опционально) |
| `create_task` | Создать новую задачу | `title`, `projectId`, `content` (опционально), `dueDate` (опционально), `priority` (опционально), `accessToken` (опционально) |
| `update_task` | Обновить существующую задачу | `taskId`, `projectId`, `title` (опционально), `content` (опционально), `dueDate` (опционально), `priority` (опционально), `accessToken` (опционально) |
| `complete_task` | Отметить задачу как выполненную | `projectId`, `taskId`, `accessToken` (опционально) |
| `delete_task` | Удалить задачу | `projectId`, `taskId`, `accessToken` (опционально) |
| `create_project` | Создать новый проект | `name`, `color` (опционально), `viewMode` (опционально), `accessToken` (опционально) |
| `delete_project` | Удалить проект | `projectId`, `accessToken` (опционально) |

**Примечание**: Все инструменты поддерживают опциональный параметр `accessToken`. Если он не указан, используется значение из переменной окружения `TICKTICK_ACCESS_TOKEN`.

## Примеры запросов для Claude

Вот несколько примеров запросов для использования с Claude после подключения TickTick MCP сервера:

### Базовые операции
- "Покажи мне все мои проекты TickTick"
- "Создай новую задачу 'Закончить документацию MCP сервера' в моем рабочем проекте с высоким приоритетом"
- "Покажи все задачи в моем личном проекте"
- "Отметь задачу 'Купить продукты' как выполненную"
- "Создай новый проект 'Планирование отпуска' с синим цветом"
- "Когда мой следующий дедлайн в TickTick?"

### Продвинутые сценарии
- "Создай план на завтра: утром проверить почту, в 10:00 встреча с командой, в 14:00 работа над проектом"
- "Покажи статус всех моих проектов и количество незавершенных задач в каждом"
- "Создай проект для планирования мероприятия со всеми необходимыми задачами"
- "Какие задачи просрочены и требуют внимания?"

## Приоритеты задач

Используйте строковые значения:
- `"none"` - Без приоритета (0)
- `"low"` - Низкий приоритет (1)
- `"medium"` - Средний приоритет (3)
- `"high"` - Высокий приоритет (5)

## Форматы дат

Все даты должны быть в формате ISO 8601:
```
2024-12-31T23:59:59Z
```

## Получение нового токена

Если ваш токен истек, просто запустите:

```bash
npm run get-token
```

Скрипт поднимет локальный сервер на порту 8080, откроет браузер для авторизации и автоматически получит новый токен.

Сервер обрабатывает обновление токенов автоматически, поэтому вам не нужно будет повторно аутентифицироваться, если вы не отзовете доступ или не удалите файл `.env`.

## Разработка

### Структура проекта

```
ticktick-mcp-ts/
├── src/
│   ├── client/
│   │   └── ticktick-client.ts    # Упрощенный клиент для TickTick API
│   ├── server/
│   │   └── ticktick-mcp-server.ts # Упрощенный MCP сервер
│   ├── types/
│   │   └── ticktick.ts           # TypeScript типы
│   └── index.ts                  # Точка входа
├── get-token.ts                  # Скрипт для получения токена
├── test-server.ts                # Тест сервера
├── claude-desktop-config.json    # Пример конфигурации Claude
├── package.json
├── tsconfig.json
└── README.md
```

### Команды разработки

```bash
# Сборка
npm run build

# Запуск в режиме разработки
npm run dev

# Тестирование (с реальными API вызовами)
npm test

# Получение токена
npm run get-token

# Очистка
npm run clean

# Запуск сервера
npm start
```

### Процесс аутентификации

Проект реализует полный OAuth 2.0 поток для TickTick:

1. **Начальная настройка**: Пользователь предоставляет свой TickTick API Client ID и Secret
2. **Авторизация в браузере**: Пользователь перенаправляется в TickTick для предоставления доступа
3. **Получение токена**: Локальный сервер получает OAuth callback с кодом авторизации
4. **Обмен токена**: Код обменивается на токены доступа и обновления
5. **Хранение токена**: Токены безопасно сохраняются в локальном файле `.env`

Это упрощает пользовательский опыт, обрабатывая весь OAuth поток программно.

## Безопасность

- Никогда не коммитьте файл `.env` в репозиторий
- Храните токены доступа в безопасном месте
- Регулярно обновляйте токены доступа при необходимости
- Используйте переменные окружения для передачи токенов в продакшене

## Устранение неполадок

### Ошибки токена
```bash
# Если токен истек или недействителен
npm run get-token
```

### Проблемы с подключением
```bash
# Проверьте конфигурацию
npm test
```

### Проблемы с портом
Если порт 8080 занят, скрипт получения токена может не работать. Убедитесь, что порт свободен или измените его в `get-token.ts`.

## Содействие

Вклады приветствуются! Пожалуйста, не стесняйтесь отправлять Pull Request.

1. Форкните репозиторий
2. Создайте ветку для вашей функции (`git checkout -b feature/amazing-feature`)
3. Зафиксируйте ваши изменения (`git commit -m 'Add some amazing feature'`)
4. Отправьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## Лицензия

Этот проект лицензирован под MIT License

## Поддержка

Если у вас есть вопросы или проблемы, создайте issue в репозитории проекта.
