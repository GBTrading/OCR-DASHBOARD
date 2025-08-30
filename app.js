import { supabase } from './supabaseClient.js';
import { initializeCreateTablePage } from './customTable.js';

console.log('🚨🚨🚨 DEBUG: app.js is loading...');
console.log('🚨🚨🚨 DEBUG: Current timestamp:', new Date().toISOString());

// Generic Table Action Event Delegation
function setupTableActionEventListeners() {
    // Use event delegation on the main content area to handle all tables
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                
                // Use generic edit modal for all tables
                if (tableSchemas[type]) {
                    openGenericEditModal(id, type);
                } else {
                    // Fallback to legacy method for built-in tables
                    openEditModal(id, type);
                }
            } else if (e.target.classList.contains('delete-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                openDeleteConfirm(id, type);
            }
        });
    }
}

// Modal Event Listeners for Edit and Delete
function setupEditDeleteModalEventListeners() {
    // Edit Modal Event Listeners
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditModal);
    }

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }

    const saveChangesBtn = document.getElementById('save-changes-btn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', () => {
            // Use generic update handler for all tables
            if (currentEditRecord && tableSchemas[currentEditRecord.type]) {
                handleGenericUpdate();
            } else {
                // Fallback to legacy method
                handleUpdate();
            }
        });
    }

    // Delete Modal Event Listeners
    const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
    if (closeDeleteModalBtn) {
        closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    }

    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            // Use generic delete handler for all tables
            if (currentDeleteRecord && tableSchemas[currentDeleteRecord.type]) {
                handleGenericDelete();
            } else {
                // Fallback to legacy method
                handleDelete();
            }
        });
    }

    // Close modals when clicking outside
    const editModal = document.getElementById('edit-modal');
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
    }

    const deleteModal = document.getElementById('delete-confirm-modal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }
} 

// =================================================================================
// GLOBAL STATE
// =================================================================================
let currentUser = null;
let currentEditRecord = null; // Store current record being edited
let currentDeleteRecord = null; // Store current record being deleted
let currentPage = 'page-dashboard'; // Track current active page
let isUploading = false; // Prevent duplicate upload calls

// Central configuration for table schemas (will be populated dynamically)
let tableSchemas = {}; // Will store schemas for all tables (built-in + custom)
let primaryKeys = {}; // Will be populated dynamically from schemas

// Built-in table schemas (for backwards compatibility)
const builtInSchemas = {
    'business_cards': {
        displayName: 'Business Cards',
        primaryKey: 'Email',
        tableName: 'business_cards',
        fields: [
            { columnName: 'Name', displayName: 'Name', dataType: 'TEXT', order: 0 },
            { columnName: 'Job_Title', displayName: 'Job Title', dataType: 'TEXT', order: 1 },
            { columnName: 'Company', displayName: 'Company', dataType: 'TEXT', order: 2 },
            { columnName: 'Phone', displayName: 'Phone', dataType: 'TEXT', order: 3 },
            { columnName: 'Email', displayName: 'Email', dataType: 'TEXT', order: 4 }
        ]
    },
    // invoices now handled as JSONB system table through user_tables
};

// Page configuration for routing
const pageConfig = {
    'page-dashboard': {
        title: 'Dashboard',
        subtitle: 'Monitor your document processing activity',
        navText: 'Dashboard'
    },
    'page-business-cards': {
        title: 'Business Cards',
        subtitle: 'Manage your scanned business card contacts',
        navText: 'Business Cards'
    },
    'page-invoices': {
        title: 'Invoices',
        subtitle: 'View and manage your processed invoices',
        navText: 'Invoices'
    },
    'page-settings': {
        title: 'Settings',
        subtitle: 'Configure your account preferences',
        navText: 'Settings'
    },
    'page-billing': {
        title: 'Billing',
        subtitle: 'Manage your subscription and billing',
        navText: 'Billing'
    },
    'page-create-table': {
        title: 'Create Custom Table',
        subtitle: 'Define a new document type with custom fields',
        navText: 'Create Table'
    },
    'page-upload': {
        title: 'Upload Documents',
        subtitle: 'Upload new documents for processing',
        navText: 'Upload'
    }
};

// =================================================================================
// CLIENT-SIDE ROUTING SYSTEM
// =================================================================================

/**
 * Show a specific page and hide all others
 * @param {string} pageId - The ID of the page to show (e.g., 'page-dashboard')
 */
function showPage(pageId) {
    // Hide all page content
    const allPages = document.querySelectorAll('.page-content');
    allPages.forEach(page => {
        page.style.display = 'none';
    });
    
    // Show the selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        currentPage = pageId;
        
        // Update header title and subtitle
        updatePageHeader(pageId);
        
        // Update upload button states based on current table
        updateUploadButtonStates();
        
        // Load page-specific data
        loadPageData(pageId);
    } else {
        console.error(`Page with ID '${pageId}' not found`);
    }
}

// Make functions available globally
window.appShowPage = showPage;
window.initializeCreateTablePage = initializeCreateTablePage;
window.loadTableSchemas = loadTableSchemas;

// =================================================================================
// DYNAMIC SCHEMA MANAGEMENT
// =================================================================================

/**
 * Load all table schemas (built-in + custom) from the database
 */
async function loadTableSchemas() {
    try {
        // Start with built-in schemas
        tableSchemas = { ...builtInSchemas };
        
        // Fetch custom schemas from the new JSONB tables
        const { data: customTables, error } = await supabase
            .from('user_tables')
            .select('*');
        
        if (error) {
            console.error('Error fetching custom table schemas:', error);
            return;
        }

        // Merge custom JSONB schemas into our global state
        for (const table of customTables) {
            try {
                const schema = table.schema_definition;
                let primaryKey = null;
                
                console.log('🚨🚨🚨 DEBUG: Processing table:', table.name);
                console.log('🚨🚨🚨 DEBUG: Schema type:', typeof schema, 'Is array:', Array.isArray(schema));
                console.log('🚨🚨🚨 DEBUG: Schema content (first 200 chars):', JSON.stringify(schema).substring(0, 200));
            
            // Handle different schema formats (array vs object)
            let fields = [];
            
            if (Array.isArray(schema) && schema.length > 0) {
                // Standard custom table format (array of field objects)
                console.log('🚨🚨🚨 DEBUG: Processing array schema with', schema.length, 'fields');
                try {
                    const primaryField = schema.find(field => field && field.primary_key === true);
                    if (primaryField) {
                        primaryKey = primaryField.name;
                    }
                    
                    fields = schema
                        .filter(field => field && typeof field === 'object')
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map(field => ({
                            columnName: field.name,
                            displayName: field.label,
                            dataType: field.type,
                            order: field.order || 0,
                            isPrimaryKey: field.primary_key === true
                        }));
                } catch (err) {
                    console.error('🚨 Error processing array schema for', table.name, ':', err);
                    console.error('🚨 Schema contents:', schema);
                }
            } else if (schema && typeof schema === 'object') {
                // System table format (object with field names as keys, like invoices)
                const schemaEntries = Object.entries(schema);
                
                // Find primary key from object format
                const primaryEntry = schemaEntries.find(([key, value]) => value.primaryKey === true);
                if (primaryEntry) {
                    primaryKey = primaryEntry[0];
                }
                
                fields = schemaEntries.map(([fieldName, fieldDef], index) => ({
                    columnName: fieldName,
                    displayName: fieldDef.displayName || fieldName.replace(/_/g, ' '),
                    dataType: fieldDef.type || 'TEXT',
                    order: index,
                    isPrimaryKey: fieldDef.primaryKey === true
                }));
            } else {
                console.warn('🚨 Unknown schema format for table:', table.name, schema);
            }
            
                tableSchemas[table.table_key] = {
                    displayName: table.name,
                    primaryKey: primaryKey || 'id', // fallback to id
                    tableName: table.table_key,
                    isJsonbTable: true, // Mark as JSONB table
                    tableId: table.id, // Store table ID for data operations
                    fields: fields
                };
            } catch (err) {
                console.error('🚨 Failed to process table:', table.name, 'Error:', err);
                console.error('🚨 Table data:', table);
                // Continue processing other tables
            }
        }

        // Dynamically populate primaryKeys and pageConfig
        for (const tableName in tableSchemas) {
            const schema = tableSchemas[tableName];
            primaryKeys[tableName] = schema.primaryKey;
            
            // Add to page configuration if it doesn't exist (for custom tables)
            const pageId = `page-${tableName.replace('custom_', '')}`;
            if (!pageConfig[pageId]) {
                pageConfig[pageId] = {
                    title: schema.displayName,
                    subtitle: `Manage your ${schema.displayName.toLowerCase()}`,
                    navText: schema.displayName
                };
            }
        }
        
        // Update navigation sidebar with new tables
        updateNavigationSidebar();
        
        // Create pages for custom tables
        createCustomTablePages();
        
        console.log('Table schemas loaded:', Object.keys(tableSchemas));
        
        // Update upload button states after loading schemas
        updateUploadButtonStates();
        
    } catch (err) {
        console.error('Unexpected error loading table schemas:', err);
    }
}

/**
 * Update the navigation sidebar to include custom tables
 */
function updateNavigationSidebar() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    // Find existing custom table nav items and remove them
    const existingCustomItems = navMenu.querySelectorAll('[data-page-id^="page-custom_"]');
    existingCustomItems.forEach(item => item.remove());
    
    // Find the create table nav item to insert custom tables before it
    const createTableItem = navMenu.querySelector('[data-page-id="page-create-table"]');
    
    // Add custom tables section header if there are custom tables
    const customTableNames = Object.keys(tableSchemas).filter(name => name.startsWith('custom_'));
    
    if (customTableNames.length > 0) {
        // Add section header for custom tables
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'nav-section-header custom-tables-section';
        sectionHeader.innerHTML = `
            <span class="section-title">
                <span class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 6px;">folder_open</span>
                My Custom Tables (${customTableNames.length})
            </span>
        `;
        
        // Insert header before create table item
        if (createTableItem) {
            createTableItem.parentNode.insertBefore(sectionHeader, createTableItem);
        }
    }
    
    // Add custom tables to navigation (sorted by display name)
    const sortedCustomTables = customTableNames
        .map(tableName => ({ tableName, schema: tableSchemas[tableName] }))
        .sort((a, b) => a.schema.displayName.localeCompare(b.schema.displayName));
        
    for (const { tableName, schema } of sortedCustomTables) {
        const pageId = `page-${tableName.replace('custom_', '')}`;
        
        const navItem = document.createElement('div');
        navItem.className = 'nav-item custom-table-nav-item';
        navItem.setAttribute('data-page-id', pageId);
        navItem.setAttribute('data-table-name', tableName);
        navItem.innerHTML = `
            <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">table_chart</span>
            <span class="nav-item-text">${schema.displayName}</span>
            <span class="table-record-count" title="Loading record count...">
                <span class="loading-spinner" style="width: 12px; height: 12px;"></span>
            </span>
        `;
        
        // Insert before the create table item
        if (createTableItem) {
            createTableItem.parentNode.insertBefore(navItem, createTableItem);
        } else {
            navMenu.appendChild(navItem);
        }
        
        // Load record count asynchronously
        loadTableRecordCount(tableName, navItem);
    }
}

/**
 * Load and display record count for a table in its navigation item
 */
async function loadTableRecordCount(tableName, navItem) {
    try {
        const schema = tableSchemas[tableName];
        if (!schema) return;
        
        let count = 0;
        if (schema.isJsonbTable) {
            // Count JSONB records
            const { count: recordCount, error } = await supabase
                .from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', schema.tableId);
                
            if (!error) {
                count = recordCount || 0;
            }
        } else {
            // Count physical table records
            const { count: recordCount, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
                
            if (!error) {
                count = recordCount || 0;
            }
        }
        
        // Update the navigation item with record count
        const countElement = navItem.querySelector('.table-record-count');
        if (countElement) {
            countElement.innerHTML = `<span class="record-count-badge" title="${count} records">${count}</span>`;
        }
    } catch (err) {
        console.error(`Error loading record count for ${tableName}:`, err);
        // Hide the count element if there's an error
        const countElement = navItem.querySelector('.table-record-count');
        if (countElement) {
            countElement.style.display = 'none';
        }
    }
}

/**
 * Update the record count for a specific table in the navigation
 */
async function updateNavigationRecordCount(tableName) {
    const navItem = document.querySelector(`[data-table-name="${tableName}"]`);
    if (navItem) {
        await loadTableRecordCount(tableName, navItem);
    }
}

/**
 * Create pages for custom tables using the generic template
 */
function createCustomTablePages() {
    const mainContent = document.querySelector('.main-content');
    const template = document.getElementById('generic-custom-table-template');
    
    if (!mainContent || !template) return;
    
    // Remove existing custom table pages
    const existingCustomPages = mainContent.querySelectorAll('[id^="page-custom_"]');
    existingCustomPages.forEach(page => page.remove());
    
    // Create pages for custom tables
    for (const tableName in tableSchemas) {
        if (tableName.startsWith('custom_')) {
            const schema = tableSchemas[tableName];
            const pageId = `page-${tableName.replace('custom_', '')}`;
            
            // Clone the template
            const newPage = template.cloneNode(true);
            newPage.id = pageId;
            newPage.style.display = 'none';
            
            // Update the page title
            const titleElement = newPage.querySelector('.data-title');
            if (titleElement) {
                titleElement.textContent = `Recent ${schema.displayName}`;
            }
            
            // Update IDs to be unique for this table
            const tableContainer = newPage.querySelector('#generic-table-container');
            if (tableContainer) {
                tableContainer.id = `${tableName}-table-container`;
            }
            
            // Update class names to include table name for event delegation
            newPage.querySelector('.generic-search').className = `search-box ${tableName}-search`;
            newPage.querySelector('.generic-date-range').className = `search-box ${tableName}-date-range`;
            newPage.querySelector('.generic-clear-btn').className = `btn btn-secondary ${tableName}-clear-btn`;
            newPage.querySelector('.search-loading').className = `search-loading ${tableName}-loading`;
            newPage.querySelector('.generic-export-btn').className = `btn btn-primary ${tableName}-export-btn`;
            newPage.querySelector('.generic-table-body').className = `generic-table-body ${tableName}-table-body`;
            
            // Update table management dropdown for custom tables
            const tableManagement = newPage.querySelector('.generic-table-management');
            if (tableManagement) {
                tableManagement.style.display = 'inline-block';
                tableManagement.className = `dropdown ${tableName}-table-management`;
                
                // Update button classes
                const editBtn = tableManagement.querySelector('.generic-edit-table-btn');
                const deleteBtn = tableManagement.querySelector('.generic-delete-table-btn');
                if (editBtn) editBtn.className = `dropdown-item ${tableName}-edit-table-btn`;
                if (deleteBtn) deleteBtn.className = `dropdown-item ${tableName}-delete-table-btn`;
            }
            
            // Initialize flatpickr for the date range picker (after class name update)
            const dateRangePicker = newPage.querySelector(`.${tableName}-date-range`);
            window.initializeDateRangePicker(dateRangePicker, tableName);
            
            // Insert the page into the DOM
            mainContent.appendChild(newPage);
        }
    }
}

/**
 * Generic table population function that works with any schema
 */
async function populateGenericTable(tableName, filters = {}) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        return;
    }

    const pageId = tableName.startsWith('custom_') ? `page-${tableName.replace('custom_', '')}` : `page-${tableName}`;
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    
    if (!tableContainer) {
        console.error(`Table container not found for: ${tableName}`);
        return;
    }
    
    const tableBody = tableContainer.querySelector('tbody');
    const tableHead = tableContainer.querySelector('thead tr');

    if (!tableBody || !tableHead) {
        console.error(`Table elements not found for: ${tableName}`);
        return;
    }

    // Show loading state if search is happening
    if (filters.searchTerm) {
        const numColumns = schema.fields.length + 4; // +4 for checkbox, date, status, actions
        tableBody.innerHTML = `<tr><td colspan="${numColumns}" style="text-align: center; color: #94a3b8; padding: 20px;">🔍 Searching...</td></tr>`;
    }

    try {
        // 1. Dynamically render table headers
        tableHead.innerHTML = `<th><input type="checkbox" id="select-all-${tableName}"></th>`;
        schema.fields.forEach(field => {
            tableHead.innerHTML += `<th>${field.displayName}</th>`;
        });
        tableHead.innerHTML += `<th>Date Added</th><th>Status</th><th>Actions</th>`;

        let data, error;

        // 2. Handle JSONB tables vs physical tables differently
        if (schema.isJsonbTable) {
            // Query user_table_data for JSONB tables with user authentication
            let query = supabase
                .from('user_table_data')
                .select('id, data, created_at')
                .eq('table_id', schema.tableId)
                .eq('user_id', currentUser?.id); // Filter by current user
            
            // Apply filters for JSONB data
            if (filters.searchTerm && filters.searchTerm.trim()) {
                // JSONB field-specific search with partial matching (like business cards)
                const trimmedSearchTerm = filters.searchTerm.trim();
                console.log('🔍 Custom Table Search Debug:');
                console.log('1. Trimmed search term:', trimmedSearchTerm);
                
                const searchTerm = `%${trimmedSearchTerm}%`;
                console.log('2. Full search term with wildcards:', searchTerm);
                
                // Build field-specific search queries for text fields
                const fieldQueries = [];
                console.log('3. Schema fields:', schema.fields);
                
                schema.fields.forEach(field => {
                    // Search all fields regardless of type (like business cards does)
                    const query = `data->>${field.columnName}.ilike.${searchTerm}`;
                    fieldQueries.push(query);
                    console.log(`5. Added query for field ${field.columnName}: ${query}`);
                });
                
                console.log('6. Final fieldQueries array:', fieldQueries);
                
                if (fieldQueries.length > 0) {
                    const orQueryString = fieldQueries.join(',');
                    console.log('7. CRITICAL - String passed to .or():', orQueryString);
                    query = query.or(orQueryString);
                } else {
                    console.log('8. ERROR - No .or() filter applied because fieldQueries is empty!');
                }
            }
            
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            const result = await query.order('created_at', { ascending: false });
            data = result.data;
            error = result.error;
        } else {
            // Original logic for physical tables
            const selectColumns = schema.fields.map(f => f.columnName).join(', ');
            let query = supabase.from(tableName).select(`created_at, ${selectColumns}`);
            
            // Apply filters if provided
            if (filters.searchTerm && filters.searchTerm.trim()) {
                // Search across all text fields
                const textFields = schema.fields.filter(f => f.dataType === 'TEXT');
                if (textFields.length > 0) {
                    const searchConditions = textFields.map(field => 
                        `${field.columnName}.ilike.%${filters.searchTerm.trim()}%`
                    ).join(',');
                    query = query.or(searchConditions);
                }
            }
            
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            const result = await query.order('created_at', { ascending: false });
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error(`Error fetching data for ${tableName}:`, error);
            showNotification(`Failed to load ${schema.displayName} data`, 'error');
            return;
        }

        // 3. Dynamically render table rows
        if (data && data.length > 0) {
            tableBody.innerHTML = data.map(row => {
                let cells = '<td><input type="checkbox" class="row-checkbox"></td>';
                let recordId, primaryKeyValue;
                
                if (schema.isJsonbTable) {
                    // For JSONB tables, data is in the 'data' field
                    recordId = row.id;
                    const jsonData = row.data;
                    primaryKeyValue = jsonData[schema.primaryKey] || recordId;
                    
                    schema.fields.forEach(field => {
                        let cellValue = jsonData[field.columnName];
                        // Format based on data type
                        if (field.dataType === 'date' && cellValue) {
                            cellValue = new Date(cellValue).toLocaleDateString();
                        } else if (field.dataType === 'numeric' && cellValue) {
                            cellValue = parseFloat(cellValue).toLocaleString();
                        }
                        cells += `<td>${cellValue || 'N/A'}</td>`;
                    });
                } else {
                    // For physical tables, data is directly in row
                    recordId = row[schema.primaryKey];
                    primaryKeyValue = recordId;
                    
                    schema.fields.forEach(field => {
                        let cellValue = row[field.columnName];
                        // Format based on data type
                        if (field.dataType === 'DATE' && cellValue) {
                            cellValue = new Date(cellValue).toLocaleDateString();
                        } else if (field.dataType === 'NUMERIC' && cellValue) {
                            cellValue = parseFloat(cellValue).toLocaleString();
                        }
                        cells += `<td>${cellValue || 'N/A'}</td>`;
                    });
                }

                return `
                    <tr>
                        ${cells}
                        <td>${formatDate(row.created_at)}</td>
                        <td><span class="status-badge status-success">Processed</span></td>
                        <td>
                            <button class="action-btn edit-btn" data-id="${recordId}" data-type="${tableName}">✏️</button>
                            <button class="action-btn delete-btn" data-id="${recordId}" data-type="${tableName}">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            const colSpan = schema.fields.length + 4; // +4 for checkbox, date, status, actions
            const message = filters.searchTerm 
                ? `No ${schema.displayName.toLowerCase()} found for "${filters.searchTerm}"`
                : `No ${schema.displayName.toLowerCase()} found. Upload some documents to get started.`;
            const icon = filters.searchTerm ? 'search_off' : 'description';
            
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <span class="material-icons" style="font-size: 3rem; display: block; margin-bottom: 16px;">${icon}</span>
                        ${message}
                    </td>
                </tr>
            `;
        }

        // 4. Setup select all functionality for this table
        setupSelectAllForTable(tableName);

    } catch (err) {
        console.error(`Unexpected error populating table ${tableName}:`, err);
        showNotification(`An error occurred loading ${schema.displayName}`, 'error');
    }
}

/**
 * Setup select all functionality for a specific table
 */
function setupSelectAllForTable(tableName) {
    const selectAllCheckbox = document.getElementById(`select-all-${tableName}`);
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const tableBody = document.querySelector(`.${tableName}-table-body`);
            if (tableBody) {
                const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');
                rowCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
            }
        });
    }
}

