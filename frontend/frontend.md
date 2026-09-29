# Crypto Fraud Attribution — Frontend Design & Architecture

This document provides an in-depth breakdown of the frontend architecture, design system, color palette, component structure, and state management for the CaseTrace / Crypto Fraud Attribution application.

## 1. Architectural Overview
The frontend is a modern Single Page Application (SPA) built to deliver a highly interactive, data-dense forensics workstation. 

### Core Tech Stack
- **Framework**: React 19 via Vite for ultra-fast HMR and optimized builds.
- **Language**: TypeScript for strict typing and reliable API contracts.
- **Animations**: `framer-motion` for fluid component transitions, layout shifts, and micro-interactions.
- **Data Visualization**: `cytoscape` and `cytoscape-dagre` for the directed acyclic graph (DAG) rendering of the fund flows.
- **Icons**: `lucide-react` for clean, consistent SVG iconography.
- **Styling**: Vanilla CSS (`index.css`) utilizing extensive CSS Custom Properties (Variables).

## 2. Design Aesthetic: "Cyber-Forensic Glassmorphism"
The application employs a dark-mode-first, "cyber-forensic" aesthetic designed to feel like an advanced intelligence tool. It relies heavily on transparency, blurs (glassmorphism), and neon glows to establish visual hierarchy.

### Key Visual Characteristics
- **Glassmorphism Panels**: UI surfaces use `rgba(11, 17, 26, 0.75)` with a backdrop filter of `blur(24px)`.
- **Glowing Accents**: Interactive elements, high-risk flags, and active states use `box-shadow` glows (e.g., `0 0 20px var(--color-primary-glow)`).
- **Data Density**: The layout uses compact typography and tight spacing (e.g., `11px` uppercase labels).

## 3. Component Structure & Layout

The app employs a highly structured domain tree to represent the workstation layout:

### Application Components
- **`components/Header/`**: The Masthead containing Brand, CaseTrace Wordmark, Live Status, and global chain statistics.
- **`components/Investigation/`**: Houses the `InvestigationConsole` (formerly TraceForm). Manages Target Chain, Wallet Input, Case ID, and includes **Advanced Pre-flight Input Validation** (Valid, Invalid Address, Chain Mismatch).
- **`components/Intelligence/`**: Holds the `Verdict` system, which separates Attribution and Risk into explainable, distinct siblings, and outlines `CaseFacts`.
- **`components/Graph/`**: Contains `FlowMap` (Cytoscape renderer) and `FilterBar` (View toggles for High Risk, Mixers, Sanctioned nodes).
- **`components/Ledger/`**: The tabular `Ledger` panel containing chronological transfer histories.
- **`components/common/Blank`**: The advanced blank state handler managing idle, staged running progress (Validating, Connecting, Tracing), failed, and partial investigation boundaries.

## 4. State Architecture & Mental Model

### Central Investigation State
The application no longer relies on scattered `busy` booleans. The UI inherently understands the explicit *stage* of an investigation, utilizing the `InvestigationStatus` mental model.

```typescript
type InvestigationStatus = 
  | "idle"
  | "validating"
  | "queued"
  | "running"
  | "processing"
  | "completed"
  | "partial"
  | "failed";
```
This guarantees predictable UX transitions:
1. **Idle**: Shows the default "Awaiting Target" screen.
2. **Running**: Displays a staged progress tracker ("Connecting to Blockchain...", "Resolving Entities...").
3. **Completed**: Reveals the full Intelligence briefing and Graph workspace.
4. **Failed / Partial**: Provides actionable, forensic-specific error feedback preventing blind failures.

### Focus Synchronization
Graph node clicks, edge clicks, and ledger row clicks all share a synchronized `focus` model in the root context, ensuring that emphasizing a transaction in the table accurately highlights the corresponding edge on the visualization canvas.

## 5. Color Palette & Typography

### Semantic & Status Colors
- `--color-primary: #3b82f6;` (Blue - Default actions, standard nodes)
- `--color-cyan: #06b6d4;` (Cyan - Brand accents)
- `--color-success: #10b981;` (Green - Exchanges, VASPs, low risk)
- `--color-warning: #f59e0b;` (Amber - Medium/High risk, layering)
- `--color-danger: #ef4444;` (Red - Sanctioned entities, critical risk)
- `--color-purple: #8b5cf6;` (Purple - Mixers, obfuscation nodes)

### Typography
1. **Brand/Display**: `'Space Grotesk'` (used for the wordmark, masthead).
2. **UI/Standard**: `'Inter'` (used for standard body text, buttons).
3. **Data/Forensics**: `'JetBrains Mono'` (crucial for wallet addresses, transaction hashes).

## 6. Interaction & Motion Design
- **Framer Motion**: The sidebar panels slide in from the left (`x: -20` to `x: 0`) and fade in when data arrives to prevent jarring DOM shifts.
- **Hover States**: Interactive elements lift up (`transform: translateY(-1px)`) and increase their neon glow.
- **Graph Virtualization**: The Cytoscape instance is carefully managed to avoid unnecessary teardowns/rebuilds when adjacent UI states (like filters or ledger search) change.
