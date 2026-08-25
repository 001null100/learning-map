# Learning Map

A recursive, graph-first learning workspace backed by a private GitHub data repository.

## Architecture

- This public repository contains only the static React application.
- Learning projects, concepts, graphs, questions, comments, and progress live in a separate private repository.
- The browser stores a fine-grained GitHub PAT in IndexedDB and talks directly to the GitHub Contents API.
- AI agents can independently read and restructure the private data repository using the contract in its `AGENTS.md`.

## Local development

```bash
npm install
npm run dev
```

The production build uses the `/learning-map/` base path for GitHub Pages.

## First connection

Create a fine-grained PAT with `Contents: Read and write` access to only the private learning data repository. On first launch, enter the repository owner/name and PAT. The credential remains local to that browser.