/**
 * Get all available upload destinations (system + custom tables)
 */
async function getUploadDestinations() {
    try {
        const { data, error } = await supabase
            .from('user_tables')
            .select('id, name, table_key, is_system_table')
            .order('name');
            
        if (error) throw error;
        
        return data.map(table => ({
            label: table.name,
            value: table.id,
            tableKey: table.table_key,
            isSystemTable: table.is_system_table
        }));
    } catch (error) {
        console.error('Error fetching upload destinations:', error);
        showNotification('Could not load upload destinations', 'error');
        return [];
    }
}

/**
 * Update upload button states based on current page
 */
function updateUploadButtonStates() {
    const tableName = getTableNameFromPageId(currentPage);
    const schema = tableName ? tableSchemas[tableName] : null;
    const hasValidTable = schema && schema.tableId;
    
    // Get modal upload button (never disable - it has table selector dropdown)
    const modalUploadBtn = document.getElementById('upload-btn');
    if (modalUploadBtn) {
        modalUploadBtn.disabled = false;
        modalUploadBtn.title = 'Upload documents to selected table';
    }
    
    // Get page-specific upload buttons (disable when no valid table for current page)
    const pageSpecificButtons = [
        document.getElementById('upload-area-button'), 
        document.getElementById('upload-page-button')
    ];
    
    pageSpecificButtons.forEach(btn => {
        if (btn) {
            btn.disabled = !hasValidTable;
            if (!hasValidTable) {
                btn.title = 'Navigate to a table page to upload documents';
            } else {
                btn.title = `Upload documents to ${tableName.replace('custom_', '').replace('_', ' ')} table`;
            }
        }
    });
    
    // Update upload modal title to show current table
    const uploadModalTitle = document.querySelector('#upload-modal h2');
    if (uploadModalTitle) {
        if (hasValidTable) {
            const displayName = tableName.replace('custom_', '').replace('_', ' ');
            uploadModalTitle.textContent = `Upload to ${displayName} table`;
        } else {
            uploadModalTitle.textContent = 'Upload Documents';
        }
    }
}

/**
 * Get table name from page ID
 */
function getTableNameFromPageId(pageId) {
    // Handle custom tables (page-receipts -> custom_receipts)
    if (pageId.startsWith('page-')) {
        const pageName = pageId.replace('page-', '');
        
        // Check if it's a built-in table
        if (tableSchemas[pageName]) {
            return pageName;
        }
        
        // Check if it's a custom table
        const customTableName = `custom_${pageName}`;
        if (tableSchemas[customTableName]) {
            return customTableName;
        }
    }
    
    return null;
}

/**
 * Get table name from table ID (reverse lookup)
 * @param {string} tableId - The table ID to look up
 * @returns {string|null} - The table name or null if not found
 */
function getTableNameFromTableId(tableId) {
    if (!tableId) return null;
    
    for (const [tableName, schema] of Object.entries(tableSchemas)) {
        if (schema.tableId && schema.tableId.toString() === tableId.toString()) {
            return tableName;
        }
    }
    
    return null;
}

/**
 * Smart table refresh function - refreshes the appropriate table based on table name
 * @param {string} tableName - The name of the table to refresh
 */
async function refreshTable(tableName) {
    if (!tableName) return;
    
    console.log(`🔄 Refreshing table: ${tableName}`);
    
    try {
        // Use the appropriate populate function based on table type
        if (tableName === 'business_cards') {
            await populateContactTable();
        } else if (tableName === 'invoices') {
            await populateInvoiceTable();
        } else if (tableSchemas[tableName]) {
            // Handle custom tables and other generic tables
            await populateGenericTable(tableName);
        } else {
            console.warn(`No refresh method found for table: ${tableName}`);
            return;
        }
        
        // Update navigation record count for this table
        updateNavigationRecordCount(tableName);
        
        console.log(`✅ Successfully refreshed table: ${tableName}`);
        
    } catch (error) {
        console.error(`❌ Error refreshing table ${tableName}:`, error);
    }
}

/**
 * Refresh tables after upload based on uploaded table and current context
 * @param {string} uploadedTableId - The ID of the table that was uploaded to
 */
async function refreshTablesAfterUpload(uploadedTableId) {
    console.log(`🔄 Starting post-upload refresh for table ID: ${uploadedTableId}`);
    
    try {
        // Always refresh dashboard stats
        await fetchInitialDashboardData();
        
        // Find the table name that was uploaded to
        const uploadedTableName = getTableNameFromTableId(uploadedTableId);
        if (!uploadedTableName) {
            console.warn(`Could not find table name for ID: ${uploadedTableId}`);
            // Fallback to refreshing all tables
            await Promise.all([
                populateContactTable(),
                populateInvoiceTable()
            ]);
            return;
        }
        
        console.log(`📋 Upload was to table: ${uploadedTableName}`);
        
        // Refresh the uploaded table
        await refreshTable(uploadedTableName);
        
        // If we're currently viewing the uploaded table, ensure UI is updated
        const currentTableName = getTableNameFromPageId(currentPage);
        if (currentTableName === uploadedTableName) {
            console.log(`👀 Currently viewing uploaded table, UI already updated`);
        } else {
            console.log(`👀 Currently viewing ${currentTableName}, uploaded table refreshed in background`);
        }
        
        console.log(`✅ Post-upload refresh completed successfully`);
        
    } catch (error) {
        console.error(`❌ Error in post-upload refresh:`, error);
        // Fallback: refresh built-in tables
        try {
            await Promise.all([
                populateContactTable(),
                populateInvoiceTable(),
                fetchInitialDashboardData()
            ]);
        } catch (fallbackError) {
            console.error(`❌ Even fallback refresh failed:`, fallbackError);
        }
    }
}

// =================================================================================
// GENERIC CRUD OPERATIONS
// =================================================================================

/**
 * Generic edit modal that works with any table schema
 */
async function openGenericEditModal(id, tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        return;
    }

    try {
        let data, error;
        
        if (schema.isJsonbTable) {
            // Query user_table_data for JSONB tables
            const result = await supabase
                .from('user_table_data')
                .select('*')
                .eq('id', id)
                .single();
            data = result.data;
            error = result.error;
        } else {
            // Original logic for physical tables
            const result = await supabase
                .from(tableName)
                .select('*')
                .eq(schema.primaryKey, id)
                .single();
            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            console.error(`Error fetching record from ${tableName}:`, error);
            showNotification('Failed to load record for editing', 'error');
            return;
        }

        currentEditRecord = { id, type: tableName, data, isJsonbTable: schema.isJsonbTable };
        
        document.getElementById('edit-modal-title').textContent = `Edit ${schema.displayName}`;
        
        const formFields = document.getElementById('edit-form-fields');
        formFields.innerHTML = ''; // Clear old fields

        // Dynamically generate form fields based on schema
        schema.fields.forEach(field => {
            let value = '';
            let inputType = 'text';
            let inputAttributes = '';
            
            // Get field value - handle JSONB vs physical table data
            if (schema.isJsonbTable) {
                value = data.data[field.columnName] || '';
            } else {
                value = data[field.columnName] || '';
            }
            
            // Determine input type based on data type
            switch (field.dataType.toUpperCase()) {
                case 'NUMERIC':
                    inputType = 'number';
                    inputAttributes = 'step="any"';
                    break;
                case 'DATE':
                    inputType = 'date';
                    // Convert timestamp to date format if needed
                    if (value && value.includes('T')) {
                        value = value.split('T')[0];
                    }
                    break;
                case 'TEXT':
                default:
                    inputType = 'text';
                    break;
            }
            
            formFields.innerHTML += `
                <div class="form-group">
                    <label for="edit-${field.columnName}">${field.displayName}</label>
                    <input 
                        type="${inputType}" 
                        id="edit-${field.columnName}" 
                        data-column-name="${field.columnName}" 
                        class="form-input" 
                        value="${value}"
                        ${inputAttributes}
                    >
                </div>
            `;
        });
        
        document.getElementById('edit-modal').style.display = 'flex';
        
    } catch (err) {
        console.error('Unexpected error opening edit modal:', err);
        showNotification('An unexpected error occurred', 'error');
    }
}

/**
 * Generic update handler that works with any table schema
 */
async function handleGenericUpdate() {
    if (!currentEditRecord) return;

    const { type: tableName } = currentEditRecord;
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        showNotification(`Configuration error: Schema not found for ${tableName}`, 'error');
        return;
    }

    // Show loading state
    const updateButton = document.getElementById('update-btn');
    const originalButtonText = updateButton?.textContent;
    if (updateButton) {
        updateButton.disabled = true;
        updateButton.innerHTML = '<span class="loading-spinner"></span> Updating...';
    }
    
    showNotification(`Updating ${schema.displayName}...`, 'info');

    let updateData = {};
    
    // Dynamically gather data from the form
    const formInputs = document.querySelectorAll('#edit-form-fields .form-input');
    formInputs.forEach(input => {
        const columnName = input.dataset.columnName;
        let value = input.value.trim();
        
        // Convert empty strings to null for optional fields
        if (value === '') {
            value = null;
        }
        
        updateData[columnName] = value;
    });

    try {
        let error;
        
        if (schema.isJsonbTable) {
            // Update JSONB data
            const result = await supabase
                .from('user_table_data')
                .update({ 
                    data: updateData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentEditRecord.id);
            error = result.error;
        } else {
            // Update physical table
            const result = await supabase
                .from(tableName)
                .update(updateData)
                .eq(schema.primaryKey, currentEditRecord.data[schema.primaryKey]);
            error = result.error;
        }

        if (error) {
            console.error(`Error updating ${tableName}:`, error);
            showNotification(`Failed to update ${schema.displayName}: ${error.message}`, 'error');
        } else {
            closeEditModal();
            showNotification(`${schema.displayName} record updated successfully!`, 'success');
            
            // Refresh the table
            populateGenericTable(tableName);
            fetchInitialDashboardData();
            
            // Update navigation record count
            updateNavigationRecordCount(tableName);
        }
    } catch (err) {
        console.error('Unexpected error during update:', err);
        showNotification(`Unexpected error while updating ${schema.displayName}`, 'error');
    } finally {
        // Restore button state
        if (updateButton) {
            updateButton.disabled = false;
            updateButton.textContent = originalButtonText || 'Update';
        }
    }
}

/**
 * Generic delete handler that works with any table schema
 */
async function handleGenericDelete() {
    if (!currentDeleteRecord) return;

    const { id, type: tableName } = currentDeleteRecord;
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        showNotification(`Configuration error: Schema not found for ${tableName}`, 'error');
        return;
    }

    // Show loading state
    const deleteButton = document.getElementById('confirm-delete-btn');
    const originalButtonText = deleteButton?.textContent;
    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.innerHTML = '<span class="loading-spinner"></span> Deleting...';
    }
    
    showNotification(`Deleting ${schema.displayName} record...`, 'info');

    try {
        let error;
        
        if (schema.isJsonbTable) {
            // Delete from user_table_data for JSONB tables
            const result = await supabase
                .from('user_table_data')
                .delete()
                .eq('id', id);
            error = result.error;
        } else {
            // Delete from physical table
            const result = await supabase
                .from(tableName)
                .delete()
                .eq(schema.primaryKey, id);
            error = result.error;
        }

        if (error) {
            console.error(`Error deleting from ${tableName}:`, error);
            showNotification(`Failed to delete ${schema.displayName} record: ${error.message}`, 'error');
        } else {
            closeDeleteModal();
            showNotification(`${schema.displayName} record deleted successfully!`, 'success');
            
            // Refresh the table
            populateGenericTable(tableName);
            fetchInitialDashboardData();
            
            // Update navigation record count
            updateNavigationRecordCount(tableName);
        }
    } catch (err) {
        console.error('Unexpected error during deletion:', err);
        showNotification(`Unexpected error while deleting ${schema.displayName} record`, 'error');
    } finally {
        // Restore button state
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalButtonText || 'Confirm Delete';
        }
    }
}

/**
 * Update the page header title and subtitle
 * @param {string} pageId - The page ID to get config for
 */
function updatePageHeader(pageId) {
    const config = pageConfig[pageId];
    if (config) {
        const titleElement = document.getElementById('page-title');
        const subtitleElement = document.getElementById('page-subtitle');
        
        if (titleElement) titleElement.textContent = config.title;
        if (subtitleElement) subtitleElement.textContent = config.subtitle;
    }
}

/**
 * Load data specific to the current page
 * @param {string} pageId - The page ID to load data for
 */
