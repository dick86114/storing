# Account Menu Two-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every clickable option in the top-right account dropdown as a two-column grid in every color scheme, reducing panel height without changing theme colors or interaction behavior.

**Architecture:** Keep the account header, section labels, and dividers as full-width structural elements. Add explicit option-grid wrappers to `DesktopTopNav` for appearance modes and account actions, and opt `ThemeStyleMenu` into the same grid contract. Put final, narrowly-scoped layout rules at the end of `globals.css` so existing color-scheme-specific visual rules remain untouched while their earlier single-column display declarations are overridden.

**Tech Stack:** Next.js 15, React, TypeScript, CSS Grid, Node built-in test runner, ESLint.

## Global Constraints

- Apply the two-column arrangement to all account dropdown options in every color scheme, including `xianxia`.
- Keep user information, section labels, and dividers full-width.
- Do not alter palette tokens, color-scheme backgrounds, borders, shadows, hover styles, selected styles, menu behavior, or navigation behavior.
- Keep all cells keyboard-focusable in their existing DOM ordering.
- The menu must not horizontally overflow a narrow viewport.

---

### Task 1: Lock the cross-theme grid contract with source-level regression tests

**Files:**
- Modify: `apps/web/test/navigation-structure.test.mjs`

**Interfaces:**
- Consumes: the account-menu class names rendered by `DesktopTopNav` and `ThemeStyleMenu`.
- Produces: a regression test that fails until both option groups and the theme-style selector have the two-column grid contract.

- [ ] **Step 1: Write the failing test**

Add a test named `account dropdown uses two-column option grids in every color scheme` that reads `DesktopTopNav.tsx`, `ThemeStyleMenu.tsx`, and `globals.css` and asserts:

```js
assert.match(desktop, /className="user-menu-option-grid user-menu-appearance-grid"/);
assert.match(desktop, /className="user-menu-option-grid user-menu-action-grid"/);
assert.match(themeMenu, /theme-style-menu user-menu-option-grid/);
assert.match(styles, /\.user-menu-option-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styles, /\.user-menu\s*\.theme-style-menu[\s\S]*display:\s*grid !important/);
```

Also assert that the full-width structural classes use `grid-column: 1 / -1` and that the panel has a viewport-bound width rule.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test apps/web/test/navigation-structure.test.mjs
```

Expected: FAIL because no option-grid wrappers or universal grid rule exist.

- [ ] **Step 3: Keep the test focused**

Do not assert theme-specific colors, individual button labels, or inline styles. The regression test must only protect layout structure and viewport constraints.

- [ ] **Step 4: Commit the failing test only**

```bash
git add apps/web/test/navigation-structure.test.mjs
git commit -m "test: specify two-column account menu grids"
```

### Task 2: Group account dropdown options without changing their actions

**Files:**
- Modify: `apps/web/src/components/layout/DesktopTopNav.tsx:300-400`
- Modify: `apps/web/src/components/layout/ThemeStyleMenu.tsx:19-62`

**Interfaces:**
- Consumes: existing `theme`, `setTheme`, `colorScheme`, `router`, auth role checks, and `onSelect` callback.
- Produces: `user-menu-option-grid user-menu-appearance-grid`, `user-menu-option-grid user-menu-action-grid`, and a `ThemeStyleMenu` root that participates in the shared option-grid contract.

- [ ] **Step 1: Wrap the night/day buttons**

In `DesktopTopNav.tsx`, leave the `夜昼` label outside the grid and wrap the existing `light`, `dark`, and `system` buttons in:

```tsx
<div className="user-menu-option-grid user-menu-appearance-grid">
  {/* existing three buttons in their current order */}
</div>
```

Preserve each button’s `onClick`, active class, icon, accessible button semantics, and label.

- [ ] **Step 2: Wrap account actions**

Leave the `操作` label outside the grid. Wrap the authenticated action buttons—or the unauthenticated login button—in:

```tsx
<div className="user-menu-option-grid user-menu-action-grid">
  {/* existing actions in their current DOM order */}
