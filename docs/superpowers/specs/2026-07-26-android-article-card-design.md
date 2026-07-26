# Android Article Card Visual Design

## Goal
Restyle only the Android App's full article-card presentation to match the approved reference: a cover-led, rounded card with a restrained metadata line, strong title, muted summary, and colored tags.

## Scope
- Change `QiankunjieArticleCard` only.
- Keep `QiankunjieCompactArticleRow`, list switching, click and long-press behaviors, article models, API data, and the Web app unchanged.

## Visual contract
- Use a full-width cover at the WeChat official-account banner ratio of **2.35:1**; crop with `ContentScale.Crop`, never stretch.
- In dark mode, use a deep green card surface with readable warm text and muted metadata/summary, closely matching the supplied reference.
- In light mode, keep the same structure, density, and hierarchy using the app's light book-theme colors.
- Preserve the current image fallback when `coverImage` is absent.
- Keep title and summary clamped to two lines; show at most three tags and a `+N` overflow marker.
- Do not add visible controls or change navigation/interaction semantics.

## States
- Cover present: rounded top corners and centered-crop image.
- No cover: existing visual fallback fills the same 2.35:1 cover space.
- No summary: title flows directly to tags or card bottom without a blank summary block.
- No tags: card ends after title/summary without a blank tag row.
