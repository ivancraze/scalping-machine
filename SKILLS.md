# Skills проекта

Codex загружает рабочие skills из каталогов `.agents/skills/<skill-name>/SKILL.md`. Этот файл — каталог для команды: сам по себе `SKILLS.md` не является исполняемым skill.

Общие продуктовые ограничения, архитектурные правила, безопасность и порядок проверок остаются в [AGENTS.md](./AGENTS.md). Skills не заменяют их, а добавляют узкие workflow для конкретных типов задач.

## Доступные skills

### `pulse-react-feature`

Использовать для реализации и рефакторинга обычных React/TypeScript-фич: компонентов, UI-состояния, TanStack Query, SCSS Modules и размещения кода по FSD.

```text
$pulse-react-feature добавь фильтр рынка и сохрани текущие границы FSD
```

### `pulse-chart-performance`

Использовать для Lightweight Charts, line-tools, свечей, WebSocket/REST-потоков, производительности графика и профильного code review.

```text
$pulse-chart-performance проверь обновление live-свечей и cleanup подписок
```

### `pulse-frontend-testing`

Использовать для test plan, настройки frontend-тестов, тестов React-компонентов и hooks, проверок market-data и regression-тестов ошибок.

```text
$pulse-frontend-testing подготовь тесты для сортировки списка монет
```

### `pulse-accessibility-review`

Использовать для аудита или исправления семантики, клавиатурной навигации, focus, labels, contrast и доступной альтернативы графику.

```text
$pulse-accessibility-review проверь выбор таймфрейма и панель инструментов графика
```

## Как выбрать skill

| Задача                                         | Skill                        |
| ---------------------------------------------- | ---------------------------- |
| Обычная React UI-фича или FSD-рефакторинг      | `pulse-react-feature`        |
| График, realtime-данные или производительность | `pulse-chart-performance`    |
| Тесты или тестовая инфраструктура              | `pulse-frontend-testing`     |
| Accessibility-аудит или исправление            | `pulse-accessibility-review` |

Codex может выбрать skill автоматически по его `description`. Для однозначного выбора укажите `$skill-name` в запросе. Изменения skills обнаруживаются автоматически; если новый skill не появился в интерфейсе, перезапустите Codex.
