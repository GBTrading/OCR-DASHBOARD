# Custom Table Implementation Plan for OCR Dashboard

## Overview

This document outlines the implementation plan for adding a "create custom table" feature to the OCR Dashboard application. The feature will allow users to define custom document types beyond the current business cards and invoices, with the same CRUD, search, filter, and export capabilities.

## Current App Functionality Summary

### Core Features
- User authentication with Supabase
- Two document types: Business Cards and Invoices
- CRUD operations (Create, Read, Update, Delete)
- Search and filtering by text/date range
- Export functionality (VCF for contacts, CSV/PDF for invoices)
- File upload and OCR processing
- Client-side routing system with page management

### Architecture Highlights
- Event delegation for table actions
- Dynamic query building with Supabase
- Modal-based editing/deletion
- Configurable page routing (`pageConfig` object)
- Primary key mapping system (`primaryKeys` object)

### Current Tables
- `business_cards` table: Name, Job_Title, Company, Phone, Email, created_at
- `invoices` table: Invoice_Number, Exporter_Name, Product, Port_of_Loading, Total_Invoice_Value, created_at

## Implementation Strategy: Metadata-Driven Approach

Instead of allowing users to directly create database tables (security risk), we will create a metadata layer. Tables will describe the custom tables users want to create, then use a secure Supabase function to safely create the actual database tables.

### Benefits
- **Security**: Users can't directly execute SQL (prevents injection attacks)
- **Backwards Compatibility**: Existing tables work with new generic system
- **Extensible**: Easy to add new document types in the future
- **Performance**: Proper indexing and RLS policies maintained

## Phase 1: Database Schema & Backend Logic

### 1. Create Metadata Tables in Supabase

#### `document_types` table
Stores high-level information for each custom table.

```sql
CREATE TABLE document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type_name TEXT NOT NULL, -- e.g., "receipts", "packing_lists" (used for table name)
    display_name TEXT NOT NULL, -- e.g., "Receipts", "Packing Lists" (used in UI)
    primary_key_column TEXT, -- The column name that will act as the primary key
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, type_name)
);

-- Enable RLS
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only manage their own document types
CREATE POLICY "Allow users to manage their own document types"
ON document_types FOR ALL
USING (auth.uid() = user_id);
```

#### `document_fields` table
Stores individual fields (columns) for each `document_type`.

```sql
CREATE TABLE document_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type_id UUID REFERENCES document_types(id) ON DELETE CASCADE NOT NULL,
    column_name TEXT NOT NULL, -- e.g., "merchant_name"
    display_name TEXT NOT NULL, -- e.g., "Merchant Name"
    data_type TEXT NOT NULL, -- e.g., 'TEXT', 'NUMERIC', 'DATE'
    "order" INT NOT NULL DEFAULT 0, -- To maintain field order in the UI
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_type_id, column_name)
);

-- Enable RLS
ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only manage fields for document types they own
CREATE POLICY "Allow users to manage fields for their document types"
ON document_fields FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM document_types
    WHERE document_types.id = document_fields.document_type_id
    AND document_types.user_id = auth.uid()
  )
);
```

### 2. Create Secure Supabase RPC Function

