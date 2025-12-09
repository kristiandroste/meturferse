# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meturferse is an interactive web visualization tool for exploring Turf NFT land plots on a 2D grid map. It's a static site (deployable to Netlify) with an optional Express server for local development and feedback form proxying.

## Development Commands

```bash
# Start local development server
node server.js

# Server runs on http://localhost:3000 by default (or PORT env var)
```

## Architecture

### Static Site Structure
- `public/` - All static assets served directly
  - `index.html` - Single-page application entry point
  - `main.js` - Core application logic (~1950 lines, vanilla JS IIFE)
  - `styles.css` - All styling including 13 theme variants
  - `metadata.json` - NFT plot metadata (5041 plots)
  - `mixpanel.js` - Analytics tracking wrapper
  - `images/` - Sprite atlases (`sprite64.png`, `sprite16.png`) and individual 256px plot images

### Core Subsystems in main.js

1. **Canvas Rendering** - HTML5 Canvas draws sprite atlas at varying zoom levels with viewport culling
2. **Filter System** - Dynamic filter UI built from metadata attributes, supports numeric ranges and categorical selection
3. **Neighborhoods Overlay** - Manhattan distance-based Voronoi diagram showing plot influence zones
4. **Wallet Integration** - Etherscan API v2 lookups to highlight holdings by address
5. **URL State Management** - Hash-based state persistence for zoom, position, filters, and wallets
6. **Theme System** - 13 CSS custom property themes, random selection for new users

### Server (server.js)
Express server with:
- Static file serving from `public/`
- `/api/metadata` - JSON endpoint for plot metadata
- `/api/feedback` - Proxy to Google Apps Script (requires `GOOGLE_SHEETS_URL` env var)
- SPA fallback routing

### External Dependencies
- **Ethers.js** (CDN) - Wallet address validation
- **Etherscan API v2** - NFT transaction history lookups
- **Mixpanel** (CDN) - Analytics

### Key Constants
- Turf contract: `0x55d89273143DE3dE00822c9271DbCBD9B44B44C6`
- Grid: 71x71 plots, coordinates from metadata attributes `X.Coord` and `Y.Coord`
- Tile size: 64px base, max scale 2.5x

## Feedback Form Setup

For the feedback form to work locally:
1. Deploy Google Apps Script per `GOOGLE_SHEETS_SETUP.md`
2. Set `GOOGLE_SHEETS_URL` environment variable to the Web App URL
