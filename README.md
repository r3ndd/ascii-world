# ASCII World

A 2D ASCII game engine for open-world survival games using TypeScript and rot.js.

## Overview

This engine is designed for creating complex open-world ASCII games with features like:
- Bounded, pre-generated worlds (1000x1000 tiles default, 64x64 chunks)
- Strict turn-based gameplay with speed mechanics
- Smart entity updating with post-hoc catch-up for time-based effects
- JSON + JS modding system
- Multiple map selection

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete design documentation.

## Getting Started

```bash
# Install dependencies
npm install

# Build the project for production
npm run build

# Development mode (build + watch + serve)
npm run dev

# Run type checking
npm run typecheck
```

## Running the Game

### Quick Start (Development)
```bash
npm run dev
# This will:
# - Build the project using Rollup
# - Watch for changes and auto-rebuild
# - Start a dev server at http://localhost:3000
# - Auto-open your browser
```

### Production Build
```bash
npm run build
# Then serve the files:
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

### Available Scripts
- `npm run build` - Build for production (outputs to dist/bundle.js)
- `npm run dev` - Development mode with watch + auto-reload
- `npm run build:watch` - Build and watch for changes
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Clean dist folder

**Controls:**
- `↑↓←→` or `WASD` - Move character
- `Space` - Wait a turn
- Exit - Close browser tab

## Project Structure

```
ascii-world/
├── src/           # TypeScript source code
├── content/       # Game content (maps, items, creatures, mods)
├── tests/         # Test suite
└── docs/          # Documentation
```

## License

MIT