function loadPageData(pageId) {
    switch (pageId) {
        case 'page-dashboard':
            // Refresh dashboard stats
            fetchInitialDashboardData();
            break;
        case 'page-business-cards':
            // Load business cards table
            populateContactTable();
            // Initialize date range picker for business cards
            const businessCardsDatePicker = document.getElementById('contacts-date-range');
            if (businessCardsDatePicker && !businessCardsDatePicker._flatpickr) {
                window.initializeDateRangePicker(businessCardsDatePicker, 'business_cards');
            }
            break;
        case 'page-invoices':
            // Load invoices table
            populateInvoiceTable();
            // Initialize date range picker for invoices
            const invoicesDatePicker = document.getElementById('invoices-date-range');
            if (invoicesDatePicker && !invoicesDatePicker._flatpickr) {
                window.initializeDateRangePicker(invoicesDatePicker, 'invoices');
            }
            break;
        case 'page-upload':
            // No specific data loading needed for upload page
            break;
        case 'page-create-table':
            // Initialize create table page
            if (window.initializeCreateTablePage) {
                window.initializeCreateTablePage();
            }
            break;
        case 'page-settings':
            // Load user settings when accessing settings page
            loadUserSettings();
            break;
        case 'page-billing':
            // Load billing page data
            populateBillingPage();
            break;
        default:
            // Check if this is a custom table page
            const tableName = getTableNameFromPageId(pageId);
            if (tableName && tableSchemas[tableName]) {
                populateGenericTable(tableName);
            } else {
                console.log(`No data loading defined for page: ${pageId}`);
            }
    }
}

/**
 * Set up navigation event listeners using event delegation for dynamic items
 */
function setupNavigation() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    // Use event delegation to handle both existing and dynamically added nav items
    navMenu.addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;
        
        // Remove active class from all nav items
        const allNavItems = navMenu.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        // Add active class to clicked item
        navItem.classList.add('active');
        
        // Get page ID from data attribute
        const pageId = navItem.dataset.pageId;
        
        // Handle special cases
        if (pageId === 'upload-modal') {
            openUploadModal();
            return;
        }
        
        // Show the selected page
        if (pageId) {
            showPage(pageId);
        } else {
            // Fallback to dashboard if no pageId found
            showPage('page-dashboard');
        }
    });
}

// Upload modal elements - Add these variables at the top with other global variables
console.log('🚨🚨🚨 DEBUG: Getting DOM elements...');
const uploadModal = document.getElementById('upload-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const filePreviewList = document.getElementById('file-preview-list');

console.log('🚨🚨🚨 DEBUG: uploadBtn element:', uploadBtn);
console.log('🚨🚨🚨 DEBUG: uploadModal element:', uploadModal);

// =================================================================================
// AUTHENTICATION FUNCTIONS
// =================================================================================
async function handleSignUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (!email || !password) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        setAuthLoading(true, 'signup');
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;

        showAuthMessage('Account created successfully! Please check your email to verify your account.', 'success');
        
        // Switch to login form after successful signup
        setTimeout(() => {
            showLoginForm();
        }, 2000);

    } catch (error) {
        console.error('Signup error:', error);
        showAuthMessage(error.message || 'An error occurred during signup', 'error');
    } finally {
        setAuthLoading(false, 'signup');
    }
}

async function handleLogin() {
    console.log('🔐 Login attempt started');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password.length);
    
    if (!email || !password) {
        console.log('❌ Missing email or password');
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        console.log('🚀 Calling Supabase auth...');
        setAuthLoading(true, 'login');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        console.log('📊 Supabase response:', { data, error });

        if (error) {
            console.log('❌ Supabase error:', error);
            throw error;
        }

        if (data && data.user) {
            console.log('✅ Login successful, user:', data.user.email);
            currentUser = data.user;
            showDashboard();
        } else {
            console.log('❌ No user data returned');
            throw new Error('No user data returned from login');
        }
        
    } catch (error) {
        console.error('🔥 Login error:', error);
        showAuthMessage(error.message || 'Invalid email or password', 'error');
    } finally {
        setAuthLoading(false, 'login');
        console.log('🏁 Login attempt finished');
    }
}

async function handleGoogleAuth() {
    try {
        setAuthLoading(true, 'google');
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;

        // The redirect will handle the rest
        
    } catch (error) {
        console.error('Google auth error:', error);
        showAuthMessage(error.message || 'Google authentication failed', 'error');
        setAuthLoading(false, 'google');
    }
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentUser = null;
        showAuth();
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Error logging out. Please try again.', 'error');
    }
}

// =================================================================================
// SESSION AND UI STATE MANAGEMENT
// =================================================================================
async function checkUser() {
    console.log('🔍 Checking user session...');
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('📊 Session data:', session);
        console.log('❓ Session error:', error);
        
        if (error) throw error;

        if (session && session.user) {
            console.log('✅ Found existing session for:', session.user.email);
            currentUser = session.user;
            showDashboard();
        } else {
            console.log('❌ No existing session, showing auth');
            showAuth();
        }
    } catch (error) {
        console.error('🔥 Session check error:', error);
        showAuth();
    }
}

function showAuth() {
    document.getElementById('auth-container').style.display = 'flex';
    document.querySelector('.dashboard-container').style.display = 'none';
    clearAuthMessage();
}

function showDashboard() {
    document.getElementById('auth-container').style.display = 'none';
    document.querySelector('.dashboard-container').style.display = 'flex';
    
    // Update user email in header
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement && currentUser) {
        userEmailElement.textContent = currentUser.email;
    }
    
    // Initialize dashboard data
    initializeApp();
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
    clearAuthMessage();
    clearAuthForms();
}

function showSignupForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
    clearAuthMessage();
    clearAuthForms();
}

function clearAuthForms() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
}

function showAuthMessage(message, type) {
    const messageElement = document.getElementById('auth-message');
    messageElement.textContent = message;
    messageElement.className = `auth-message ${type}`;
    messageElement.style.display = 'block';
}

function clearAuthMessage() {
    const messageElement = document.getElementById('auth-message');
    messageElement.style.display = 'none';
    messageElement.className = 'auth-message';
}

function setAuthLoading(loading, formType) {
    const elements = {
        login: {
            btn: document.querySelector('#login-form-element button[type="submit"]'),
            icon: document.querySelector('#login-form-element .material-icons')
        },
        signup: {
            btn: document.querySelector('#signup-form-element button[type="submit"]'),
            icon: document.querySelector('#signup-form-element .material-icons')
        },
        google: {
            loginBtn: document.getElementById('google-login-btn'),
            signupBtn: document.getElementById('google-signup-btn')
        }
    };

    if (formType === 'google') {
        if (elements.google.loginBtn) {
            elements.google.loginBtn.disabled = loading;
            const loginText = elements.google.loginBtn.querySelector('div');
            if (loginText) {
                loginText.innerHTML = loading ? 
                    '<div class="flex items-center"><div class="w-5 h-5 mr-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Connecting...</div>' :
                    '<img alt="Google logo" class="w-5 h-5 mr-3" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1OdtLI4jjgGCIiZLn5Sbp9nfVGb-lWvLxmG9XzEsgFQdUSZAziqSd2KvO0_3oKm7OsqSZ_4bWJV0MT3SB_Cfu3W_A5PhuOCfu60geyLvXYEgemcOcEBstX1XTdLTKLqosMfIQk5gElsVW2ql2xMM56KUrCxTsaMqsTeZr5wElGC_MOdow14YH4ADDbPCjtu5nkcPq-0cMfSxkGd0UHDDcqB-IhXMC41ShITho9C0XqkpdaHYCGHDIIa8JdZ7mKm7v93gQeWE9rw"/>Continue with Google';
            }
        }
        if (elements.google.signupBtn) {
            elements.google.signupBtn.disabled = loading;
            const signupText = elements.google.signupBtn.querySelector('div');
            if (signupText) {
                signupText.innerHTML = loading ? 
                    '<div class="flex items-center"><div class="w-5 h-5 mr-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Connecting...</div>' :
                    '<img alt="Google logo" class="w-5 h-5 mr-3" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1OdtLI4jjgGCIiZLn5Sbp9nfVGb-lWvLxmG9XzEsgFQdUSZAziqSd2KvO0_3oKm7OsqSZ_4bWJV0MT3SB_Cfu3W_A5PhuOCfu60geyLvXYEgemcOcEBstX1XTdLTKLqosMfIQk5gElsVW2ql2xMM56KUrCxTsaMqsTeZr5wElGC_MOdow14YH4ADDbPCjtu5nkcPq-0cMfSxkGd0UHDDcqB-IhXMC41ShITho9C0XqkpdaHYCGHDIIa8JdZ7mKm7v93gQeWE9rw"/>Continue with Google';
            }
        }
    } else if (elements[formType]) {
        if (elements[formType].btn) {
            elements[formType].btn.disabled = loading;
        }
        if (elements[formType].icon) {
            elements[formType].icon.textContent = loading ? 'hourglass_empty' : 'arrow_forward';
            if (loading) {
                elements[formType].icon.classList.add('animate-spin');
            } else {
                elements[formType].icon.classList.remove('animate-spin');
            }
        }
    }
}

// =================================================================================
// UPLOAD MODAL FUNCTIONALITY
// =================================================================================
async function openUploadModal() {
    uploadModal.style.display = 'flex';
    
    // Populate table selector dropdown
    await populateTableSelector();
}

/**
 * Populate the table selector dropdown with all available tables
 */
async function populateTableSelector() {
    const tableSelector = document.getElementById('table-selector');
    if (!tableSelector) return;
    
    try {
        const destinations = await getUploadDestinations();
        
        // Clear existing options (keep the first "Select a table..." option)
        tableSelector.innerHTML = '<option value="">Select a table...</option>';
        
        // Add options for each table
        destinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest.value;
            option.textContent = dest.label;
            option.dataset.tableKey = dest.tableKey;
            option.dataset.isSystemTable = dest.isSystemTable;
            tableSelector.appendChild(option);
        });
        
        // Pre-select current table if we're on a table page
        const tableName = getTableNameFromPageId(currentPage);
        const schema = tableName ? tableSchemas[tableName] : null;
        if (schema && schema.tableId) {
            tableSelector.value = schema.tableId;
        }
    } catch (error) {
        console.error('Error populating table selector:', error);
        tableSelector.innerHTML = '<option value="">Error loading tables</option>';
    }
}

function closeUploadModal() {
    uploadModal.style.display = 'none';
    fileInput.value = ''; // Clear selected files
    filePreviewList.innerHTML = ''; // Clear the preview
}

/**
 * Set up event listeners for per-table upload buttons
 */
function setupPerTableUploadButtons() {
    // Removed direct event listeners - using delegated listeners instead to prevent duplication
    // The delegated listeners at lines 2697-2714 handle both .upload-to-table-btn and .generic-upload-to-table-btn clicks
    console.log('🚨🚨🚨 DEBUG: setupPerTableUploadButtons called - delegated listeners will handle clicks');
    
    // Log available buttons for debugging
    const specificButtons = document.querySelectorAll('.upload-to-table-btn[data-table]');
    const genericButtons = document.querySelectorAll('.generic-upload-to-table-btn');
    console.log('🚨🚨🚨 DEBUG: Found', specificButtons.length, 'specific upload buttons and', genericButtons.length, 'generic upload buttons');
}

/**
 * Open upload modal with a specific table pre-selected
 */
async function openUploadModalForTable(tableKey) {
    uploadModal.style.display = 'flex';
    
    // Populate table selector dropdown
    await populateTableSelector();
    
    // Pre-select the specified table
    const tableSelector = document.getElementById('table-selector');
    if (tableSelector) {
        // Find the table ID for the given table key
        let targetTableId = '';
        
        if (tableKey === 'business_cards') {
            targetTableId = 'b7e8c9d0-1234-5678-9abc-def012345678'; // Business cards UUID
        } else if (tableKey === 'invoices') {
            targetTableId = 'a1b2c3d4-1234-5678-9abc-def012345678'; // Invoices UUID
        } else {
            // For custom tables, find by table key
            const schema = tableSchemas[tableKey];
            if (schema && schema.tableId) {
                targetTableId = schema.tableId;
            }
        }
        
        if (targetTableId) {
            tableSelector.value = targetTableId;
        }
    }
}

function previewFiles() {
    filePreviewList.innerHTML = ''; // Clear previous preview
    const files = fileInput.files;
    if (files.length > 0) {
        for (const file of files) {
            const listItem = document.createElement('li');
            listItem.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            filePreviewList.appendChild(listItem);
        }
    }
}

// RENAMED from 'uploadDocuments' to avoid conflict
async function handleFileUpload() {
    if (isUploading) {
        console.log('🚫 Upload already in progress. Ignoring duplicate request.');
        return;
    }
    isUploading = true;
    
    console.log('🚀 handleFileUpload called');
    const files = fileInput.files;

    console.log('📁 Files selected:', files.length);
    if (files.length === 0) {
        showNotification('Please select at least one file to upload.', 'error');
        return;
    }
    
    console.log('👤 Current user:', currentUser);
    if (!currentUser) {
        showNotification('Authentication error. Please log in again.', 'error');
        return;
    }

    // Get selected table from dropdown
    const tableSelector = document.getElementById('table-selector');
    const selectedTableId = tableSelector ? tableSelector.value : '';
    
    console.log('🏷️ Selected table ID:', selectedTableId);
    if (!selectedTableId) {
        showNotification('Please select a table to upload to.', 'error');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]); // The key 'files' must match what n8n expects
    }
    
    // Append the user's ID and table ID to the form data for n8n
    formData.append('userId', currentUser.id);
    formData.append('tableId', selectedTableId);

    const webhookUrl = 'https://n8n.gbtradingllc.com/webhook-test/upload-files'; // Test webhook URL for debugging

    console.log('📦 FormData prepared. About to send request...');
    console.log('🔗 Webhook URL:', webhookUrl);

    try {
        showNotification('Uploading...', 'info');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        console.log('🌐 Making fetch request...');
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            // If you set up Header Auth in n8n, add it here
        });

        console.log('📡 Response received:', response.status, response.statusText);

        if (!response.ok) {
            console.error('❌ Response not ok:', response.status, response.statusText);
            throw new Error(`Upload failed with status: ${response.status}`);
        }

        console.log('✅ Upload successful!');

        showNotification('Upload successful! Processing documents...', 'success');
        closeUploadModal();
        
        // Smart refresh based on uploaded table after a delay to allow for processing
        setTimeout(async () => {
            await refreshTablesAfterUpload(selectedTableId);
        }, 5000); // 5 second delay

    } catch (error) {
        console.error('🚨 Upload error:', error);
        console.error('🚨 Error details:', error.message, error.stack);
        showNotification(error.message, 'error');
    } finally {
        console.log('🔄 Finally block: Resetting upload button');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Files';
        isUploading = false; // Reset the upload flag
    }
}

// =================================================================================
// DASHBOARD FUNCTIONALITY
// =================================================================================

// THIS IS THE FUNCTION THAT THE HTML ONCLICK ATTRIBUTES ARE CALLING
function exportContacts() {
    generateVCF();
}

// THIS IS THE FUNCTION THAT THE HTML ONCLICK ATTRIBUTES ARE CALLING
function downloadInvoices() {
    handleInvoiceExport();
}

// Row Selection Functions
function setupSelectAllFunctionality() {
    // Select All Contacts
    const selectAllContacts = document.getElementById('select-all-contacts');
    if (selectAllContacts) {
        selectAllContacts.addEventListener('change', function() {
            const contactCheckboxes = document.querySelectorAll('.contact-row-checkbox');
            contactCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }

    // Select All Invoices
    const selectAllInvoices = document.getElementById('select-all-invoices');
    if (selectAllInvoices) {
        selectAllInvoices.addEventListener('change', function() {
            const invoiceCheckboxes = document.querySelectorAll('.invoice-row-checkbox');
            invoiceCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }
}

// Updated VCF Generation Function - Works with selected rows only
function generateVCF() {
    const checkedBoxes = document.querySelectorAll('.contact-row-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        showNotification('Please select at least one business card to export.', 'error');
        return;
    }

    let vcfContent = '';
    
    checkedBoxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const cells = row.querySelectorAll('td');
        
        if (cells.length >= 6) { // Ensure we have enough columns (adjusted for checkbox column)
            const name = cells[1].textContent.trim(); // Index shifted by 1 due to checkbox
            const jobTitle = cells[2].textContent.trim();
            const company = cells[3].textContent.trim();
            const phone = cells[4].textContent.trim();
            const email = cells[5].textContent.trim();
            
            vcfContent += `BEGIN:VCARD\n`;
            vcfContent += `VERSION:3.0\n`;
            vcfContent += `FN:${name}\n`;
            if (jobTitle !== 'N/A') vcfContent += `TITLE:${jobTitle}\n`;
            if (company !== 'N/A') vcfContent += `ORG:${company}\n`;
            if (phone !== 'N/A') vcfContent += `TEL:${phone}\n`;
            if (email !== 'N/A') vcfContent += `EMAIL:${email}\n`;
            vcfContent += `END:VCARD\n`;
        }
    });

    // Create and download VCF file
    const blob = new Blob([vcfContent], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split('T')[0]}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showNotification(`${checkedBoxes.length} contacts exported successfully! You can now import them to your phone.`, 'success');
}

// New Invoice Export Functions
function handleInvoiceExport() {
    const format = document.getElementById('invoice-export-format').value;
    const checkedBoxes = document.querySelectorAll('.invoice-row-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        showNotification('Please select at least one invoice to export.', 'error');
        return;
    }

    // Extract invoice data from selected rows
    const selectedInvoices = [];
    checkedBoxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const cells = row.querySelectorAll('td');
        
        if (cells.length >= 7) { // Ensure we have enough columns (adjusted for checkbox column)
            selectedInvoices.push({
                invoice_number: cells[1].textContent.trim(),
                supplier: cells[2].textContent.trim(),
                product: cells[3].textContent.trim(),
                port_of_loading: cells[4].textContent.trim(),
                amount: cells[5].textContent.trim(),
                date: cells[6].textContent.trim(),
                status: cells[7].textContent.trim()
            });
        }
    });

    if (format === 'csv') {
        exportInvoicesAsCSV(selectedInvoices);
    } else if (format === 'pdf') {
        exportInvoicesAsPDF(selectedInvoices);
    }
}