</div>
```

Do not reorder admin-only actions, password change, logout, or login behavior. Keep logout as an ordinary grid item so every clickable option follows the same two-column rule.

- [ ] **Step 3: Opt ThemeStyleMenu into the shared contract**

Change the `ThemeStyleMenu` root class to include `user-menu-option-grid`, while retaining `theme-style-menu` and its `role="group"`. Keep its label as a direct child so it can span both columns, and preserve all buttons, `aria-pressed` values, and `onSelect` behavior.

- [ ] **Step 4: Run the focused test**

Run:

```bash
node --test apps/web/test/navigation-structure.test.mjs
```

Expected: still FAIL until Task 3 adds the CSS grid rules.

### Task 3: Apply universal two-column layout with viewport-safe dimensions

**Files:**
- Modify: `apps/web/src/app/globals.css:after the existing user-menu overrides near the file end`

**Interfaces:**
- Consumes: `user-menu`, `user-menu-option-grid`, `theme-style-menu`, `app-menu-item`, `theme-style-option`, `app-menu-section-label`, `theme-menu-label`, and `app-menu-divider` classes.
- Produces: final CSS layout overrides that have enough specificity and source order to supersede existing per-theme `flex-direction: column` declarations without touching their visual properties.

- [ ] **Step 1: Add shared two-column grid rules**

Append a clearly labeled account-menu layout block that:

```css
.user-menu .user-menu-option-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.user-menu .user-menu-option-grid > .app-menu-section-label,
.user-menu .user-menu-option-grid > .theme-menu-label {
  grid-column: 1 / -1;
}
```

Use the same grid rule for `.user-menu .theme-style-menu` through its shared class rather than changing the existing color-scheme rules.

- [ ] **Step 2: Make grid cells shrink safely**

Constrain direct option children with `min-width: 0`, reset their outer horizontal margins only within the new grids, and retain the existing color, background, border, hover, active, and danger styling. Use CSS text overflow only if an existing long label cannot fit without pushing a column wider.

- [ ] **Step 3: Bound the panel to the viewport**

Override the account panel width to a two-column-friendly but viewport-safe value, e.g. `width: min(360px, calc(100vw - 16px))`, and remove only the old `white-space: nowrap` constraint for option cells inside the grid. Do not modify positioning, focus handling, or z-index.

- [ ] **Step 4: Run the focused test and lint**

Run:

```bash
node --test apps/web/test/navigation-structure.test.mjs
pnpm --filter web lint
```

Expected: both PASS.

- [ ] **Step 5: Commit the implementation**

```bash
git add apps/web/src/components/layout/DesktopTopNav.tsx \
  apps/web/src/components/layout/ThemeStyleMenu.tsx \
  apps/web/src/app/globals.css \
  apps/web/test/navigation-structure.test.mjs
git commit -m "feat: arrange account menu options in two columns"
```

### Task 4: Verify all navigation and account-menu regressions

**Files:**
- Verify only: `apps/web/test/navigation-structure.test.mjs`
- Verify only: `apps/web/test/responsive-navigation.test.mjs`
- Verify only: `apps/web/src/components/layout/DesktopTopNav.tsx`
- Verify only: `apps/web/src/components/layout/ThemeStyleMenu.tsx`
- Verify only: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: final grid layout and existing navigation tests.
- Produces: evidence that account menu behavior and responsive navigation remain valid.

- [ ] **Step 1: Run the complete web regression set**

Run:

```bash
node --test apps/web/test/*.test.mjs
pnpm lint
```

Expected: all Web tests and lint pass.

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff HEAD~1 -- apps/web/src/components/layout/DesktopTopNav.tsx apps/web/src/components/layout/ThemeStyleMenu.tsx apps/web/src/app/globals.css apps/web/test/navigation-structure.test.mjs
git status --short --branch
```

Confirm that the diff is limited to the two-column account-menu structure, its layout styles, and the regression test.
