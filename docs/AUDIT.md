# Plan Audit & Improvements

## Issues Identified

### 1. Missing Dependencies
- ❌ `localforage` - Mentioned in docs but not in package.json
- ❌ No testing framework
- ❌ No code formatter (Prettier)

### 2. Documentation Redundancy
- **IMPLEMENTATION.md** (698 lines): Too verbose, full code listings
- **MODULES.md** (624 lines): Implementation details overlap with IMPLEMENTATION.md
- **DATABASE.md** (392 lines): Could consolidate repetitive examples
- Root **README.md**: Still has Vite boilerplate, not project-specific

### 3. Architecture Gaps
- No error boundary strategy
- No loading states pattern
- Missing accessibility (ARIA, keyboard navigation)
- No responsive design consideration
- No offline-first strategy beyond IndexedDB

### 4. Development Workflow Missing
- No git workflow guidance
- No branch strategy
- No commit conventions
- No pre-commit hooks (linting, formatting)
- No code review checklist

### 5. Quality & Testing
- No testing strategy (unit, integration, e2e)
- No test file structure
- No coverage targets
- No debugging tools guidance

### 6. Performance Gaps
- sql.js WASM file size (~1.5MB) not addressed
- No lazy loading for large graphs (>500 nodes)
- Web workers not considered for simulation
- No performance budget

### 7. Deployment & Production
- No build optimization guidance
- No deployment checklist
- No environment configuration (.env)
- No production error monitoring

### 8. Phase Coherency Issues
- Phase ordering inconsistent between plan and IMPLEMENTATION.md
- No "Definition of Done" per phase
- Missing rollback strategies
- Dependencies between phases not explicit

---

## Improvement Plan

### A. Fix Dependencies (Immediate)
```bash
npm install localforage
npm install -D prettier vitest @testing-library/react @testing-library/user-event happy-dom
```

### B. Streamline Documentation
1. **Root README.md**: Replace with project overview + quick start
2. **IMPLEMENTATION.md**: Remove full code, keep only patterns and steps
3. **MODULES.md**: Focus on interfaces/APIs, remove implementation
4. **Add QUICKSTART.md**: Step-by-step 0-to-running guide
5. **Add DEVELOPMENT.md**: Workflow, testing, debugging

### C. Add Missing Guides
- **SETUP.md**: Environment, tooling, git workflow
- **TESTING.md**: Test strategy, examples, running tests
- **DEPLOYMENT.md**: Build process, optimization, hosting options

### D. Enhance Architecture Docs
- Add error handling section to ARCHITECTURE.md
- Add accessibility section
- Add performance optimization section
- Add state machine diagram for UI states

### E. Improve Implementation Phases
**Reorder for coherent dependencies:**
1. Foundation (setup, tooling, git)
2. Database module (data layer first)
3. State management module (before rendering)
4. Engine module (physics isolated)
5. React rendering module (uses state + engine)
6. UI shell module (top-level assembly)
7. Polish & testing

**Add for each phase:**
- Prerequisites
- Definition of Done
- Test checklist
- Rollback procedure

### F. Add Project Quality Standards
- ESLint configuration
- Prettier configuration
- Git hooks (husky + lint-staged)
- Commit message format (Conventional Commits)

---

## Proposed New Documentation Structure

```
docs/
├── README.md              # Project overview (keep at 100 lines)
├── QUICKSTART.md          # NEW: 0-to-running in 5 minutes
├── SETUP.md               # NEW: Development environment setup
├── ARCHITECTURE.md        # Enhanced with error handling, a11y
├── DATABASE.md            # Streamlined to 200 lines (schema + API only)
├── MODULES.md             # Refocused on module interfaces (400 lines max)
├── IMPLEMENTATION.md      # Condensed to phases + patterns (400 lines max)
├── DEVELOPMENT.md         # NEW: Workflow, testing, debugging
├── TESTING.md             # NEW: Test strategy and examples
├── DEPLOYMENT.md          # NEW: Production build & deployment
└── DECISIONS.md           # NEW: Architecture decision records
```

---

## Priority Fixes

### P0 (Blocking)
1. Add missing `localforage` dependency
2. Replace root README.md with project-specific content
3. Fix phase ordering in IMPLEMENTATION.md
4. Add .env.example for configuration

### P1 (High Priority)
1. Add QUICKSTART.md for immediate value
2. Streamline IMPLEMENTATION.md (remove full code listings)
3. Add error boundary to ARCHITECTURE.md
4. Create SETUP.md with tooling configuration

### P2 (Should Have)
1. Add testing framework and TESTING.md
2. Add DEVELOPMENT.md for workflow
3. Add accessibility section to docs
4. Add performance optimization guide

### P3 (Nice to Have)
1. Add DEPLOYMENT.md
2. Add DECISIONS.md for ADRs
3. Add diagrams (sequence, state machine)
4. Add troubleshooting guide