```sql
-- Function to create a custom table based on metadata
CREATE OR REPLACE FUNCTION create_custom_document_table(type_name TEXT, display_name TEXT, primary_key_column TEXT, fields JSONB)
RETURNS UUID AS $$
DECLARE
    new_document_type_id UUID;
    sanitized_table_name TEXT;
    create_table_sql TEXT;
    field RECORD;
    column_defs TEXT[];
    policy_sql TEXT;
BEGIN
    -- 1. Sanitize the table name (critical for security)
    -- We'll prefix with 'custom_' to avoid conflicts and add a layer of namespacing.
    sanitized_table_name := 'custom_' || regexp_replace(type_name, '[^a-zA-Z0-9_]', '', 'g');

    -- 2. Insert metadata into our control tables
    INSERT INTO public.document_types (user_id, type_name, display_name, primary_key_column)
    VALUES (auth.uid(), sanitized_table_name, display_name, primary_key_column)
    RETURNING id INTO new_document_type_id;

    -- 3. Build the column definitions from the JSON input
    FOR field IN SELECT * FROM jsonb_to_recordset(fields) AS x(column_name TEXT, display_name TEXT, data_type TEXT, "order" INT)
    LOOP
        -- Insert field metadata
        INSERT INTO public.document_fields (document_type_id, column_name, display_name, data_type, "order")
        VALUES (new_document_type_id, field.column_name, field.display_name, field.data_type, field."order");

        -- Append to column definitions for the CREATE TABLE statement
        -- More sanitization on column names and types
        column_defs := array_append(column_defs,
            format('%I %s',
                regexp_replace(field.column_name, '[^a-zA-Z0-9_]', '', 'g'),
                CASE
                    WHEN field.data_type = 'TEXT' THEN 'TEXT'
                    WHEN field.data_type = 'NUMERIC' THEN 'NUMERIC'
                    WHEN field.data_type = 'DATE' THEN 'DATE'
                    ELSE 'TEXT' -- Default to TEXT for safety
                END
            )
        );
    END LOOP;

    -- 4. Construct and execute the CREATE TABLE statement
    create_table_sql := format(
        'CREATE TABLE public.%I (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            %s,
            CONSTRAINT pkey UNIQUE (%I)
        );',
        sanitized_table_name,
        array_to_string(column_defs, ', '),
        primary_key_column
    );

    EXECUTE create_table_sql;

    -- 5. Enable RLS and create policies for the new table
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', sanitized_table_name);
    
    policy_sql := format(
        'CREATE POLICY "Allow user full access to their own rows"
        ON public.%I FOR ALL
        USING (auth.uid() = user_id);',
        sanitized_table_name
    );
    EXECUTE policy_sql;

    RETURN new_document_type_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Phase 2: Frontend UI for Schema Definition

### UI Flow
1. "Create New Table" button opens a form
2. Form has inputs for "Display Name" and a list of fields
3. Users can "Add Field" with inputs for "Field Name", "Data Type", and primary key selection
4. "Save" button triggers the RPC function

### JavaScript Implementation

```javascript
async function handleCreateCustomTable() {
    // 1. Gather data from the form
    const displayName = document.getElementById('new-table-display-name').value;
    const typeName = displayName.toLowerCase().replace(/\s+/g, '_'); // e.g., "receipts"
    
    const fields = [];
    let primaryKeyColumn = null;
    
    // Loop through the UI elements for each field definition
    document.querySelectorAll('.field-definition-row').forEach((row, index) => {
        const columnName = row.querySelector('.field-column-name').value;
        const fieldDisplayName = row.querySelector('.field-display-name').value;
        const dataType = row.querySelector('.field-data-type').value;

        fields.push({
            column_name: columnName,
            display_name: fieldDisplayName,
            data_type: dataType,
            order: index
        });

        if (row.querySelector('.field-is-primary').checked) {
            primaryKeyColumn = columnName;
        }
    });

    if (!primaryKeyColumn) {
        showNotification('You must select one field as the primary key.', 'error');
        return;
    }

    // 2. Call the Supabase RPC function
    const { data, error } = await supabase.rpc('create_custom_document_table', {
        type_name: typeName,
        display_name: displayName,
        primary_key_column: primaryKeyColumn,
        fields: fields
    });

    if (error) {
        console.error('Error creating custom table:', error);
        showNotification('Failed to create custom table.', 'error');
    } else {
        showNotification('Custom table created successfully!', 'success');
        // TODO: Refresh navigation and redirect to the new table page
    }
}
```

## Phase 3: Refactoring Core Application Logic

### 1. Centralize Schema and Configuration Management

```javascript
// Replace/augment existing global state (around LINE 91)
let tableSchemas = {}; // Will store schemas for all tables
let primaryKeys = {}; // Will be populated dynamically
let pageConfig = { /* existing static pages */ }; // Will be augmented dynamically

