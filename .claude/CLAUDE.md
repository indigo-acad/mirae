# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Материалы и домашка
- Новый тренажёр в `materials/`: после добавления запустить `python3 tools/inject.py` (мост `js/bridge.js`). Чтобы преподаватель мог задавать отдельные задания, тренажёр должен либо строить путь в глобальном `STEPS` (key/name/set) и/или вкладки `nav button[data-tab]` + `#tab-<имя>` (мост поймёт сам), либо объявить `window.MIRAE_PARTS` и фильтр `MIRAE_PICK.keep(...)` до первой отрисовки — см. README, раздел «Отдельные задания тренажёра».