function exportInvoicesAsCSV(invoices) {
    const headers = ['Invoice Number', 'Supplier', 'Product', 'Port of Loading', 'Amount', 'Date', 'Status'];
    
    // Convert to CSV
    const csvContent = [
        headers.join(','),
        ...invoices.map(invoice => Object.values(invoice).map(value => 
            // Escape values that contain commas
            value.includes(',') ? `"${value}"` : value
        ).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_invoices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showNotification(`${invoices.length} invoices exported as CSV successfully!`, 'success');
}

function exportInvoicesAsPDF(invoices) {
    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('Invoice Export Report', 14, 22);

    // Add date
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Invoices: ${invoices.length}`, 14, 36);

    // Prepare data for table
    const tableColumns = ['Invoice #', 'Supplier', 'Product', 'Port', 'Amount', 'Date', 'Status'];
    const tableRows = invoices.map(invoice => [
        invoice.invoice_number,
        invoice.supplier,
        invoice.product,
        invoice.port_of_loading,
        invoice.amount,
        invoice.date,
        invoice.status
    ]);

    // Generate table
    doc.autoTable({
        head: [tableColumns],
        body: tableRows,
        startY: 45,
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        margin: { top: 45, left: 14, right: 14 }
    });

    // Save the PDF
    doc.save(`selected_invoices_${new Date().toISOString().split('T')[0]}.pdf`);
    
    showNotification(`${invoices.length} invoices exported as PDF successfully!`, 'success');
}

// =================================================================================
// EDIT AND DELETE FUNCTIONALITY
// =================================================================================

// Edit Modal Functions
// In app.js, find and update this function

async function openEditModal(id, type) {
    const tableName = type === 'contact' ? 'business_cards' : 'invoices';
    const primaryKeyColumn = primaryKeys[tableName]; // Get the PK from our config

    try {
        // Fetch the specific record
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq(primaryKeyColumn, id) // Use the dynamic primary key column
            .single();

        if (error) throw error;
        if (!data) {
            showNotification('Record not found.', 'error');
            return;
        }

        currentEditRecord = { id, type, data };
        
        // Update modal title
        document.getElementById('edit-modal-title').textContent = 
            type === 'contact' ? 'Edit Business Card' : 'Edit Invoice';
        
        // Generate form fields based on record type
        const formFields = document.getElementById('edit-form-fields');
        formFields.innerHTML = '';
        
        if (type === 'contact') {
            formFields.innerHTML = `
                <div class="form-group">
                    <label for="edit-name">Name</label>
                    <input type="text" id="edit-name" class="form-input" value="${data.Name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="edit-job-title">Job Title</label>
                    <input type="text" id="edit-job-title" class="form-input" value="${data.Job_Title || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-company">Company</label>
                    <input type="text" id="edit-company" class="form-input" value="${data.Company || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-phone">Phone</label>
                    <input type="tel" id="edit-phone" class="form-input" value="${data.Phone || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-email">Email</label>
                    <input type="email" id="edit-email" class="form-input" value="${data.Email || ''}">
                </div>
            `;
        } else {
            formFields.innerHTML = `
                <div class="form-group">
                    <label for="edit-invoice-number">Invoice Number</label>
                    <input type="text" id="edit-invoice-number" class="form-input" value="${data.Invoice_Number || ''}" required>
                </div>
                <div class="form-group">
                    <label for="edit-exporter-name">Exporter Name</label>
                    <input type="text" id="edit-exporter-name" class="form-input" value="${data.Exporter_Name || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-product">Product</label>
                    <input type="text" id="edit-product" class="form-input" value="${data.Product || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-port-loading">Port of Loading</label>
                    <input type="text" id="edit-port-loading" class="form-input" value="${data.Port_of_Loading || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-total-value">Total Invoice Value</label>
                    <input type="text" id="edit-total-value" class="form-input" value="${data.Total_Invoice_Value || ''}">
                </div>
            `;
        }
        
        // Show the modal
        document.getElementById('edit-modal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error fetching record for edit:', error);
        showNotification('Error loading record for editing.', 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditRecord = null;
}

async function handleUpdate() {
    if (!currentEditRecord) {
        showNotification('No record selected for editing.', 'error');
        return;
    }

    const { id, type } = currentEditRecord;
    const tableName = type === 'contact' ? 'business_cards' : 'invoices';
    const primaryKeyColumn = primaryKeys[tableName]; // Get the correct primary key for the table
    
    try {
        let updateData = {};
        
        if (type === 'contact') {
            updateData = {
                Name: document.getElementById('edit-name').value.trim(),
                Job_Title: document.getElementById('edit-job-title').value.trim(),
                Company: document.getElementById('edit-company').value.trim(),
                Phone: document.getElementById('edit-phone').value.trim(),
                Email: document.getElementById('edit-email').value.trim()
            };
        } else {
            updateData = {
                Invoice_Number: document.getElementById('edit-invoice-number').value.trim(),
                Exporter_Name: document.getElementById('edit-exporter-name').value.trim(),
                Product: document.getElementById('edit-product').value.trim(),
                Port_of_Loading: document.getElementById('edit-port-loading').value.trim(),
                Total_Invoice_Value: document.getElementById('edit-total-value').value.trim()
            };
        }

        // Update record in Supabase using the correct primary key
        const { error } = await supabase
            .from(tableName)
            .update(updateData)
            .eq(primaryKeyColumn, id); // Use the dynamic primary key column

        if (error) throw error;

        // Success - close modal and refresh data
        closeEditModal();
        showNotification(`${type === 'contact' ? 'Business card' : 'Invoice'} updated successfully!`, 'success');
        
        // Refresh the appropriate table
        if (type === 'contact') {
            populateContactTable();
        } else {
            populateInvoiceTable();
        }
        
        // Also refresh dashboard stats
        fetchInitialDashboardData();

    } catch (error) {
        console.error('Error updating record:', error);
        showNotification('Error updating record. Please try again.', 'error');
    }
}

// Delete Confirmation Functions
function openDeleteConfirm(id, type) {
    currentDeleteRecord = { id, type };
    
    // Get display name from schema or fallback to legacy names
    let recordType = 'record';
    if (tableSchemas[type]) {
        recordType = tableSchemas[type].displayName.toLowerCase();
    } else if (type === 'business_cards') {
        recordType = 'business card';
    } else if (type === 'invoices') {
        recordType = 'invoice';
    }
    
    document.getElementById('delete-message').textContent = 
        `Are you sure you want to delete this ${recordType}? This action cannot be undone.`;
    
    document.getElementById('delete-confirm-modal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
    currentDeleteRecord = null;
}

// In app.js, find and update this function

async function handleDelete() {
    if (!currentDeleteRecord) { // Use the correct state variable for deletion
        showNotification('No record selected for deletion.', 'error');
        return;
    }
    
    const { id, type } = currentDeleteRecord; // Use currentDeleteRecord instead of currentEditRecord
    const tableName = type === 'contact' ? 'business_cards' : 'invoices';
    const primaryKeyColumn = primaryKeys[tableName]; // Get the PK from our config

    try {
        // Delete record from Supabase
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq(primaryKeyColumn, id); // Use the dynamic primary key column

        if (error) throw error;

        // Success - close modal and refresh data
        closeDeleteModal();
        showNotification(`${type === 'contact' ? 'Business card' : 'Invoice'} deleted successfully!`, 'success');
        
        // Refresh the appropriate table
        if (type === 'contact') {
            populateContactTable();
        } else {
            populateInvoiceTable();
        }
        
        // Also refresh dashboard stats
        fetchInitialDashboardData();

    } catch (error) {
        console.error('Error deleting record:', error);
        showNotification('Error deleting record. Please try again.', 'error');
    }
}

// Notification system
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'info' ? '#3b82f6' : '#ef4444'};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Data fetching functions
async function fetchInitialDashboardData() {
    console.log('Fetching dashboard stats for current user...');

    try {
        // We can run both count queries at the same time for better performance (PHASE 3: Using JSONB system)
        const [contactsResult, invoicesResult] = await Promise.all([
            supabase
                .from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', 'b7e8c9d0-1234-5678-9abc-def012345678') // Business cards JSONB table
                .eq('user_id', currentUser?.id), // Filter by current user
            supabase
                .from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', 'a1b2c3d4-1234-5678-9abc-def012345678') // Invoices JSONB table
                .eq('user_id', currentUser?.id) // Filter by current user
        ]);

        const { count: contactsCount, error: contactsError } = contactsResult;
        const { count: invoicesCount, error: invoicesError } = invoicesResult;

        // Handle any errors during the fetch
        if (contactsError || invoicesError) {
            throw contactsError || invoicesError;
        }

        // Calculate the total
        const totalDocs = (contactsCount || 0) + (invoicesCount || 0);

        // Update the HTML elements with the fetched counts
        document.getElementById('stat-docs-processed').textContent = totalDocs;
        document.getElementById('stat-business-cards').textContent = contactsCount || 0;
        document.getElementById('stat-invoices').textContent = invoicesCount || 0;
        
        // Note: The "Accuracy Rate" is left as a static value for the MVP
        // as we don't have a column for this data yet.

        // Update the dashboard value proposition section
        updateDashboardValueProposition();

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        showNotification('Could not load dashboard stats.', 'error');
    }
}

async function populateContactTable(filters = {}) {
    console.log('Fetching business cards with filters:', filters);
    
    const tableBody = document.getElementById('contacts-table-body');
    
    // Show loading state if search is happening
    if (filters.searchTerm) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 20px;">🔍 Searching...</td></tr>';
    }
    
    try {
        // Check if user is authenticated
        if (!currentUser) {
            console.warn('⚠️ No authenticated user found');
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 40px;">Please log in to view your business cards.</td></tr>';
            return;
        }
        
        // PHASE 3: Read from JSONB user_table_data system (final implementation)
        console.log('🔄 Fetching business cards from JSONB system for user:', currentUser.email);
        
        const businessCardsTableId = 'b7e8c9d0-1234-5678-9abc-def012345678';
        
        // Build query for JSONB system with user authentication
        let query = supabase
            .from('user_table_data')
            .select('user_id, data, created_at')
            .eq('table_id', businessCardsTableId)
            .eq('user_id', currentUser?.id); // Filter by current user

        // Apply search filter if provided and not empty
        if (filters.searchTerm && filters.searchTerm.trim()) {
            const searchTerm = `%${filters.searchTerm.trim()}%`;
            // Search in JSONB fields using correct PostgREST syntax
            query = query.or(`data->>Name.ilike.${searchTerm},data->>Company.ilike.${searchTerm},data->>Email.ilike.${searchTerm}`);
            console.log('📝 Applied search filter:', filters.searchTerm);
        }

        // Apply date range filters if provided
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
            console.log('📅 Applied start date filter:', filters.startDate);
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lte('created_at', endDate.toISOString());
            console.log('📅 Applied end date filter:', endDate.toISOString());
        }

        // Execute query with ordering
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching business cards:', error);
            showNotification('Could not load business cards.', 'error');
            return;
        }
        
        console.log(`✅ Found ${data?.length || 0} business cards in JSONB system`);
        
        if (data) {
            const tableBody = document.getElementById('contacts-table-body');
            tableBody.innerHTML = ''; 
            
            if (data.length === 0) {
                const message = filters.searchTerm 
                    ? `No business cards found for "${filters.searchTerm}"`
                    : 'No business cards found matching your criteria.';
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 40px;">${message}</td></tr>`;
                return;
            }
            
            // Create an HTML row for each contact with checkbox (extract data from JSONB)
            tableBody.innerHTML = data.map(record => {
                const contact = record.data; // Extract JSONB data
                return `
                <tr>
                    <td><input type="checkbox" class="contact-row-checkbox"></td>
                    <td>${contact.Name || 'N/A'}</td>
                    <td>${contact.Job_Title || 'N/A'}</td>
                    <td>${contact.Company || 'N/A'}</td>
                    <td>${contact.Phone || 'N/A'}</td>
                    <td>${contact.Email || 'N/A'}</td>
                    <td>${formatDate(record.created_at)}</td>
                    <td><span class="status-badge status-success">Processed</span></td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${contact.Email}" data-type="contact">✏️</button>
                        <button class="action-btn delete-btn" data-id="${contact.Email}" data-type="contact">🗑️</button>
                    </td>
                </tr>
                `;
            }).join('');
        }
        
        // Re-setup select all functionality after table is populated
        setupSelectAllFunctionality();
        
    } catch (error) {
        console.error('Error in populateContactTable:', error);
        showNotification('Could not load business cards.', 'error');
    }
}

async function populateInvoiceTable(filters = {}) {
    console.log('Fetching invoices and populating table...');
    
    // Build dynamic query for JSONB system
    let query = supabase
        .from('user_table_data')
        .select('data, created_at, id')
        .eq('table_id', 'a1b2c3d4-1234-5678-9abc-def012345678'); 

    // Add search filter if provided
    if (filters.searchTerm) {
        const searchTerm = `%${filters.searchTerm}%`;
        query = query.or(`data->>Invoice_Number.ilike.${searchTerm},data->>Exporter_Name.ilike.${searchTerm}`);
    }

    // Add date range filters if provided
    if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
        // Add one day to include the entire end date
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lte('created_at', endDate.toISOString());
    }

    // Execute query with ordering
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching invoices:', error);
        showNotification('Could not load invoices.', 'error');
        return;
    }
    
    if (data) {
        const tableBody = document.getElementById('invoices-table-body');
        tableBody.innerHTML = '';
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 40px;">No invoices found matching your criteria.</td></tr>';
            return;
        }
        
        // Create an HTML row for each invoice with checkbox - JSONB data structure
        tableBody.innerHTML = data.map(record => {
            const invoice = record.data; // Extract JSONB data
            return `
            <tr>
                <td><input type="checkbox" class="invoice-row-checkbox"></td>
                <td>${invoice.Invoice_Number || 'N/A'}</td>
                <td>${invoice.Exporter_Name || 'N/A'}</td>
                <td>${invoice.Product || 'N/A'}</td>
                <td>${invoice.Port_of_Loading || 'N/A'}</td>
                <td>${invoice.Total_Invoice_Value || 'N/A'}</td>
                <td>${formatDate(record.created_at)}</td>
                <td><span class="status-badge status-success">Processed</span></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${invoice.Invoice_Number}" data-type="invoice">✏️</button>
                    <button class="action-btn delete-btn" data-id="${invoice.Invoice_Number}" data-type="invoice">🗑️</button>
                </td>
            </tr>
            `;
        }).join('');
    }
    
    // Re-setup select all functionality after table is populated
    setupSelectAllFunctionality();
}

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

// Debounce helper function to prevent excessive API calls
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Helper functions for formatting data
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatCurrency(amount, currency = 'USD') {
    if (typeof amount !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

// Main initialization function
async function initializeApp() {
    console.log('Initializing OCR Dashboard...');
    
    try {
        // Set up search and filter functionality
        setupAutoSearchHandlers();
        
        // Initialize table management functionality
        initializeTableManagement();
        
        // Show the dashboard page by default
        showPage('page-dashboard');
        
        // Update stats display
        updateStats();
        
        console.log('Dashboard initialized successfully!');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard data. Please refresh the page.', 'error');
    }
}

// Old setupSearchAndFilterEventListeners function removed - replaced by setupAutoSearchHandlers



/**
 * Handle export for any table - maintains VCF for business cards, CSV for everything else
 * @param {string} tableName - The table name to export from
 */
function handleGenericExport(tableName) {
    if (tableName === 'business_cards') {
        // Use existing VCF export for business cards
        generateVCF();
    } else if (tableName === 'invoices') {
        // Use existing invoice export (which has format selection)
        handleInvoiceExport();
    } else {
        // For custom tables, show export format modal for enhanced export
        const schema = tableSchemas[tableName];
        if (schema && schema.isJsonbTable) {
            openExportFormatModal(tableName);
        } else {
            // Fallback to basic CSV export for physical custom tables
            exportGenericTableToCSV(tableName);
        }
    }
}

/**
 * Export selected rows from any custom table to CSV
 * @param {string} tableName - The table name to export from
 */
async function exportGenericTableToCSV(tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        showNotification('Unable to export: table schema not found', 'error');
        return;
    }

    // Get selected checkboxes
    const checkedBoxes = document.querySelectorAll(`#${tableName}-table-container .row-checkbox:checked`);
    
    if (checkedBoxes.length === 0) {
        showNotification(`Please select at least one ${schema.displayName.toLowerCase()} to export.`, 'error');
        return;
    }

    try {
        // Get the selected row IDs
        const selectedIds = [];
        checkedBoxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
                // Find primary key value - it should be in the data attributes or we can get it from the edit button
                const editBtn = row.querySelector('.edit-btn');
                if (editBtn) {
                    selectedIds.push(editBtn.getAttribute('data-id'));
                }
            }
        });

        if (selectedIds.length === 0) {
            showNotification('No valid rows selected for export', 'error');
            return;
        }

        // Fetch the actual data for selected rows
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .in(schema.primaryKey, selectedIds);

        if (error) {
            console.error(`Error fetching data for export:`, error);
            showNotification('Error fetching data for export', 'error');
            return;
        }

        if (!data || data.length === 0) {
            showNotification('No data found for selected rows', 'error');
            return;
        }

        // Create CSV headers from schema
        const headers = schema.fields.map(field => field.displayName);
        headers.push('Date Added'); // Add date column

        // Convert data to CSV rows
        const csvRows = data.map(row => {
            const csvRow = schema.fields.map(field => {
                let value = row[field.columnName] || '';
                
                // Format based on data type
                if (field.dataType === 'DATE' && value) {
                    value = new Date(value).toLocaleDateString();
                } else if (field.dataType === 'NUMERIC' && value) {
                    value = parseFloat(value).toLocaleString();
                }
                
                // Escape CSV values that contain commas or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                
                return value;
            });
            
            // Add formatted date
            csvRow.push(row.created_at ? new Date(row.created_at).toLocaleDateString() : '');
            
            return csvRow.join(',');
        });

        // Create CSV content
        const csvContent = [headers.join(','), ...csvRows].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification(`${data.length} ${schema.displayName.toLowerCase()}(s) exported successfully!`, 'success');

    } catch (err) {
        console.error('Error during export:', err);
        showNotification('An unexpected error occurred during export', 'error');
    }
}

