# Jury — шаблоны для After Effects: оценка и переход

Карточка «Оценочная» после каждого сайта: четыре критерия заполняют колонки до своей оценки,
цифры прокатываются вместе с уровнем, затем уровни сходятся в одну линию — средневзвешенный балл, —
подписи уходят, и весь бокс заполняется светлым: на нём выкатывается «Итоговая оценка».
Имя сайта — слева внизу. Все движения на плавных ease-in-out.

## Установка

1. Установить шрифты: Neue Montreal (`NeueMontreal-Light`, `-Regular`, `-Medium`) и Inter
   (бесплатный, [rsms.me/inter](https://rsms.me/inter/), нужны `Inter-Regular` и `Inter-Medium`).
   В Neue Montreal нет кириллицы, поэтому русские надписи набраны шрифтом `FONT_CYRILLIC` (Inter).
   Чтобы поставить свой, поменяй PostScript-имя в начале `.jsx`.
2. After Effects 2020 или новее: `File → Scripts → Run Script File…` → `JuryVerdict.jsx`.
3. В проекте появится папка **Jury Verdict** с двумя композициями 2560×1600, 30 fps:
   - **Verdict - Scores** (6.5 с) — только четыре оценки;
   - **Verdict - Scores + Total** (10.5 с) — оценки и итог.

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

## Переход между проектами

`Run Script File…` → `JuryTransition.jsx` — композиция **Transition - Project** (2560×1600, 30 fps, 6 с):
слово «Оценочная» собирается по буквам на весь кадр и уходит вверх, с краёв влетают огромные скобки,
между ними прокатывается номер проекта — «( 42 )», за ними бегут контурные строки; в конце скобки
разгоняются навстречу, пересекаются, срезают номер — и всё уходит в чёрное.

В Essential Graphics два поля: **Number** (номер проекта, однозначные пишутся как `07`) и **Title** (слово).

## Превью без After Effects

`node scripts/verdict-check.mjs` прогоняет все скрипты на строгой модели API After Effects
и вычисляет каждое выражение на всём таймлайне.
`npm run dev` → `/verdict.html` — интерактивное превью шаблона с полями для оценок.
Рендер в файл: `node scripts/render.mjs --page verdict.html --query "comp=total&scores=8.4,7.6,9.1,6.8&site=lusion.co" --out out/verdict-total`,
переход — `--query "jsx=transition&number=42"`.
