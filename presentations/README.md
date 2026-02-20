# Presentation Layers

This directory contains all visual presentation implementations for The House of Mourning installation. Each presentation layer is a self-contained module that consumes the business logic API.

## Architecture Principle

**The business logic API is the stable contract. Presentation layers are swappable consumers.**

```
Business Logic (/lib/services/)  ←─── Presentation Layer A (/presentations/p5-constellation/)
                                 ←─── Presentation Layer B (/presentations/three-galaxy/)
                                 ←─── Presentation Layer C (/presentations/mobile-optimized/)
```

## Required Interface

Every presentation layer must:

### 1. Import the Orchestrator
```typescript
import { MessageOrchestrator } from '@/lib/services/orchestrator'
```

### 2. Consume These Methods
- `orchestrator.getWorkingSet(): GriefMessage[]` - Get current 400-800 messages in the universe
- `orchestrator.getCurrentClusters(): Map<string, GriefMessage[]>` - Get semantic connections
- `orchestrator.start()` - Begin message traversal
- `orchestrator.stop()` - Stop traversal (cleanup)

### 3. Never Access Directly
- Database (Supabase client)
- API routes (except for new message submission via public API)
- Internal service implementation details

### 4. Provide
- A default export React component
- Proper cleanup on unmount (call `orchestrator.stop()`)
- Responsive design (typically fullscreen)
- 60fps target performance

## Creating a New Presentation Layer

1. **Create directory:**
   ```bash
   mkdir -p presentations/your-presentation-name/utils
   ```

2. **Implement entry point (`index.tsx`):**
   ```typescript
   'use client'
   
   import { useEffect, useRef } from 'react'
   import { MessageOrchestrator } from '@/lib/services/orchestrator'
   
   export default function YourPresentation() {
     const orchestratorRef = useRef<MessageOrchestrator>()
     
     useEffect(() => {
       const orchestrator = new MessageOrchestrator()
       orchestratorRef.current = orchestrator
       
       orchestrator.start()
       
       // Your visualization code here
       // Use orchestrator.getWorkingSet() and orchestrator.getCurrentClusters()
       
       return () => {
         orchestrator.stop()
       }
     }, [])
     
     return <div className="w-full h-screen">{/* Your UI */}</div>
   }
   ```

3. **Create documentation (`README.md`):**
   - Describe the visual aesthetic
   - Document dependencies
   - Explain configuration options
   - Provide development instructions

4. **Wire up route:**
   ```typescript
   // app/installation/page.tsx
   import YourPresentation from '@/presentations/your-presentation-name'
   
   export default function InstallationPage() {
     return <YourPresentation />
   }
   ```

## Current Implementations

### `/p5-constellation/`
P5.js-based particle constellation with semantic connections. Contemplative, museum-quality visualization inspired by Nonotak, teamLab, and Onformative.

**Status:** Active development (Tier 1 in progress)  
**Tech Stack:** p5.js (WEBGL mode), TypeScript, React  
**Target:** December 19-20, 2025 exhibition at Truss House, Denver

## Guidelines

- **Self-contained:** Each presentation should be independently buildable/testable
- **Zero cross-contamination:** P5 code never imports Three.js utilities, etc.
- **Shared utilities only if truly universal:** Vector math? Maybe. P5-specific spring physics? No.
- **Document aesthetic decisions:** Future developers should understand the "why"
- **Performance first:** 60fps on target hardware (projection systems, gallery computers)

## Benefits of This Structure

1. **Swappable:** Change entire visualization by updating one import
2. **A/B testable:** Run different presentations for different audiences
3. **Future-proof:** Exhibition v2 with new aesthetic? New folder, no refactoring
4. **Clear separation:** Business logic changes don't break presentation layers
5. **Parallel development:** Multiple people can work on different presentations simultaneously

---

For questions about the business logic API, see `/lib/services/README.md`  
For the current p5 implementation, see `/presentations/p5-constellation/README.md`