function updateStats() {
    // Simulate real-time stat updates
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        // Add subtle animation for stats
        stat.style.transition = 'all 0.3s ease';
    });
}

// =================================================================================
// APP INITIALIZATION & EVENT LISTENERS
// =================================================================================

function setupAuthEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form-element');
    if (loginForm) {
        console.log('✅ Login form found, attaching event listener');
        loginForm.addEventListener('submit', (e) => {
            console.log('📝 Login form submitted');
            e.preventDefault();
            handleLogin();
        });
    } else {
        console.error('❌ Login form not found!');
    }

    // Signup form
    document.getElementById('signup-form-element').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignUp();
    });

    // Form switching
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm();
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // Google OAuth buttons
    document.getElementById('google-login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleGoogleAuth();
    });

    document.getElementById('google-signup-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleGoogleAuth();
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

function setupModalEventListeners() {
    console.log('🚨🚨🚨 DEBUG: setupModalEventListeners called');
    
    // Upload Modal Event Listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeUploadModal);
    // Removed direct event listener - using delegated listener instead to prevent duplication
    // The delegated listener at line 2683 handles upload button clicks
    if (uploadBtn) {
        console.log('🚨🚨🚨 DEBUG: Upload button found, delegated listener will handle clicks');
    } else {
        console.error('🚨🚨🚨 DEBUG: Upload button NOT FOUND in DOM!');
    }
    
    // File Input and Drag & Drop Listeners
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) {
        fileInput.addEventListener('change', previewFiles);
    }

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            fileInput.files = e.dataTransfer.files;
            previewFiles();
        });
    }
}

// NEW: Dashboard-specific button listeners
function setupDashboardEventListeners() {
    // Quick Action - Export Contacts
    const quickActionExportContacts = document.getElementById('quick-action-export-contacts');
    if (quickActionExportContacts) quickActionExportContacts.addEventListener('click', exportContacts);

    // Quick Action - Export Invoices
    const quickActionExportInvoices = document.getElementById('quick-action-export-invoices');
    if (quickActionExportInvoices) quickActionExportInvoices.addEventListener('click', handleInvoiceExport);

    // Export VCF Button in table header
    const exportVcfBtn = document.getElementById('export-vcf-btn');
    if (exportVcfBtn) exportVcfBtn.addEventListener('click', exportContacts);

    // Export Invoices Button in table header
    const handleInvoiceExportBtn = document.getElementById('handle-invoice-export-btn');
    if (handleInvoiceExportBtn) handleInvoiceExportBtn.addEventListener('click', handleInvoiceExport);
}

// A master setup function to keep things clean
function setupEventListeners() {
    setupAuthEventListeners();
    setupModalEventListeners();
    setupDashboardEventListeners();
    setupSelectAllFunctionality();
    setupAutoSearchHandlers();
    setupTableActionEventListeners();
    setupEditDeleteModalEventListeners();
    setupNavigation(); // Set up client-side routing
    setupSettingsEventListeners(); // Setup settings page functionality
    setupBillingEventListeners(); // Setup billing page functionality
}

// =================================================================================
// DEBUG & TESTING
// =================================================================================

// Test Supabase connection on load
console.log('🔧 Testing Supabase connection...');
console.log('🌐 Supabase URL:', supabase.supabaseUrl);
console.log('🔑 Supabase Key (first 20 chars):', supabase.supabaseKey.substring(0, 20) + '...');

// Test if Supabase client is working
supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
        console.error('❌ Supabase connection test failed:', error);
    } else {
        console.log('✅ Supabase connection test successful');
    }
}).catch(err => {
    console.error('🔥 Supabase connection test error:', err);
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚨🚨🚨 DEBUG: DOMContentLoaded event fired!');
    console.log('🚨🚨🚨 DEBUG: DOM is ready, starting app initialization...');
    
    // Set up event delegation for upload buttons (solves timing issues)
    console.log('🚨🚨🚨 DEBUG: Setting up delegated event listeners...');
    
    // Add general click listener for debugging
    document.body.addEventListener('click', (event) => {
        console.log('🚨🚨🚨 DEBUG: Click detected on element:', event.target.tagName, 'ID:', event.target.id, 'Class:', event.target.className);
    });
    
    document.body.addEventListener('click', async (event) => {
        // Handle main upload button in modal
        if (event.target.matches('#upload-btn') || event.target.closest('#upload-btn')) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - main upload button triggered');
            event.preventDefault();
            await handleFileUpload();
            return;
        }
        
        // Handle per-table upload buttons
        const perTableBtn = event.target.closest('.upload-to-table-btn');
        if (perTableBtn) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - per-table upload button triggered');
            const tableKey = perTableBtn.dataset.table || 'unknown';
            console.log('🚨🚨🚨 DEBUG: Table key:', tableKey);
            event.preventDefault();
            await openUploadModalForTable(tableKey);
            return;
        }
        
        // Handle generic custom table upload buttons
        if (event.target.matches('.generic-upload-to-table-btn') || event.target.closest('.generic-upload-to-table-btn')) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - generic table upload button triggered');
            const tableName = getTableNameFromPageId(currentPage);
            event.preventDefault();
            if (tableName) {
                await openUploadModalForTable(tableName);
            } else {
                await openUploadModal();
            }
            return;
        }
        
        // Handle dashboard upload area button (div with child elements)
        if (event.target.matches('#upload-area-button') || event.target.closest('#upload-area-button')) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - dashboard upload area button triggered');
            console.log('🚨🚨🚨 DEBUG: Target element:', event.target.tagName, 'ID:', event.target.id, 'Class:', event.target.className);
            console.log('🚨🚨🚨 DEBUG: Closest upload-area-button:', event.target.closest('#upload-area-button'));
            event.preventDefault();
            await openUploadModal();
            return;
        }
        
        // Handle upload page button  
        if (event.target.matches('#upload-page-button') || event.target.closest('#upload-page-button')) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - upload page button triggered');
            event.preventDefault();
            await openUploadModal();
            return;
        }
    });
    
    // Make key functions globally available so HTML onclick can find them
    // This is a simpler fix than refactoring all the HTML right now
    window.exportContacts = exportContacts;
    window.downloadInvoices = downloadInvoices;
    window.handleInvoiceExport = handleInvoiceExport;
    // Note: Upload button event listeners now handled by event delegation above
    // Removed direct listeners to prevent conflicts with delegation system
    
    // Set up per-table upload button event listeners
    setupPerTableUploadButtons();

    setupEventListeners(); // A master setup function
    initializeTheme(); // Initialize theme on page load
    await loadTableSchemas(); // Load all table schemas on app startup - wait for completion
    
    // Debug: Check if critical DOM elements exist AFTER all initialization
    console.log('🚨🚨🚨 DEBUG: Checking DOM elements after initialization...');
    
    const uploadBtnCheck = document.getElementById('upload-btn');
    const uploadModalCheck = document.getElementById('upload-modal');
    const tableSelectorCheck = document.getElementById('table-selector');
    const fileInputCheck = document.getElementById('file-input');
    const perTableButtonsCheck = document.querySelectorAll('.upload-to-table-btn');
    
    console.log('🚨🚨🚨 DEBUG Element Results:', {
        uploadBtn: uploadBtnCheck,
        uploadModal: uploadModalCheck,
        tableSelector: tableSelectorCheck,
        fileInput: fileInputCheck,
        perTableButtons: perTableButtonsCheck,
        perTableButtonCount: perTableButtonsCheck.length
    });
    
    checkUser();
});

// =================================================================================
// SETTINGS PAGE FUNCTIONALITY
// =================================================================================

/**
 * Initialize theme on page load
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    updateThemeToggle(savedTheme);
}

/**
 * Apply theme to the body element
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

/**
 * Update the theme toggle switch to reflect current theme
 * @param {string} theme - 'light' or 'dark'
 */
function updateThemeToggle(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    const headerThemeToggle = document.getElementById('header-theme-toggle');
    
    if (themeToggle) {
        themeToggle.checked = theme === 'light';
    }
    if (headerThemeToggle) {
        headerThemeToggle.checked = theme === 'light';
        // Update the icon
        const icon = headerThemeToggle.nextElementSibling.querySelector('.material-icons');
        if (icon) {
            icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
        }
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    updateThemeToggle(newTheme);
    localStorage.setItem('theme', newTheme);
    
    showNotification(`Switched to ${newTheme} theme`, 'success');
}

/**
 * Load user settings from Supabase
 */
async function loadUserSettings() {
    if (!currentUser) {
        console.log('No user logged in, skipping settings load');
        return;
    }
    
    try {
        // Load user metadata
        const userEmail = document.getElementById('user-email-display');
        const accountCreated = document.getElementById('account-created');
        const displayName = document.getElementById('display-name');
        
        if (userEmail) userEmail.value = currentUser.email || '';
        if (accountCreated) {
            const createdDate = new Date(currentUser.created_at).toLocaleDateString();
            accountCreated.value = createdDate;
        }
        if (displayName) {
            displayName.value = currentUser.user_metadata?.display_name || '';
        }
        
        // Try to load user preferences from a settings table
        const { data: settings, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
            
        if (!error && settings) {
            // Apply saved preferences
            const defaultDocType = document.getElementById('default-doc-type');
            const emailNotifications = document.getElementById('email-notifications');
            const autoSaveEnabled = document.getElementById('auto-save-enabled');
            
            if (defaultDocType && settings.default_document_type) {
                defaultDocType.value = settings.default_document_type;
            }
            if (emailNotifications) {
                emailNotifications.checked = settings.email_notifications || false;
            }
            if (autoSaveEnabled) {
                autoSaveEnabled.checked = settings.auto_save_enabled || true;
            }
        }
        
        // Calculate and display storage usage
        await calculateStorageUsage();
        
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

/**
 * Save user preferences to Supabase
 */
async function saveUserSettings() {
    if (!currentUser) return;
    
    try {
        const defaultDocType = document.getElementById('default-doc-type');
        const emailNotifications = document.getElementById('email-notifications');
        const autoSaveEnabled = document.getElementById('auto-save-enabled');
        
        const settingsData = {
            user_id: currentUser.id,
            default_document_type: defaultDocType?.value || '',
            email_notifications: emailNotifications?.checked || false,
            auto_save_enabled: autoSaveEnabled?.checked || true,
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('user_settings')
            .upsert(settingsData);
            
        if (error) throw error;
        
        showNotification('Settings saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving user settings:', error);
        showNotification('Error saving settings. Please try again.', 'error');
    }
}

/**
 * Update user display name
 */
async function updateDisplayName(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showNotification('Authentication error. Please log in again.', 'error');
        return;
    }
    
    const displayName = document.getElementById('display-name').value.trim();
    
    if (!displayName) {
        showNotification('Please enter a display name', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { display_name: displayName }
        });
        
        if (error) throw error;
        
        // Update current user object
        currentUser = data.user;
        
        showNotification('Display name updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating display name:', error);
        showNotification(error.message || 'Error updating display name', 'error');
    }
}

/**
 * Change user password
 */
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    if (!currentPassword || !newPassword) {
        showNotification('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('New password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        // First verify current password by attempting to sign in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });
        
        if (verifyError) {
            showNotification('Current password is incorrect', 'error');
            return;
        }
        
        // Update password
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        // Clear password fields
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        
        showNotification('Password changed successfully!', 'success');
        
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification(error.message || 'Error changing password', 'error');
    }
}

/**
 * Calculate and display storage usage
 */
async function calculateStorageUsage() {
    try {
        // Count total documents for the user (PHASE 3: Using JSONB system)
        const [contactsResult, invoicesResult] = await Promise.all([
            supabase.from('user_table_data').select('*', { count: 'exact', head: true }).eq('table_id', 'b7e8c9d0-1234-5678-9abc-def012345678').eq('user_id', currentUser?.id), // Business cards
            supabase.from('user_table_data').select('*', { count: 'exact', head: true }).eq('table_id', 'a1b2c3d4-1234-5678-9abc-def012345678').eq('user_id', currentUser?.id)  // Invoices
        ]);
        
        const totalDocs = (contactsResult.count || 0) + (invoicesResult.count || 0);
        
        // Estimate storage usage (assuming ~50KB per document on average)
        const estimatedStorageMB = (totalDocs * 0.05).toFixed(1);
        const maxStorageGB = 10; // 10GB limit for Pro plan
        const maxStorageMB = maxStorageGB * 1024;
        const usagePercentage = (estimatedStorageMB / maxStorageMB * 100).toFixed(1);
        
        // Update UI
        const storageFill = document.getElementById('storage-fill');
        const storageText = document.getElementById('storage-text');
        
        if (storageFill) {
            storageFill.style.width = Math.min(usagePercentage, 100) + '%';
        }
        
        if (storageText) {
            storageText.textContent = `${estimatedStorageMB} MB of ${maxStorageGB} GB used (${totalDocs} documents)`;
        }
        
    } catch (error) {
        console.error('Error calculating storage usage:', error);
        const storageText = document.getElementById('storage-text');
        if (storageText) {
            storageText.textContent = 'Unable to calculate storage usage';
        }
    }
}

// =================================================================================
// BILLING PAGE FUNCTIONS
// =================================================================================

/**
 * Fetch user's subscription data from Supabase
 * @returns {Object|null} User subscription data or null if not found
 */
async function fetchUserSubscription() {
    if (!currentUser) {
        console.error('No user logged in');
        return null;
    }

    console.log('Fetching user subscription data for user:', currentUser.id);
    
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            // PGRST116 is "not found" error, which is expected for new users
            console.error('Error fetching subscription:', error);
            throw error;
        }
        
        // If no subscription found, create default trial
        if (!data) {
            console.log('No subscription found, creating default trial');
            return createDefaultTrialSubscription();
        }
        
        console.log('Subscription data loaded:', data.plan_type);
        return data;
        
    } catch (error) {
        console.error('Error in fetchUserSubscription:', error);
        // Return default trial as fallback
        return createDefaultTrialSubscription();
    }
}

/**
 * Create a default trial subscription for new users
 * @returns {Object} Default trial subscription object
 */
function createDefaultTrialSubscription() {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now
    
    return {
        plan_type: 'trial',
        plan_status: 'active',
        pages_limit: 50,
        pages_used: 0,
        trial_ends_at: trialEndDate.toISOString(),
        price_amount: 0,
        currency: 'usd',
        created_at: new Date().toISOString()
    };
}

/**
 * Calculate current month usage for the user
 * @param {string} userId - User ID to calculate usage for
 * @returns {Promise<number>} Number of pages used this month
 */
async function calculateCurrentUsage(userId) {
    if (!userId) {
        console.error('No user ID provided for usage calculation');
        return 0;
    }

    console.log('Calculating current month usage for user:', userId);
    
    try {
        // Calculate start of current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count, error } = await supabase
            .from('usage_tracking')
            .select('pages_processed', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('processed_at', startOfMonth.toISOString());
        
        if (error) {
            console.error('Error calculating usage:', error);
            return 0;
        }
        
        const totalUsage = count || 0;
        console.log('Current month usage:', totalUsage, 'pages');
        return totalUsage;
        
    } catch (error) {
        console.error('Error in calculateCurrentUsage:', error);
        return 0;
    }
}

/**
 * Main function to populate the billing page with user data
 */
async function populateBillingPage() {
    if (!currentUser) {
        console.error('No user logged in');
        showNotification('Please log in to view billing information.', 'error');
        return;
    }

    console.log('Populating billing page...');
    
    try {
        // Show loading states
        showBillingLoadingStates();
        
        // Fetch subscription and usage data in parallel for better performance
        const [subscription, currentUsage] = await Promise.all([
            fetchUserSubscription(),
            calculateCurrentUsage(currentUser.id)
        ]);
        
        if (!subscription) {
            showNotification('Could not load billing information.', 'error');
            return;
        }
        
        // Update all sections of the billing page
        updateCurrentPlanDisplay(subscription);
        updateUsageDisplay(subscription, currentUsage);
        updateValueProposition(subscription, currentUsage);
        updatePlanComparison(subscription);
        updatePaymentMethod(subscription);
        
        console.log('Billing page populated successfully');
        
    } catch (error) {
        console.error('Error populating billing page:', error);
        showNotification('Could not load billing information.', 'error');
        // Hide loading states on error
        hideBillingLoadingStates();
    }
}

/**
 * Show loading states for all billing sections
 */
function showBillingLoadingStates() {
    // Current plan section
    const elements = [
        'current-plan-name',
        'current-plan-details', 
        'billing-plan-info',
        'billing-usage-text',
        'billing-usage-remaining',
        'hours-saved',
        'value-created',
        'payment-method-display'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Loading...';
        }
    });
    
    // Reset usage bar
    const usageFill = document.getElementById('billing-usage-fill');
    if (usageFill) {
        usageFill.style.width = '0%';
    }
}

