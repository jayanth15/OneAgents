# Graph Report - .  (2026-09-10)

## Corpus Check
- Corpus is ~18,584 words - fits in a single context window. You may not need a graph.

## Summary
- 369 nodes · 676 edges · 35 communities (14 shown, 21 thin omitted)
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend Vault UI
- Note API and Agent Tools
- FastAPI Copilot Runtime
- Frontend Runtime Dependencies
- Frontend Dev Tooling
- QNote Concepts and Guides
- TypeScript Configuration
- Persistence and Workflows
- shadcn UI Configuration
- App Shell and Theme
- Chat and Weather UI
- Button Component
- Next.js Template Guide
- Agent Memory Research
- Next.js Agent Instructions
- ESLint Configuration
- Next.js Configuration
- PostCSS Configuration
- FastAPI Dependency
- HTTPX Dependency
- Pydantic AI Harness Dependency
- Multipart Dependency
- SQLModel Dependency
- Uvicorn Dependency
- CopilotKit Dependency
- DBOS Dependency
- FastAPI Dependency
- HTTPX Dependency
- Pydantic AI Dependency
- Pydantic AI Harness Dependency
- Multipart Dependency
- SQLModel Dependency
- Uvicorn Dependency

## God Nodes (most connected - your core abstractions)
1. `Note` - 32 edges
2. `Folder` - 25 edges
3. `PydanticAICopilotAgent` - 17 edges
4. `AgentChatRequest` - 16 edges
5. `compilerOptions` - 16 edges
6. `TransformRequest` - 15 edges
7. `TriageRequest` - 15 edges
8. `LLMConfigRequest` - 15 edges
9. `AgentDeps` - 15 edges
10. `AutoLinkRequest` - 14 edges

## Surprising Connections (you probably didn't know these)
- `seed_initial_data_if_empty()` --calls--> `Folder`  [INFERRED]
  backend/database.py → backend/models.py
- `seed_initial_data_if_empty()` --indirect_call--> `Note`  [INFERRED]
  backend/database.py → backend/models.py
- `fetch_inbox_notes_step()` --indirect_call--> `Folder`  [INFERRED]
  backend/dbos_workflows.py → backend/models.py
- `fetch_inbox_notes_step()` --indirect_call--> `Note`  [INFERRED]
  backend/dbos_workflows.py → backend/models.py
- `fetch_available_folders_step()` --indirect_call--> `Folder`  [INFERRED]
  backend/dbos_workflows.py → backend/models.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **QNote Core Capabilities** — backend_vault_guides_welcome_to_qnote_file_based_markdown_vault, backend_vault_guides_welcome_to_qnote_interactive_knowledge_graph, backend_vault_guides_welcome_to_qnote_pydantic_ai_agent, backend_vault_guides_welcome_to_qnote_dbos_workflows, backend_vault_guides_welcome_to_qnote_copilotkit [EXTRACTED 1.00]
- **Shockwave Architectural Tenets** — backend_vault_research_shockwave_architecture_local_first_file_storage, backend_vault_research_shockwave_architecture_bidirectional_knowledge_graph, backend_vault_research_shockwave_architecture_durable_agent_harness [EXTRACTED 1.00]

## Communities (35 total, 21 thin omitted)

### Community 0 - "Frontend Vault UI"
Cohesion: 0.11
Nodes (25): BacklinksPanelProps, CopilotChatDrawerProps, Message, KnowledgeGraph(), KnowledgeGraphProps, NoteWorkspaceProps, SecondBrainSidebar(), SecondBrainSidebarProps (+17 more)

### Community 1 - "Note API and Agent Tools"
Cohesion: 0.11
Nodes (35): agent_chat(), copilot_get_weather(), copilot_read_note(), delete_folder(), delete_note(), get_backlinks(), get_note(), get_notes() (+27 more)

### Community 2 - "FastAPI Copilot Runtime"
Cohesion: 0.18
Nodes (33): Agent, agent_stream(), AgentChatRequest, AutoLinkRequest, create_folder(), create_note(), get_folders(), get_graph() (+25 more)

### Community 3 - "Frontend Runtime Dependencies"
Cohesion: 0.05
Nodes (37): @base-ui/react, class-variance-authority, clsx, cn, @copilotkit/react-core, @copilotkit/react-ui, d3-force, dependencies (+29 more)

### Community 4 - "Frontend Dev Tooling"
Cohesion: 0.06
Nodes (34): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, tailwindcss (+26 more)

### Community 5 - "QNote Concepts and Guides"
Cohesion: 0.08
Nodes (33): CopilotKit, DBOS, Pydantic AI, Interactive Navigation, Knowledge Graph Features, Node Physics, Visual Weight, Wikilinks (+25 more)

### Community 6 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (29): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+21 more)

### Community 7 - "Persistence and Workflows"
Cohesion: 0.15
Nodes (25): create_db_and_tables(), get_session(), seed_initial_data_if_empty(), apply_note_move_step(), autolink_note_step(), decide_triage_destination_step(), durable_autolink_workflow(), durable_inbox_triage_workflow() (+17 more)

### Community 8 - "shadcn UI Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "App Shell and Theme"
Cohesion: 0.16
Nodes (8): fontMono, inter, AppNavigation(), CopilotProvider(), ThemeHotkey(), ThemeProvider(), react, react

### Community 10 - "Chat and Weather UI"
Cohesion: 0.25
Nodes (9): ChatPage(), INITIAL_SUGGESTIONS, LLMConfig, Message, PROVIDER_PRESETS, ToolCallState, WeatherData, WeatherWidget() (+1 more)

### Community 12 - "Next.js Template Guide"
Cohesion: 0.67
Nodes (3): Button Component, Next.js Template, shadcn/ui

## Knowledge Gaps
- **134 isolated node(s):** `Message`, `LLMConfig`, `PROVIDER_PRESETS`, `inter`, `fontMono` (+129 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Frontend Runtime Dependencies` to `App Shell and Theme`, `Frontend Dev Tooling`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `react` connect `App Shell and Theme` to `Frontend Runtime Dependencies`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `Note` (e.g. with `seed_initial_data_if_empty()` and `apply_note_move_step()`) actually correct?**
  _`Note` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `Session` (e.g. with `get_session()` and `seed_initial_data_if_empty()`) actually correct?**
  _`Session` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `Folder` (e.g. with `seed_initial_data_if_empty()` and `fetch_available_folders_step()`) actually correct?**
  _`Folder` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `PydanticAICopilotAgent` (e.g. with `Folder` and `FolderCreate`) actually correct?**
  _`PydanticAICopilotAgent` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Message`, `LLMConfig`, `PROVIDER_PRESETS` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._