# User Stories for JSONB-Based Custom Table Implementation

## Phase 1: Database Foundation (JSONB Schema)

### Epic: JSONB Document Storage Architecture
- **Story 1.1**: As a developer, I need a `user_tables` table to store custom table metadata with proper RLS policies, so users can securely define their own document types
- **Story 1.2**: As a developer, I need a `user_table_data` table with JSONB storage to hold all user data documents, so we avoid creating physical tables per user
- **Story 1.3**: As a developer, I need GIN indexes on JSONB columns for efficient querying, so data retrieval remains fast as data grows
- **Story 1.4**: As a developer, I need comprehensive RLS policies on both tables, so users can only access their own table definitions and data

## Phase 2: Frontend Schema Management (Vanilla JS)

### Epic: JSONB Table Creation UI
- **Story 2.1**: As a user, I want a "Create New Table" button that opens a schema definition form, so I can start defining my own document types
- **Story 2.2**: As a user, I want to enter a display name for my custom table (e.g., "Receipts"), so I can organize my documents meaningfully  
- **Story 2.3**: As a user, I want to add multiple fields with names, display labels, and data types (Text/Number/Date), so my custom table schema matches my document structure
- **Story 2.4**: As a user, I want field validation and error messages for schema definition, so I know when my table structure is incorrect
- **Story 2.5**: As a user, I want to save my custom table schema to `user_tables` and see confirmation, so I know my table definition was stored
- **Story 2.6**: As a user, I want to view and edit my existing table schemas, so I can modify table structures without losing data

## Phase 3: JSONB Data Operations (Frontend)

### Epic: Dynamic Table Rendering
- **Story 3.1**: As a developer, I need to fetch table schemas from `user_tables` on app startup, so the application knows about all available custom tables
- **Story 3.2**: As a developer, I need generic table rendering that interprets JSONB schema definitions, so custom tables display correctly without hardcoded logic
- **Story 3.3**: As a user, I want to see my custom tables in the navigation sidebar, so I can easily access my document types
- **Story 3.4**: As a user, I want to view JSONB data in my custom tables with proper column headers and formatting, so I can see my documents clearly

### Epic: JSONB CRUD Operations  
- **Story 3.5**: As a user, I want to edit JSONB records in my custom tables using dynamically generated forms, so I can update my document data
- **Story 3.6**: As a user, I want to delete records from `user_table_data` with confirmation, so I can remove unwanted documents
- **Story 3.7**: As a user, I want to add new JSONB records to my custom tables, so I can grow my document collection
- **Story 3.8**: As a developer, I need generic JSONB handlers for update/delete operations, so I don't duplicate CRUD logic across table types

## Phase 4: Enhanced JSONB Features

### Epic: Global Search & Filter Capabilities
- **Story 4.1**: As a user, I want to search across all my custom tables simultaneously using JSONB operators, so I can find documents across my entire collection
- **Story 4.2**: As a user, I want to search within specific custom tables using JSONB path queries, so I can find documents in targeted collections
- **Story 4.3**: As a user, I want to filter custom tables by date ranges using JSONB date fields, so I can narrow down documents by time period
- **Story 4.4**: As a user, I want to clear search/filter results and return to full data view, so I can reset my search state

### Epic: JSONB Export Functionality
- **Story 4.5**: As a user, I want to export JSONB custom table data to CSV format, so I can use my data in other applications
- **Story 4.6**: As a user, I want to export selected JSONB rows from custom tables, so I can work with subsets of my data
- **Story 4.7**: As a developer, I need to maintain special export formats (VCF for business cards) while adding generic JSONB CSV export, so backwards compatibility is preserved

## Phase 5: n8n OCR Integration

### Epic: JSONB OCR Workflow
- **Story 5.1**: As a developer, I need to modify the n8n OCR workflow to extract data and format as JSON, so extracted data matches the JSONB structure
- **Story 5.2**: As a developer, I need n8n logic to determine target user table based on document type, so OCR data goes to the correct table
- **Story 5.3**: As a developer, I need n8n to insert OCR results into `user_table_data` as JSONB documents, so the workflow works with the new architecture
- **Story 5.4**: As a developer, I need n8n to handle different table schemas dynamically, so the OCR workflow adapts to any custom table structure

## Phase 6: Migration & Compatibility

### Epic: User Experience Polish
- **Story 6.4**: As a user, I want clear status messages when creating, editing, or deleting custom tables, so I know if operations succeeded or failed
- **Story 6.5**: As a user, I want to see loading states during JSONB operations, so I know the system is processing my request
- **Story 6.6**: As a user, I want intuitive navigation between my custom tables, so I can easily switch between different document types

## Implementation Priority

### High Priority (MVP - JSONB Foundation)
- Stories 1.1-1.4 (JSONB database schema with RLS)  
- Stories 2.1-2.6 (Schema definition UI)
- Stories 3.1-3.4 (JSONB table rendering)

### Medium Priority (Core Operations)
- Stories 3.5-3.8 (JSONB CRUD operations)
- Stories 4.1-4.4 (Global search capabilities)  
- Stories 5.1-5.4 (n8n OCR integration)

### Lower Priority (Migration & Polish)
- Stories 4.5-4.7 (Export functionality)
- Stories 6.1-6.3 (Data migration)
- Stories 6.4-6.6 (UX improvements)

## Story Summary

This JSONB-focused breakdown provides **26 concrete user stories** that migrate from physical tables to a scalable document storage approach. Each story builds toward a unified, metadata-driven architecture.

### Story Count by Phase:
- Phase 1: 4 stories (JSONB schema)
- Phase 2: 6 stories (Schema UI)
- Phase 3: 8 stories (JSONB operations)
- Phase 4: 7 stories (Enhanced features)
- Phase 5: 4 stories (n8n integration)
- Phase 6: 6 stories (Migration & polish)

Total: **35 user stories** across 6 phases and 9 epics.

## Key Architectural Benefits

### Scalability Improvements:
- **No more physical table creation**: Eliminates PostgreSQL table limits and schema complexity
- **Unified data storage**: Single `user_table_data` table handles all custom documents
- **Dynamic schema handling**: Add/remove fields without database migrations

### Technical Advantages:
- **JSONB performance**: GIN indexes enable fast queries on flexible document structure
- **Schema evolution**: Users can modify table structures without data loss
- **Global search**: Query across all user tables simultaneously
- **Simplified n8n**: OCR workflow becomes generic, handling any table schema