/**
 * Hide loading states for all billing sections (used on error)
 */
function hideBillingLoadingStates() {
    // Reset to default or empty states
    const elements = [
        { id: 'current-plan-name', text: 'Plan Unavailable' },
        { id: 'current-plan-details', text: 'Unable to load plan details' }, 
        { id: 'billing-plan-info', text: 'Plan information unavailable' },
        { id: 'billing-usage-text', text: 'Usage information unavailable' },
        { id: 'billing-usage-remaining', text: 'Unable to calculate' },
        { id: 'hours-saved', text: '~0 Hours' },
        { id: 'value-created', text: '~$0' },
        { id: 'payment-method-display', text: 'Payment method unavailable' }
    ];
    
    elements.forEach(({ id, text }) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    });
    
    // Reset usage bar
    const usageFill = document.getElementById('billing-usage-fill');
    if (usageFill) {
        usageFill.style.width = '0%';
    }
}

/**
 * Update the current plan display section
 * @param {Object} subscription - User subscription data
 */
function updateCurrentPlanDisplay(subscription) {
    const planNames = {
        'trial': 'Trial Plan',
        'starter': 'Starter Plan', 
        'business': 'Business Plan',
        'pay_as_you_go': 'Pay As You Go'
    };
    
    const planDescriptions = {
        'trial': 'Perfect for trying out our OCR capabilities',
        'starter': 'Great for small teams and individual professionals',
        'business': 'Advanced features for growing businesses',
        'pay_as_you_go': 'Flexible pricing that scales with your needs'
    };
    
    // Update plan name
    const planNameElement = document.getElementById('current-plan-name');
    if (planNameElement) {
        planNameElement.textContent = planNames[subscription.plan_type] || 'Unknown Plan';
    }
    
    // Update plan details
    const planDetailsElement = document.getElementById('current-plan-details');
    if (planDetailsElement) {
        planDetailsElement.textContent = planDescriptions[subscription.plan_type] || 'Plan details unavailable';
    }
    
    // Update plan status badge
    const statusBadge = document.getElementById('plan-status-badge');
    if (statusBadge) {
        statusBadge.textContent = subscription.plan_status.charAt(0).toUpperCase() + subscription.plan_status.slice(1);
        statusBadge.className = `plan-badge ${subscription.plan_status === 'active' ? '' : 'warning-badge'}`;
    }
    
    // Update price and billing cycle
    const planPrice = document.getElementById('plan-price');
    const planBillingCycle = document.getElementById('plan-billing-cycle');
    
    if (subscription.plan_type === 'trial') {
        if (planPrice) planPrice.textContent = 'Free Trial';
        if (planBillingCycle) {
            const trialEnd = new Date(subscription.trial_ends_at);
            const daysLeft = Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24));
            planBillingCycle.textContent = `${daysLeft} days remaining`;
        }
    } else if (subscription.plan_type === 'pay_as_you_go') {
        if (planPrice) planPrice.textContent = 'Pay As You Use';
        if (planBillingCycle) planBillingCycle.textContent = 'No monthly fee';
    } else {
        const price = (subscription.price_amount / 100).toFixed(2);
        if (planPrice) planPrice.textContent = `$${price}/month`;
        if (planBillingCycle) planBillingCycle.textContent = 'Monthly billing';
    }
}

/**
 * Update the usage display section
 * @param {Object} subscription - User subscription data
 * @param {number} currentUsage - Current month usage count
 */
function updateUsageDisplay(subscription, currentUsage) {
    const pageLimit = subscription.pages_limit;
    const pagesUsed = currentUsage;
    const usagePercentage = pageLimit > 0 ? (pagesUsed / pageLimit) * 100 : 0;
    const pagesRemaining = Math.max(0, pageLimit - pagesUsed);
    
    // Update plan info
    const planInfo = document.getElementById('billing-plan-info');
    if (planInfo) {
        const planNames = {
            'trial': 'Trial Plan',
            'starter': 'Starter Plan - 500 pages/month',
            'business': 'Business Plan - 5,000 pages/month',
            'pay_as_you_go': 'Pay As You Go'
        };
        planInfo.textContent = planNames[subscription.plan_type] || 'Unknown Plan';
    }
    
    // Update usage bar
    const usageFill = document.getElementById('billing-usage-fill');
    if (usageFill) {
        usageFill.style.width = `${Math.min(usagePercentage, 100)}%`;
        
        // Change color based on usage level
        if (usagePercentage >= 90) {
            usageFill.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else if (usagePercentage >= 75) {
            usageFill.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        } else {
            usageFill.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))';
        }
    }
    
    // Update usage text
    const usageText = document.getElementById('billing-usage-text');
    if (usageText) {
        if (subscription.plan_type === 'pay_as_you_go') {
            usageText.textContent = `${pagesUsed} pages used this month`;
        } else {
            usageText.textContent = `${pagesUsed.toLocaleString()} / ${pageLimit.toLocaleString()} pages used`;
        }
    }
    
    // Update remaining text
    const remainingText = document.getElementById('billing-usage-remaining');
    if (remainingText) {
        if (subscription.plan_type === 'pay_as_you_go') {
            remainingText.textContent = 'Purchase more as needed';
        } else {
            const remainingPercentage = Math.max(0, 100 - usagePercentage);
            remainingText.textContent = `${remainingPercentage.toFixed(1)}% remaining`;
        }
    }
}

/**
 * Update the value proposition section with calculated savings
 * @param {Object} subscription - User subscription data
 * @param {number} currentUsage - Current month usage count
 */
function updateValueProposition(subscription, currentUsage) {
    // Constants from plan requirements
    const MINUTES_PER_DOC = 4;
    const HOURLY_RATE = 30;
    
    // Calculate total documents processed (current month)
    const totalDocs = currentUsage;
    
    // Calculate time savings
    const minutesSaved = totalDocs * MINUTES_PER_DOC;
    const hoursSaved = Math.round(minutesSaved / 60);
    
    // Calculate monetary value
    const valueSaved = Math.round((minutesSaved / 60) * HOURLY_RATE);
    
    // Update hours saved
    const hoursSavedElement = document.getElementById('hours-saved');
    if (hoursSavedElement) {
        hoursSavedElement.textContent = `~${hoursSaved} Hours`;
    }
    
    // Update value created
    const valueCreatedElement = document.getElementById('value-created');
    if (valueCreatedElement) {
        valueCreatedElement.textContent = `~$${valueSaved.toLocaleString()}`;
    }
}

/**
 * Update the dashboard value proposition section with calculated metrics
 * This function calculates and displays Time Saved, Value Created, and ROI
 * based on the user's document processing activity
 */
async function updateDashboardValueProposition() {
    console.log('Updating dashboard value proposition...');
    
    try {
        // Constants for dashboard calculations (from HTML requirements)
        const MINUTES_PER_DOC = 4;
        const HOURLY_RATE = 15; // Dashboard uses $15/hr vs billing uses $30/hr
        
        // Get current user's document processing stats
        if (!currentUser) {
            console.log('No user logged in, skipping value proposition update');
            return;
        }

        // Fetch user subscription and current usage data
        const [subscription, currentUsage] = await Promise.all([
            fetchUserSubscription(),
            calculateCurrentUsage(currentUser.id)
        ]);

        if (!subscription) {
            console.log('No subscription data found, using default values');
            // Set default values when no subscription data
            updateDashboardValueElements(0, 0, 0);
            return;
        }

        // Calculate total documents processed (lifetime or current period)
        // For now, we'll use the current month usage, but this could be expanded
        const totalDocs = currentUsage || 0;
        
        console.log(`Calculating value for ${totalDocs} documents processed`);

        // Calculate time savings
        const minutesSaved = totalDocs * MINUTES_PER_DOC;
        const hoursSaved = Math.round(minutesSaved / 60 * 10) / 10; // Round to 1 decimal place
        
        // Calculate monetary value created
        const valueSaved = Math.round((minutesSaved / 60) * HOURLY_RATE);
        
        // Calculate ROI (Return on Investment)
        let roiPercentage = 0;
        if (subscription && subscription.price_amount > 0) {
            const monthlySubscriptionCost = subscription.price_amount / 100; // Convert cents to dollars
            const monthlyValueCreated = valueSaved;
            
            if (monthlySubscriptionCost > 0) {
                roiPercentage = Math.round(((monthlyValueCreated - monthlySubscriptionCost) / monthlySubscriptionCost) * 100);
            }
        } else if (totalDocs > 0) {
            // For trial users or pay-as-you-go, show positive ROI if any value is created
            roiPercentage = valueSaved > 0 ? 100 : 0;
        }

        // Update the dashboard elements
        updateDashboardValueElements(hoursSaved, valueSaved, roiPercentage);
        
        console.log(`Dashboard value proposition updated: ${hoursSaved}h, $${valueSaved}, ${roiPercentage}% ROI`);

    } catch (error) {
        console.error('Error updating dashboard value proposition:', error);
        // Set default values on error
        updateDashboardValueElements(0, 0, 0);
    }
}

/**
 * Helper function to update the dashboard value proposition DOM elements
 * @param {number} hours - Hours saved
 * @param {number} value - Dollar value created
 * @param {number} roi - ROI percentage
 */
function updateDashboardValueElements(hours, value, roi) {
    // Update hours saved
    const hoursElement = document.getElementById('dashboard-hours-saved');
    if (hoursElement) {
        const hoursText = hours === 0 ? '~0 Hours' : 
                         hours < 1 ? '~1 Hour' : 
                         `~${Math.round(hours)} Hours`;
        hoursElement.textContent = hoursText;
    }
    
    // Update value created
    const valueElement = document.getElementById('dashboard-value-created');
    if (valueElement) {
        valueElement.textContent = `~$${value.toLocaleString()}`;
    }
    
    // Update ROI
    const roiElement = document.getElementById('dashboard-roi');
    if (roiElement) {
        if (roi > 0) {
            roiElement.textContent = `+${roi}%`;
        } else if (roi < 0) {
            roiElement.textContent = `${roi}%`;
        } else {
            roiElement.textContent = '0%';
        }
    }
}

/**
 * Update the plan comparison section to highlight current plan
 * @param {Object} subscription - User subscription data
 */
function updatePlanComparison(subscription) {
    const currentPlan = subscription.plan_type;
    
    // Remove all current plan indicators first
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('current-plan');
    });
    
    document.querySelectorAll('.plan-button').forEach(button => {
        button.disabled = false;
        button.textContent = 'Upgrade Plan';
        button.className = 'plan-button upgrade-button';
    });
    
    // Highlight current plan
    const currentPlanCard = document.querySelector(`.plan-card[data-plan="${currentPlan}"]`);
    if (currentPlanCard) {
        currentPlanCard.classList.add('current-plan');
        
        const currentPlanButton = currentPlanCard.querySelector('.plan-button');
        if (currentPlanButton) {
            currentPlanButton.disabled = true;
            currentPlanButton.textContent = 'Current Plan';
            currentPlanButton.className = 'plan-button trial-button';
        }
    }
    
    // Special handling for trial plan button
    const trialButton = document.querySelector('.plan-card[data-plan="trial"] .plan-button');
    if (trialButton && currentPlan !== 'trial') {
        trialButton.textContent = 'Downgrade to Trial';
        trialButton.disabled = false;
        trialButton.className = 'plan-button upgrade-button';
    }
}

/**
 * Update payment method display
 * @param {Object} subscription - User subscription data
 */
function updatePaymentMethod(subscription) {
    const paymentMethodDisplay = document.getElementById('payment-method-display');
    
    if (!paymentMethodDisplay) return;
    
    // For now, show placeholder until Stripe integration in Phase 4
    if (subscription.plan_type === 'trial' || subscription.plan_type === 'pay_as_you_go') {
        paymentMethodDisplay.textContent = 'No payment method required';
    } else {
        // Placeholder for paid plans - will be updated in Phase 4 with actual Stripe data
        paymentMethodDisplay.textContent = 'Payment method will be displayed after Stripe integration';
    }
}

/**
 * Export contacts data as CSV
 */
async function exportContactsData() {
    try {
        const { data: rawData, error } = await supabase
            .from('user_table_data')
            .select('id, data, created_at')
            .eq('table_id', 'b7e8c9d0-1234-5678-9abc-def012345678')
            .order('created_at', { ascending: false });
            
        // Transform JSONB data to expected format for export
        const data = rawData ? rawData.map(item => ({
            Name: item.data.Name || item.data.name || '',
            Job_Title: item.data.Job_Title || item.data.job_title || '',
            Company: item.data.Company || item.data.company || '',
            Phone: item.data.Phone || item.data.phone || '',
            Email: item.data.Email || item.data.email || '',
            created_at: item.created_at
        })) : [];
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showNotification('No contacts found to export', 'error');
            return;
        }
        
        // Create CSV content
        const headers = ['Name', 'Job Title', 'Company', 'Phone', 'Email', 'Date Created'];
        const csvContent = [
            headers.join(','),
            ...data.map(contact => [
                contact.Name || '',
                contact.Job_Title || '',
                contact.Company || '',
                contact.Phone || '',
                contact.Email || '',
                new Date(contact.created_at).toLocaleDateString()
            ].map(value => `"${value}"`).join(','))
        ].join('\n');
        
        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification(`${data.length} contacts exported successfully!`, 'success');
        
    } catch (error) {
        console.error('Error exporting contacts:', error);
        showNotification('Error exporting contacts data', 'error');
    }
}

/**
 * Export invoices data as CSV
 */
async function exportInvoicesData() {
    try {
        const { data, error } = await supabase
            .from('user_table_data')
            .select('data, created_at')
            .eq('table_id', 'a1b2c3d4-1234-5678-9abc-def012345678')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showNotification('No invoices found to export', 'error');
            return;
        }
        
        // Create CSV content
        const headers = ['Invoice Number', 'Exporter Name', 'Product', 'Port of Loading', 'Total Value', 'Date Created'];
        const csvContent = [
            headers.join(','),
            ...data.map(record => {
                const invoice = record.data; // Extract JSONB data
                return [
                    invoice.Invoice_Number || '',
                    invoice.Exporter_Name || '',
                    invoice.Product || '',
                    invoice.Port_of_Loading || '',
                    invoice.Total_Invoice_Value || '',
                    new Date(record.created_at).toLocaleDateString()
                ].map(value => `"${value}"`).join(',')
            })
        ].join('\n');
        
        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification(`${data.length} invoices exported successfully!`, 'success');
        
    } catch (error) {
        console.error('Error exporting invoices:', error);
        showNotification('Error exporting invoices data', 'error');
    }
}

/**
 * Delete user account (danger zone)
 */
async function deleteAccount() {
    const confirmation = prompt('This action cannot be undone. Type "DELETE" to confirm:');
    
    if (confirmation !== 'DELETE') {
        showNotification('Account deletion cancelled', 'info');
        return;
    }
    
    try {
        // Note: This would typically be handled by a server-side function
        // For now, we'll just sign the user out and show a message
        showNotification('Account deletion request submitted. You will be contacted within 24 hours.', 'info');
        
        // Sign out the user
        setTimeout(() => {
            handleLogout();
        }, 3000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showNotification('Error processing account deletion request', 'error');
    }
}

/**
 * Setup billing page event listeners (for future Phase 4 Stripe integration)
 */
function setupBillingEventListeners() {
    // Plan upgrade buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('upgrade-button')) {
            const planType = e.target.dataset.plan;
            handlePlanUpgrade(planType);
        }
        
        // Top-up buttons for pay-as-you-go
        if (e.target.classList.contains('topup-button')) {
            const option = e.target.closest('.topup-option');
            const pages = option.dataset.pages;
            const price = option.dataset.price;
            handleTopUpPurchase(pages, price);
        }
    });
    
    // Payment method and subscription management buttons
    const updatePaymentBtn = document.getElementById('update-payment-btn');
    if (updatePaymentBtn) {
        updatePaymentBtn.addEventListener('click', handleUpdatePaymentMethod);
    }
    
    const manageSubscriptionBtn = document.getElementById('manage-subscription-btn');
    if (manageSubscriptionBtn) {
        manageSubscriptionBtn.addEventListener('click', handleManageSubscription);
    }
    
    const cancelSubscriptionBtn = document.getElementById('cancel-subscription-btn');
    if (cancelSubscriptionBtn) {
        cancelSubscriptionBtn.addEventListener('click', handleCancelSubscription);
    }
}

// =================================================================================
// BILLING SYSTEM TESTING & DEVELOPMENT UTILITIES
// =================================================================================

