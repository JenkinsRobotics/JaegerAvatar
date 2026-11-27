# NexusUI app shell

The standard app container and navigation bar for NexusUI desktop apps (a Python server, a web screen, a pywebview
window). It recreates Aether UI's navigation as Aether Studio shows it (`ApplicationSidebar`, variant `captioned`),
the sidebar home frame, and the status bar. The source is November 27, 2026 Aether-UI.

The frame has no header:

- **Sidebar, full height.** From top to bottom:
  - The brand: a mark plus a wordmark, e.g. "Jaeger" in ink and "AI" in Aether Studio's accent gradient. Clicking it
    collapses the sidebar to an icon rail.
  - Captioned, collapsible sections, with a solid-accent current row.
  - Footer tools (Aether Studio: Administration, Sign out).
  - Settings and Apps.
  - A profile card.
- **Main area:** the app's own pages, unchanged.
- **Status bar** across the bottom: connection and product on the left, a message in the middle, the company on the
  right.

It changes only the container and the navigation bar. What a page shows stays the app's.

## Use it

Copy this folder into the app's source and own the copy (Jaeger rule: copy Aether's look, never import it). It needs
the Aether tokens (`--aether-color-*`, `--aether-font-family`) that the Jaeger apps already copy.

| File | For |
|---|---|
| `app-shell.css` | The styles, shared by both versions |
| `AppShell.tsx` | React apps: `<AppShell id brand sections current onSelect tools settings apps profile status>{page}</AppShell>` |
| `app-shell.js` | Plain-JS apps: `mountAppShell(root, config)` moves `root`'s content into the shell's main area and returns setters |
| `icons.js` | Aether's icons (copied SVG markup) by name |

Both versions remember the rail and each section's open state per app on the device (`localStorage`).

Apps using it: Jaeger AI's NexusUI app (`jaeger_ai/interfaces/nexus`), Jaeger Agent's UI (`ui/`), Jaeger Avatar
(`app/web`).
