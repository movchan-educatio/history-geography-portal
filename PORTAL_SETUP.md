# Кабінет «Історія і географія БЕЗ МЕЖ»

У новій версії додано `dashboard.html` + `portal.js` + `portal.css`.

## Що працює
- Google Authentication через існуючий Firebase-проєкт `movchan-portal`.
- Профіль користувача.
- Ролі `teacher` / `student`.
- Уроки: тема, клас, Д/З, відео, презентація.
- Домашні завдання.
- Подання учнем тексту та файлу.
- Оцінка та коментар учителя.
- Спільні матеріали та завантаження файлів у Firebase Storage.
- Дані синхронізуються між пристроями через Realtime Database.

## Один обов'язковий крок
Щоб зробити перший Google-акаунт учителя, у Firebase Realtime Database відкрийте:
`users/ВАШ_UID/role`
і встановіть значення:
`teacher`

Після цього саме цей акаунт отримує інструменти створення уроків, Д/З та оцінювання.

## Правила
Файли `database.rules.json` і `storage.rules` містять базовий варіант правил безпеки. Перед публічним запуском обов'язково встановіть їх у Firebase Console.

## Важливо
GitHub Pages сам по собі не є сервером. Уся приватна функціональність кабінету працює через Firebase. Тому Google Auth, Realtime Database та Storage мають бути увімкнені у Firebase Console, а домен GitHub Pages доданий до Authorized domains.