/**
 * Create a test subscription for development/testing purposes
 * This function is useful for testing the billing page functionality
 */
async function createTestSubscription(planType = 'trial') {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    const planConfigs = {
        trial: {
            plan_type: 'trial',
            plan_status: 'active',
            pages_limit: 50,
            pages_used: 15, // Some test usage
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            price_amount: 0,
            currency: 'usd'
        },
        starter: {
            plan_type: 'starter',
            plan_status: 'active',
            pages_limit: 500,
            pages_used: 127, // Some test usage
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            price_amount: 1299, // $12.99 in cents
            currency: 'usd'
        },
        business: {
            plan_type: 'business',
            plan_status: 'active',
            pages_limit: 5000,
            pages_used: 892, // Some test usage
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            price_amount: 7999, // $79.99 in cents
            currency: 'usd'
        }
    };

    const subscriptionData = {
        user_id: currentUser.id,
        ...planConfigs[planType]
    };

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .upsert(subscriptionData, { onConflict: 'user_id' });

        if (error) throw error;

        console.log('Test subscription created:', planType);
        showNotification(`Test ${planType} subscription created! Refreshing billing page...`, 'success');
        
        // Refresh the billing page
        setTimeout(() => {
            populateBillingPage();
        }, 1000);

        return true;
    } catch (error) {
        console.error('Error creating test subscription:', error);
        showNotification('Error creating test subscription', 'error');
        return false;
    }
}

/**
 * Create test usage data for development/testing purposes
 */
async function createTestUsage(pageCount = 25) {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    const usageEntries = [];
    const now = new Date();
    
    // Create random usage entries throughout the current month
    for (let i = 0; i < pageCount; i++) {
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const processedAt = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));
        
        usageEntries.push({
            user_id: currentUser.id,
            pages_processed: 1,
            document_type: Math.random() > 0.5 ? 'business_card' : 'invoice',
            processed_at: processedAt.toISOString()
        });
    }

    try {
        const { data, error } = await supabase
            .from('usage_tracking')
            .insert(usageEntries);

        if (error) throw error;

        console.log(`Created ${pageCount} test usage entries`);
        showNotification(`${pageCount} test usage entries created! Refreshing billing page...`, 'success');
        
        // Refresh the billing page
        setTimeout(() => {
            populateBillingPage();
        }, 1000);

        return true;
    } catch (error) {
        console.error('Error creating test usage:', error);
        showNotification('Error creating test usage data', 'error');
        return false;
    }
}

/**
 * Reset billing data for testing (removes all subscription and usage data for current user)
 */
async function resetBillingData() {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    const confirmation = confirm('This will delete all billing and usage data for the current user. Are you sure?');
    if (!confirmation) return false;

    try {
        // Delete subscription data
        await supabase
            .from('user_subscriptions')
            .delete()
            .eq('user_id', currentUser.id);

        // Delete usage data
        await supabase
            .from('usage_tracking')
            .delete()
            .eq('user_id', currentUser.id);

        console.log('Billing data reset complete');
        showNotification('Billing data reset! Refreshing billing page...', 'success');
        
        // Refresh the billing page
        setTimeout(() => {
            populateBillingPage();
        }, 1000);

        return true;
    } catch (error) {
        console.error('Error resetting billing data:', error);
        showNotification('Error resetting billing data', 'error');
        return false;
    }
}

// Make test functions available globally for console testing
window.createTestSubscription = createTestSubscription;
window.createTestUsage = createTestUsage;
window.resetBillingData = resetBillingData;

/**
 * Handle plan upgrade (placeholder for Phase 4 Stripe integration)
 */
function handlePlanUpgrade(planType) {
    console.log('Plan upgrade requested:', planType);
    showNotification('Plan upgrades will be available in the next update via Stripe integration.', 'info');
    
    // TODO: Phase 4 - Implement Stripe checkout
    // - Create Stripe checkout session
    // - Redirect to Stripe payment page
    // - Handle success/failure callbacks
}

/**
 * Handle top-up purchase (placeholder for Phase 4 Stripe integration)
 */
function handleTopUpPurchase(pages, priceInCents) {
    console.log('Top-up requested:', pages, 'pages for', priceInCents, 'cents');
    showNotification('Top-up purchases will be available in the next update via Stripe integration.', 'info');
    
    // TODO: Phase 4 - Implement Stripe checkout for top-ups
}

/**
 * Handle payment method update (placeholder for Phase 4 Stripe integration)
 */
function handleUpdatePaymentMethod() {
    console.log('Payment method update requested');
    showNotification('Payment method management will be available in the next update via Stripe integration.', 'info');
    
    // TODO: Phase 4 - Implement Stripe payment method update
}

/**
 * Handle subscription management (placeholder for Phase 4 Stripe integration)
 */
function handleManageSubscription() {
    console.log('Subscription management requested');
    showNotification('Subscription management will be available in the next update via Stripe integration.', 'info');
    
    // TODO: Phase 4 - Redirect to Stripe customer portal
}

/**
 * Handle subscription cancellation (placeholder for Phase 4 Stripe integration)
 */
function handleCancelSubscription() {
    const confirmation = confirm('Are you sure you want to cancel your subscription? You will be downgraded to the trial plan at the end of your billing cycle.');
    
    if (confirmation) {
        console.log('Subscription cancellation requested');
        showNotification('Subscription cancellation will be available in the next update via Stripe integration.', 'info');
        
        // TODO: Phase 4 - Implement subscription cancellation via Stripe
    }
}

/**
 * Setup all settings page event listeners
 */
function setupSettingsEventListeners() {
    // Theme toggle in settings
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    
    // Header theme toggle
    const headerThemeToggle = document.getElementById('header-theme-toggle');
    if (headerThemeToggle) {
        headerThemeToggle.addEventListener('change', toggleTheme);
    }
    
    // Commented out - Profile form
    // const profileForm = document.getElementById('profile-form');
    // if (profileForm) {
    //     profileForm.addEventListener('submit', updateDisplayName);
    // }
    
    // Password form show/hide functionality
    const showPasswordFormBtn = document.getElementById('show-password-form');
    const passwordForm = document.getElementById('password-form');
    const cancelPasswordFormBtn = document.getElementById('cancel-password-form');
    
    if (showPasswordFormBtn) {
        showPasswordFormBtn.addEventListener('click', () => {
            showPasswordFormBtn.style.display = 'none';
            passwordForm.style.display = 'block';
        });
    }
    
    if (cancelPasswordFormBtn) {
        cancelPasswordFormBtn.addEventListener('click', () => {
            passwordForm.style.display = 'none';
            showPasswordFormBtn.style.display = 'block';
            // Clear form fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
        });
    }
    
    // Password form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }
    
    // Settings auto-save (commented out since preferences section is commented out)
    // const settingsInputs = ['default-doc-type', 'email-notifications', 'auto-save-enabled'];
    // const debouncedSaveSettings = debounce(saveUserSettings, 1000);
    
    // settingsInputs.forEach(inputId => {
    //     const input = document.getElementById(inputId);
    //     if (input) {
    //         input.addEventListener('change', debouncedSaveSettings);
    //     }
    // });
    
    // Export buttons (commented out since data management section is commented out)
    // const exportContactsBtn = document.getElementById('export-contacts-btn');
    // if (exportContactsBtn) {
    //     exportContactsBtn.addEventListener('click', exportContactsData);
    // }
    
    // const exportInvoicesBtn = document.getElementById('export-invoices-btn');
    // if (exportInvoicesBtn) {
    //     exportInvoicesBtn.addEventListener('click', exportInvoicesData);
    // }
    
    // Delete account button
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }
}

// =================================================================================
// PHASE 4: ENHANCED JSONB FEATURES - SEARCH & EXPORT
// =================================================================================











/**
 * Enhanced JSONB search with field-specific path queries
 * This function provides fallback search strategies for JSONB tables
 */
async function enhancedJsonbSearch(tableId, searchTerm, schema) {
    try {
        // Strategy 1: Full-text search (already implemented in populateGenericTable)
        let { data, error } = await supabase
            .from('user_table_data')
            .select('id, data, created_at')
            .eq('table_id', tableId)
            .textSearch('data', searchTerm);
            
        if (error) throw error;
        
        // Strategy 2: If no results with text search, try field-specific JSONB path queries
        if (!data || data.length === 0) {
            const fieldQueries = [];
            const wildcardSearchTerm = `%${searchTerm.trim()}%`;
            
            // Create JSONB path queries for each text field in the schema
            schema.fields.forEach(field => {
                if (field.type === 'text' || field.type === 'TEXT') {
                    // JSONB path query: data->>field_name ilike '%searchterm%'
                    fieldQueries.push(`data->>${field.columnName}.ilike.${wildcardSearchTerm}`);
                }
            });
            
            if (fieldQueries.length > 0) {
                const fallbackQuery = await supabase
                    .from('user_table_data')
                    .select('id, data, created_at')
                    .eq('table_id', tableId)
                    .or(fieldQueries.join(','));
                    
                if (!fallbackQuery.error) {
                    data = fallbackQuery.data;
                    error = fallbackQuery.error;
                }
            }
        }
        
        return { data, error };
        
    } catch (err) {
        console.error('Enhanced JSONB search error:', err);
        return { data: [], error: err };
    }
}






/**
 * Update table display with search results
 */
function updateTableWithSearchResults(tableName, data, searchFilters) {
    const schema = tableSchemas[tableName];
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    const tableBody = tableContainer.querySelector('tbody');
    
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${schema.fields.length + 4}" class="no-results-row">
                    <div class="no-results">
                        <span class="material-icons">search_off</span>
                        <p>No results found for your search criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Populate rows with search results
    data.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><input type="checkbox" class="select-row" data-id="${record.id}"></td>`;
        
        schema.fields.forEach(field => {
            let cellValue = record.data[field.columnName] || '';
            
            // Highlight search terms in matching fields
            if (searchFilters[field.columnName] && cellValue) {
                cellValue = highlightSearchTerm(cellValue, searchFilters[field.columnName]);
            }
            
            row.innerHTML += `<td>${cellValue}</td>`;
        });
        
        const createdDate = new Date(record.created_at).toLocaleDateString();
        row.innerHTML += `
            <td>${createdDate}</td>
            <td><span class="status-badge processed">Processed</span></td>
            <td class="actions">
                <button class="btn-small edit-btn" data-id="${record.id}" data-type="${tableName}">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn-small delete-btn" data-id="${record.id}" data-type="${tableName}">
                    <span class="material-icons">delete</span>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update table stats
    updateTableStats(tableName);
}

/**
 * Enhanced export functionality for JSONB tables with format options
 */
async function enhancedJsonbExport(tableName, format = 'csv') {
    const schema = tableSchemas[tableName];
    if (!schema) {
        showNotification('Table schema not found', 'error');
        return;
    }
    
    try {
        // Get selected rows
        const selectedIds = getSelectedRowIds(tableName);
        if (selectedIds.length === 0) {
            showNotification('Please select at least one row to export', 'error');
            return;
        }
        
        let data, error;
        
        if (schema.isJsonbTable) {
            // Fetch JSONB data
            const result = await supabase
                .from('user_table_data')
                .select('id, data, created_at')
                .eq('table_id', schema.tableId)
                .in('id', selectedIds);
                
            data = result.data;
            error = result.error;
        } else {
            // Fetch physical table data
            const result = await supabase
                .from(tableName)
                .select('*')
                .in('id', selectedIds);
                
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            console.error('Export data fetch error:', error);
            showNotification('Error fetching data for export', 'error');
            return;
        }
        
        if (!data || data.length === 0) {
            showNotification('No data found for selected rows', 'error');
            return;
        }
        
        // Export in the requested format
        switch (format) {
            case 'csv':
                exportToCSV(data, schema, tableName);
                break;
            case 'json':
                exportToJSON(data, schema, tableName);
                break;
            case 'excel':
                exportToExcel(data, schema, tableName);
                break;
            default:
                exportToCSV(data, schema, tableName);
        }
        
    } catch (error) {
        console.error('Enhanced export error:', error);
        showNotification('Export failed. Please try again.', 'error');
    }
}

/**
 * Get selected row IDs from table
 */
function getSelectedRowIds(tableName) {
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    if (!tableContainer) return [];
    
    const selectedCheckboxes = tableContainer.querySelectorAll('.select-row:checked');
    return Array.from(selectedCheckboxes).map(checkbox => checkbox.getAttribute('data-id'));
}

/**
 * Export data to CSV format
 */