async function loadTableSchemas() {
    // Add built-in schemas manually for now
    tableSchemas['business_cards'] = {
        displayName: 'Business Cards',
        primaryKey: 'Email',
        fields: [
            { columnName: 'Name', displayName: 'Name', dataType: 'TEXT', order: 0 },
            { columnName: 'Job_Title', displayName: 'Job Title', dataType: 'TEXT', order: 1 },
            // ... other business_cards fields
        ]
    };
    tableSchemas['invoices'] = {
        displayName: 'Invoices',
        primaryKey: 'Invoice_Number',
        fields: [
            { columnName: 'Invoice_Number', displayName: 'Invoice Number', dataType: 'TEXT', order: 0 },
            // ... other invoices fields
        ]
    };

    // Fetch custom schemas from the database
    const { data: customTypes, error } = await supabase
        .from('document_types')
        .select(`
            *,
            fields:document_fields(*)
        `);
    
    if (error) {
        console.error('Error fetching custom table schemas:', error);
        return;
    }

    // Merge custom schemas into our global state
    for (const type of customTypes) {
        tableSchemas[type.type_name] = {
            displayName: type.display_name,
            primaryKey: type.primary_key_column,
            fields: type.fields.sort((a, b) => a.order - b.order)
        };
    }

    // Dynamically populate primaryKeys and pageConfig
    for (const tableName in tableSchemas) {
        primaryKeys[tableName] = tableSchemas[tableName].primaryKey;
        if (!pageConfig[`page-${tableName}`]) { // Avoid overwriting built-ins
            pageConfig[`page-${tableName}`] = {
                title: tableSchemas[tableName].displayName,
                subtitle: `Manage your ${tableSchemas[tableName].displayName.toLowerCase()}`,
                navText: tableSchemas[tableName].displayName
            };
        }
    }
    
    // TODO: Dynamically update the navigation sidebar with new tables
}
```

### 2. Generic Table Population and Rendering Logic

```javascript
async function populateTable(tableName, filters = {}) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        return;
    }

    const tableContainer = document.getElementById(`${tableName}-table-container`);
    const tableBody = tableContainer.querySelector('tbody');
    const tableHead = tableContainer.querySelector('thead tr');

    // 1. Dynamically render table headers
    tableHead.innerHTML = `<th><input type="checkbox" id="select-all-${tableName}"></th>`;
    schema.fields.forEach(field => {
        tableHead.innerHTML += `<th>${field.displayName}</th>`;
    });
    tableHead.innerHTML += `<th>Date Added</th><th>Status</th><th>Actions</th>`;

    // 2. Build and execute dynamic query
    const selectColumns = schema.fields.map(f => f.columnName).join(', ');
    let query = supabase.from(tableName).select(`created_at, ${selectColumns}`);
    // ... add dynamic filter logic here, similar to existing functions ...
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        // ... error handling ...
        return;
    }

    // 3. Dynamically render table rows
    if (data && data.length > 0) {
        tableBody.innerHTML = data.map(row => {
            const primaryKeyValue = row[schema.primaryKey];
            let cells = '<td><input type="checkbox" class="row-checkbox"></td>';
            
            schema.fields.forEach(field => {
                cells += `<td>${row[field.columnName] || 'N/A'}</td>`;
            });

            return `
                <tr>
                    ${cells}
                    <td>${formatDate(row.created_at)}</td>
                    <td><span class="status-badge status-success">Processed</span></td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${primaryKeyValue}" data-type="${tableName}">✏️</button>
                        <button class="action-btn delete-btn" data-id="${primaryKeyValue}" data-type="${tableName}">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        // ... empty table message ...
    }
}
```

### 3. Generic Edit Modal

```javascript
async function openEditModal(id, tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) return;

    const primaryKeyColumn = schema.primaryKey;

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(primaryKeyColumn, id)
        .single();

    if (error || !data) { /* ... error handling ... */ return; }

    currentEditRecord = { id, type: tableName, data };
    
    document.getElementById('edit-modal-title').textContent = `Edit ${schema.displayName}`;
    
    const formFields = document.getElementById('edit-form-fields');
    formFields.innerHTML = ''; // Clear old fields

    // Dynamically generate form fields
    schema.fields.forEach(field => {
        const value = data[field.columnName] || '';
        const inputType = field.dataType === 'NUMERIC' ? 'number' : field.dataType === 'DATE' ? 'date' : 'text';
        
        formFields.innerHTML += `
            <div class="form-group">
                <label for="edit-${field.columnName}">${field.displayName}</label>
                <input type="${inputType}" id="edit-${field.columnName}" data-column-name="${field.columnName}" class="form-input" value="${value}">
            </div>
        `;
    });
    
    document.getElementById('edit-modal').style.display = 'flex';
}
```

### 4. Generic Update Handler

```javascript
async function handleUpdate() {
    if (!currentEditRecord) return;

    const { type: tableName } = currentEditRecord;
    const schema = tableSchemas[tableName];
    if (!schema) return;

    let updateData = {};
    
    // Dynamically gather data from the form
    const formInputs = document.querySelectorAll('#edit-form-fields .form-input');
    formInputs.forEach(input => {
        const columnName = input.dataset.columnName;
        updateData[columnName] = input.value.trim();
    });

    const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq(schema.primaryKey, currentEditRecord.data[schema.primaryKey]);

    if (error) { /* ... error handling ... */ } 
    else {
        closeEditModal();
        showNotification(`${schema.displayName} updated successfully!`, 'success');
        populateTable(tableName); // Refresh the generic table
        fetchInitialDashboardData();
    }
}
```

## Phase 4: Adapting Existing Features

### Search & Filter
Move existing dynamic query-building logic into the new `populateTable` function and adapt to use the schema to determine searchable columns.

### Export
Create a generic `exportToCSV(tableName)` function that uses the schema to generate headers and rows. For specific formats like VCF, have special cases: if `tableName === 'business_cards'`, call `generateVCF()`. Otherwise, default to CSV.

### Event Delegation
Consolidate event listeners in `setupTableActionEventListeners` into one that listens on a common parent container for all tables.

## Maintaining Backwards Compatibility

By treating `business_cards` and `invoices` as the first two "types" in the new system and representing their schemas in the `tableSchemas` object, all new generic functions will work for them automatically. Replace old hardcoded functions with calls to new generic ones.

## Implementation Checklist

- [ ] Create database schema for custom table metadata (document_types and document_fields tables)
- [ ] Create secure Supabase RPC function for table creation
- [ ] Build UI for custom table schema definition
- [ ] Refactor existing code to use generic table operations
- [ ] Update navigation system to dynamically include custom tables
- [ ] Extend export functionality for custom tables

## Security Considerations

- All table creation goes through a secure RPC function with proper sanitization
- Row Level Security (RLS) is automatically applied to all custom tables
- Users can only access their own data
- Input validation prevents SQL injection attacks
- Column names and types are strictly controlled

## Future Enhancements

- Field validation rules (required fields, data format validation)
- Relationship mapping between custom tables
- Advanced field types (dropdown options, file uploads)
- Custom export templates
- Bulk import functionality for custom tables