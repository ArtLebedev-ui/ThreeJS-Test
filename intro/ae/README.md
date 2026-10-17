# Jury Verdict — шаблон оценки для After Effects

Карточка «Оценочная» после каждого сайта: четыре критерия заполняют колонки до своей оценки,
цифры прокатываются вместе с уровнем, затем уровни сходятся в одну линию — средневзвешенный балл —
и снизу поднимается светлая плашка с итогом и красной точкой.

## Установка

1. Установить шрифт Neue Montreal в систему (нужны `NeueMontreal-Regular` и `NeueMontreal-Medium`).
2. After Effects 2020 или новее: `File → Scripts → Run Script File…` → `JuryVerdict.jsx`.
3. В проекте появится папка **Jury Verdict** с двумя композициями 2560×1600, 30 fps:
   - **Verdict — Scores** (6 с) — только четыре оценки;
   - **Verdict — Scores + Total** (8 с) — оценки и итог.

## Как менять цифры

`Window → Essential Graphics` — поля **Design, UX, Creativity, Content** и **Site**.
То же самое лежит на слое `CONTROLS` (Effect Controls). Итог считается сам:
Design 40 %, UX 30 %, Creativity 20 %, Content 10 % (веса — слайдеры `Weight …` на `CONTROLS`).
Оценки округляются до 0.1, итог — до 0.01. Ничего перекеивать не нужно: вся анимация на выражениях.

## Несколько сайтов за раз

Открыть или выделить композицию шаблона → `Run Script File…` → `JuryVerdict-Batch.jsx`,
вставить по строке на сайт:

```
lusion.co     8.4 7.6 9.1 6.8
obys.agency   8.9 8.1 9.3 7.5
```

Скрипт продублирует шаблон под каждый сайт, подставит оценки и (по галочке) добавит всё в Render Queue.

## Превью без After Effects

`node scripts/verdict-check.mjs` прогоняет оба скрипта на строгой модели API After Effects
и вычисляет каждое выражение на всём таймлайне.
`npm run dev` → `/verdict.html` — интерактивное превью шаблона с полями для оценок.
Рендер в файл: `node scripts/render.mjs --page verdict.html --query "comp=total&scores=8.4,7.6,9.1,6.8&site=lusion.co" --out out/verdict-total`.