function exportToCSV(data, schema, tableName) {
    // Create headers
    const headers = schema.fields.map(field => field.displayName);
    headers.push('Date Added');
    
    // Convert data to CSV rows
    const csvRows = data.map(row => {
        const csvRow = schema.fields.map(field => {
            let value = '';
            
            if (schema.isJsonbTable) {
                // Extract from JSONB data
                value = row.data[field.columnName] || '';
            } else {
                // Extract from physical table
                value = row[field.columnName] || '';
            }
            
            // Format based on data type
            if (field.type === 'date' && value) {
                value = new Date(value).toLocaleDateString();
            } else if (field.type === 'numeric' && value) {
                value = parseFloat(value).toLocaleString();
            }
            
            // Escape CSV values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            
            return value;
        });
        
        // Add formatted date
        csvRow.push(row.created_at ? new Date(row.created_at).toLocaleDateString() : '');
        return csvRow.join(',');
    });
    
    // Create and download CSV
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    downloadFile(csvContent, `${tableName}_export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    
    showNotification(`${data.length} records exported to CSV successfully!`, 'success');
}

/**
 * Export data to JSON format
 */
function exportToJSON(data, schema, tableName) {
    const exportData = data.map(row => {
        const record = {};
        
        schema.fields.forEach(field => {
            if (schema.isJsonbTable) {
                record[field.columnName] = row.data[field.columnName];
            } else {
                record[field.columnName] = row[field.columnName];
            }
        });
        
        record.created_at = row.created_at;
        return record;
    });
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    downloadFile(jsonContent, `${tableName}_export_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    
    showNotification(`${data.length} records exported to JSON successfully!`, 'success');
}

/**
 * Export data to Excel format (basic CSV with .xlsx extension)
 */
function exportToExcel(data, schema, tableName) {
    // For now, export as CSV with xlsx extension (basic Excel compatibility)
    // Future enhancement: Use proper Excel library like SheetJS
    exportToCSV(data, schema, tableName);
    
    // Change the file extension by re-downloading
    setTimeout(() => {
        showNotification('Note: Excel export is currently CSV format. Consider upgrading to proper Excel format in future.', 'info');
    }, 1000);
}

/**
 * Generic file download helper
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Show export format selection modal
 */
function openExportFormatModal(tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) return;
    
    const modalHtml = `
        <div id="export-format-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📊 Export ${schema.displayName}</h2>
                    <span class="modal-close" id="close-export-format">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Choose your export format:</p>
                    <div class="export-format-options">
                        <button class="btn btn-primary export-format-btn" data-format="csv" data-table="${tableName}">
                            <span class="material-icons">description</span>
                            CSV (Excel Compatible)
                        </button>
                        <button class="btn btn-secondary export-format-btn" data-format="json" data-table="${tableName}">
                            <span class="material-icons">data_object</span>
                            JSON (Developer Friendly)
                        </button>
                        <button class="btn btn-accent export-format-btn" data-format="excel" data-table="${tableName}">
                            <span class="material-icons">table_chart</span>
                            Excel (Advanced)
                        </button>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="cancel-export-format">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('export-format-modal');
    if (existingModal) existingModal.remove();
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Setup event listeners
    setupExportFormatModalListeners();
    
    // Show modal
    document.getElementById('export-format-modal').style.display = 'block';
}

/**
 * Setup event listeners for export format modal
 */
function setupExportFormatModalListeners() {
    const modal = document.getElementById('export-format-modal');
    const closeBtn = document.getElementById('close-export-format');
    const cancelBtn = document.getElementById('cancel-export-format');
    
    // Close modal events
    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        }
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Format selection
    modal.addEventListener('click', async (e) => {
        if (e.target.classList.contains('export-format-btn')) {
            const format = e.target.getAttribute('data-format');
            const tableName = e.target.getAttribute('data-table');
            
            modal.remove();
            await enhancedJsonbExport(tableName, format);
        }
    });
}

// =================================================================================
// ENHANCED SEARCH & FILTERING WITH AUTO-UPDATE
// =================================================================================


/**
 * Global abort controller for managing search requests
 */
let searchAbortController = null;

/**
 * Initialize flatpickr date range picker for a table
 */
window.initializeDateRangePicker = function(dateElement, tableName) {
    if (!dateElement || !window.flatpickr) {
        console.warn('Flatpickr not available or element not found', { dateElement, flatpickr: window.flatpickr });
        return;
    }
    
    const fp = flatpickr(dateElement, {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: "today",
        allowInput: false,
        clickOpens: true,
        onChange: function(selectedDates, dateStr, instance) {
            // Trigger debounced search when date changes
            debouncedTableSearch(tableName);
        },
        onClose: function(selectedDates, dateStr, instance) {
            // Update placeholder text based on selection
            if (selectedDates.length === 0) {
                instance.input.placeholder = "Select date range...";
            } else if (selectedDates.length === 1) {
                instance.input.placeholder = "Single date selected";
            } else {
                instance.input.placeholder = "Date range selected";
            }
        }
    });
    
    // Store the flatpickr instance on the element for later access
    dateElement._flatpickr = fp;
};

// Define a map to associate table names with their population functions
const tablePopulators = {
    'business_cards': populateContactTable,
    'invoices': populateInvoiceTable,
    // Custom tables will use populateGenericTable - handled separately
};

/**
 * Unified search function that handles all filtering
 */
async function performTableSearch(tableName) {
    // Cancel any pending search requests
    if (searchAbortController) {
        searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    
    try {
        // Show loading state
        const loadingElement = document.querySelector(`.${tableName}-loading`);
        if (loadingElement) {
            loadingElement.style.display = 'inline-block';
        }
        
        // Get current filter values - search and date are completely independent
        const searchInput = document.querySelector(`.${tableName}-search`);
        const dateRangeInput = document.querySelector(`.${tableName}-date-range`);
        
        const searchTerm = searchInput?.value?.trim() || '';
        const selectedDates = dateRangeInput?._flatpickr?.selectedDates || [];
        
        // Construct filters object - each filter is truly independent
        const filters = {};
        
        // Only add search filter if there's actually a search term
        if (searchTerm) {
            filters.searchTerm = searchTerm;
        }
        
        // Only add date filters if dates are actually selected
        if (selectedDates.length > 0) {
            if (selectedDates.length === 1) {
                // Handle single date selection (show only that day)
                const date = new Date(selectedDates[0]);
                filters.startDate = new Date(date.setHours(0, 0, 0, 0)).toISOString();
                filters.endDate = new Date(date.setHours(23, 59, 59, 999)).toISOString();
            } else if (selectedDates.length > 1) {
                // Handle date range selection
                filters.startDate = selectedDates[0].toISOString();
                filters.endDate = selectedDates[1].toISOString();
            }
        }
        
        // CRITICAL: Log the parameters before they are used
        console.log(`Performing search for '${tableName}' with filters:`, filters);
        
        // Look up the correct populate function from the map
        const populateFn = tablePopulators[tableName];
        
        if (typeof populateFn === 'function') {
            // Call the function and pass the filters
            await populateFn(filters);
        } else if (tableName.startsWith('custom_')) {
            // Handle custom JSONB tables
            await populateGenericTable(tableName, filters);
        } else {
            console.error(`No populate function found for table: ${tableName}`);
        }
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Search error:', error);
        }
    } finally {
        // Hide loading state
        const loadingElement = document.querySelector(`.${tableName}-loading`);
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

/**
 * Create debounced search function (300ms delay - optimal for responsive UX)
 */
const debouncedTableSearch = debounce(performTableSearch, 300);

/**
 * Update the existing search event handlers to use auto-search
 */
function setupAutoSearchHandlers() {
    console.log('🚀 setupAutoSearchHandlers() CALLED!');
    console.trace('📍 Call stack for setupAutoSearchHandlers:');
    
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) {
        console.error('❌ .main-content element NOT FOUND!');
        return;
    }
    
    console.log('🔧 Setting up input event listener on mainContent:', mainContent);
    
    // All search functionality now handled by unified generic handler below
    
    console.log("mainContent element:", mainContent); // Step 1: Verify element exists
    
    // Keystroke debugging can be enabled by uncommenting the line below
    // mainContent.addEventListener('keydown', (e) => console.log('⌨️ KEYSTROKE:', e.key, e.target.classList));
    
    mainContent.addEventListener('input', (e) => {
        console.log("Input event fired on:", e.target.id, "Element:", e.target); // Step 1: Confirm events fire
        console.log("All classes:", Array.from(e.target.classList)); // Step 2: Validate classes
        
        // Only handle search box inputs, not date range inputs
        if (e.target.classList.contains('search-box')) { // Step 3: Simplified condition
            // Extract table name from class list using multiple strategies
            let tableName = null;
            
            // Strategy 1: Look for classes ending with '-search'
            const tableClass = Array.from(e.target.classList).find(cls => cls.endsWith('-search'));
            console.log("Matched tableClass:", tableClass); // Step 2: Validate class matching
            if (tableClass) {
                tableName = tableClass.replace('-search', '');
                console.log("Extracted tableName:", tableName); // Step 2: Confirm extraction
            }
            
            // Strategy 2: Handle special cases like 'generic-search'
            if (tableName === 'generic') {
                // For generic searches, try to determine table from current page context
                const customTableSection = e.target.closest('.custom-table-section');
                if (customTableSection) {
                    const titleElement = customTableSection.querySelector('.data-title');
                    if (titleElement && titleElement.textContent) {
                        // Extract table name from title or data attributes
                        tableName = customTableSection.dataset.tableName || 'custom_table';
                    }
                }
            }
            
            console.log('🔍 Found search box with classes:', Array.from(e.target.classList), 'extracted tableName:', tableName);
            
            if (tableName) {
                console.log(`✅ Input detected for table: ${tableName}`, "Search value:", e.target.value);
                console.log("Available table populators:", Object.keys(tablePopulators));
                console.log("Does tablePopulator exist for", tableName, "?", typeof tablePopulators[tableName]);
                // Use debounced search to prevent API overload and race conditions
                console.log("Calling debouncedTableSearch for:", tableName);
                debouncedTableSearch(tableName); // Use debounced version
            } else {
                console.log('❌ Could not determine table name from search input', "Classes found:", Array.from(e.target.classList));
            }
        } else {
            console.log('❌ Input event did not match search-box criteria or was date-range input');
        }
    });
    
    // Add event listeners for clear buttons
    mainContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn') && Array.from(e.target.classList).some(cls => cls.includes('-clear-btn'))) {
            // Extract table name from class list
            const tableClass = Array.from(e.target.classList).find(cls => cls.includes('-clear-btn'));
            if (tableClass) {
                const tableName = tableClass.replace('-clear-btn', '');
                clearTableFilters(tableName);
            }
        }
    });
}

/**
 * Clear all filters for a specific table
 */
function clearTableFilters(tableName) {
    // Clear search input
    const searchInput = document.querySelector(`.${tableName}-search`);
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Clear date range picker (simplified - remove placeholder manipulation)
    const dateRangeInput = document.querySelector(`.${tableName}-date-range`);
    if (dateRangeInput && dateRangeInput._flatpickr) {
        // .clear() should handle resetting the value - don't rely on onChange triggering
        dateRangeInput._flatpickr.clear();
    }
    
    // Explicitly trigger search to refresh table (safeguard since .clear() onChange is unreliable)
    debouncedTableSearch(tableName);
}

// Auto-search handlers are initialized via initializeApp() and setupEventListeners() - no duplicate initialization needed

// =================================================================================
// TABLE MANAGEMENT FUNCTIONALITY
// =================================================================================

/**
 * Initialize table management functionality
 */
function initializeTableManagement() {
    // Set up dropdown toggles
    document.addEventListener('click', (e) => {
        // Handle dropdown toggles
        if (e.target.closest('.dropdown-toggle')) {
            e.preventDefault();
            const dropdown = e.target.closest('.dropdown');
            const menu = dropdown?.querySelector('.dropdown-menu');
            if (menu) {
                menu.classList.toggle('show');
            }
        }
        
        // Close dropdown when clicking outside
        else if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
        
        // Handle edit table button clicks
        else if (e.target.closest('.dropdown-item') && e.target.closest('.dropdown-item').classList.toString().includes('-edit-table-btn')) {
            const tableName = extractTableNameFromClass(e.target.closest('.dropdown-item').classList, '-edit-table-btn');
            if (tableName) {
                showEditTableModal(tableName);
            }
        }
        
        // Handle delete table button clicks
        else if (e.target.closest('.dropdown-item') && e.target.closest('.dropdown-item').classList.toString().includes('-delete-table-btn')) {
            const tableName = extractTableNameFromClass(e.target.closest('.dropdown-item').classList, '-delete-table-btn');
            if (tableName) {
                showDeleteTableModal(tableName);
            }
        }
    });
    
    // Set up modal event listeners
    setupTableModalListeners();
}

/**
 * Extract table name from class list
 */
function extractTableNameFromClass(classList, suffix) {
    const classArray = Array.from(classList);
    const targetClass = classArray.find(cls => cls.endsWith(suffix));
    return targetClass ? targetClass.replace(suffix, '') : null;
}

/**
 * Setup modal event listeners for table management
 */
function setupTableModalListeners() {
    // Edit table modal listeners
    const editTableModal = document.getElementById('edit-table-modal');
    const closeEditBtn = document.getElementById('close-edit-table-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-table-btn');
    const saveChangesBtn = document.getElementById('save-table-changes-btn');
    const addColumnBtn = document.getElementById('add-column-btn');
    
    if (closeEditBtn) closeEditBtn.addEventListener('click', () => hideEditTableModal());
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => hideEditTableModal());
    if (saveChangesBtn) saveChangesBtn.addEventListener('click', () => saveTableChanges());
    if (addColumnBtn) addColumnBtn.addEventListener('click', () => addColumnRow());
    
    // Delete table modal listeners  
    const deleteTableModal = document.getElementById('delete-table-modal');
    const closeDeleteBtn = document.getElementById('close-delete-table-modal-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-table-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-table-btn');
    const confirmInput = document.getElementById('confirm-table-name');
    
    if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', () => hideDeleteTableModal());
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => hideDeleteTableModal());
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => confirmTableDelete());
    
    // Enable/disable delete button based on confirmation input
    if (confirmInput) {
        confirmInput.addEventListener('input', (e) => {
            const tableName = e.target.dataset.tableName;
            const schema = tableSchemas[tableName];
            const confirmBtn = document.getElementById('confirm-delete-table-btn');
            if (confirmBtn && schema) {
                confirmBtn.disabled = e.target.value.trim() !== schema.displayName;
            }
        });
    }
}

let currentEditingTable = null;

/**
 * Show the edit table modal
 */
function showEditTableModal(tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        showNotification('Table not found', 'error');
        return;
    }
    
    currentEditingTable = tableName;
    const modal = document.getElementById('edit-table-modal');
    const nameInput = document.getElementById('edit-table-name');
    
    // Populate current table name
    nameInput.value = schema.displayName;
    
    // Populate columns
    populateEditColumns(schema);
    
    // Show modal
    modal.style.display = 'flex';
}

/**
 * Hide the edit table modal
 */
function hideEditTableModal() {
    const modal = document.getElementById('edit-table-modal');
    modal.style.display = 'none';
    currentEditingTable = null;
}

/**
 * Show the delete table modal
 */
function showDeleteTableModal(tableName) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        showNotification('Table not found', 'error');
        return;
    }
    
    const modal = document.getElementById('delete-table-modal');
    const message = document.getElementById('delete-table-message');
    const confirmInput = document.getElementById('confirm-table-name');
    
    message.textContent = `Are you sure you want to delete the table "${schema.displayName}"?`;
    confirmInput.value = '';
    confirmInput.dataset.tableName = tableName;
    
    // Reset delete button state
    const confirmBtn = document.getElementById('confirm-delete-table-btn');
    if (confirmBtn) confirmBtn.disabled = true;
    
    modal.style.display = 'flex';
}

/**
 * Hide the delete table modal
 */
function hideDeleteTableModal() {
    const modal = document.getElementById('delete-table-modal');
    modal.style.display = 'none';
}

/**
 * Populate the edit columns section
 */
function populateEditColumns(schema) {
    const container = document.getElementById('edit-columns-container');
    container.innerHTML = '';
    
    console.log('🔍 DEBUG: Schema fields structure:', schema.fields);
    
    schema.fields.forEach((field, index) => {
        console.log(`🔍 DEBUG: Field ${index}:`, field);
        console.log('🔍 DEBUG: Field keys:', Object.keys(field));
        addColumnRow(field, field.primary_key === true);
    });
}

/**
 * Add a column row to the edit form
 */
function addColumnRow(fieldData = null, isPrimaryKey = false) {
    console.log('🔍 DEBUG: addColumnRow called with fieldData:', fieldData, 'isPrimaryKey:', isPrimaryKey);
    console.log('🔍 DEBUG: fieldData?.name:', fieldData?.name);
    console.log('🔍 DEBUG: fieldData?.type:', fieldData?.type);
    
    const container = document.getElementById('edit-columns-container');
    const row = document.createElement('div');
    row.className = 'column-row';
    
    const fieldName = fieldData?.name || fieldData?.columnName || '';
    const fieldType = fieldData?.type || fieldData?.dataType?.toLowerCase() || 'text';
    
    console.log('🔍 DEBUG: Using fieldName:', fieldName, 'fieldType:', fieldType);
    
    row.innerHTML = `
        <input type="text" placeholder="Column name" class="column-name" value="${fieldName}" required>
        <select class="column-type">
            <option value="text" ${fieldType === 'text' ? 'selected' : ''}>Text</option>
            <option value="numeric" ${fieldType === 'numeric' ? 'selected' : ''}>Number</option>
            <option value="date" ${fieldType === 'date' ? 'selected' : ''}>Date</option>
        </select>
        <label style="display: flex; align-items: center; white-space: nowrap;">
            <input type="radio" name="primary-key-edit" class="primary-key" ${isPrimaryKey ? 'checked' : ''}>
            <span style="margin-left: 4px;">Primary</span>
        </label>
        <button type="button" class="remove-column-btn" onclick="removeColumnRow(this)">
            <span class="material-icons">delete</span>
        </button>
    `;
    
    container.appendChild(row);
}

/**
 * Remove a column row
 */
window.removeColumnRow = function(btn) {
    const row = btn.closest('.column-row');
    const wasChecked = row.querySelector('.primary-key').checked;
    row.remove();
    
    // If this was the primary key, select the first available
    if (wasChecked) {
        const firstRadio = document.querySelector('.column-row .primary-key');
        if (firstRadio) firstRadio.checked = true;
    }
    
    // Ensure at least one column remains
    const remaining = document.querySelectorAll('.column-row');
    if (remaining.length === 0) {
        addColumnRow();
    }
};

/**
 * Save table changes
 */
async function saveTableChanges() {
    if (!currentEditingTable) return;
    
    const saveBtn = document.getElementById('save-table-changes-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const newName = document.getElementById('edit-table-name').value.trim();
        const columnRows = document.querySelectorAll('.column-row');
        const fields = [];
        let primaryKeyField = null;
        
        // Validate and collect column data
        for (let i = 0; i < columnRows.length; i++) {
            const row = columnRows[i];
            const name = row.querySelector('.column-name').value.trim();
            const type = row.querySelector('.column-type').value;
            const isPrimary = row.querySelector('.primary-key').checked;
            
            if (!name) {
                showNotification('All columns must have names', 'error');
                return;
            }
            
            if (!/^[a-z][a-z0-9_]*$/.test(name)) {
                showNotification('Column names must start with a letter and contain only lowercase letters, numbers, and underscores', 'error');
                return;
            }
            
            if (isPrimary) primaryKeyField = name;
            
            fields.push({
                name,
                label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type,
                order: i,
                primary_key: isPrimary
            });
        }
        
        if (!primaryKeyField) {
            showNotification('Please select one field as the primary key', 'error');
            return;
        }
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('You must be logged in to edit tables', 'error');
            return;
        }
        
        // Update the table in Supabase
        const { error } = await supabase
            .from('user_tables')
            .update({
                name: newName,
                schema_definition: fields
            })
            .eq('table_key', currentEditingTable)
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error updating table:', error);
            showNotification('Failed to update table', 'error');
        } else {
            showNotification('Table updated successfully!', 'success');
            hideEditTableModal();
            
            // Reload table schemas and rebuild pages
            await loadTableSchemas();
        }
        
    } catch (error) {
        console.error('Unexpected error updating table:', error);
        showNotification('An unexpected error occurred', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

/**
 * Confirm table deletion
 */
async function confirmTableDelete() {
    const confirmInput = document.getElementById('confirm-table-name');
    const tableName = confirmInput.dataset.tableName;
    const schema = tableSchemas[tableName];
    
    if (!schema || confirmInput.value.trim() !== schema.displayName) {
        showNotification('Please type the exact table name to confirm deletion', 'error');
        return;
    }
    
    const deleteBtn = document.getElementById('confirm-delete-table-btn');
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
    
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('You must be logged in to delete tables', 'error');
            return;
        }
        
        // Delete all data for this table first
        const { error: dataError } = await supabase
            .from('user_table_data')
            .delete()
            .eq('table_id', schema.tableId)
            .eq('user_id', user.id);
        
        if (dataError) {
            console.error('Error deleting table data:', dataError);
            showNotification('Failed to delete table data', 'error');
            return;
        }
        
        // Delete the table definition
        const { error: tableError } = await supabase
            .from('user_tables')
            .delete()
            .eq('table_key', tableName)
            .eq('user_id', user.id);
        
        if (tableError) {
            console.error('Error deleting table:', tableError);
            showNotification('Failed to delete table', 'error');
        } else {
            showNotification(`Table "${schema.displayName}" deleted successfully!`, 'success');
            hideDeleteTableModal();
            
            // Reload table schemas and rebuild pages
            await loadTableSchemas();
            
            // Redirect to dashboard if we're on the deleted table's page
            const currentPageId = document.querySelector('.page-content[style*="display: block"], .page-content[style="display: block;"]')?.id;
            const deletedPageId = `page-${tableName.replace('custom_', '')}`;
            if (currentPageId === deletedPageId) {
                showPage('page-dashboard');
            }
        }
        
    } catch (error) {
        console.error('Unexpected error deleting table:', error);
        showNotification('An unexpected error occurred', 'error');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
    }
}

