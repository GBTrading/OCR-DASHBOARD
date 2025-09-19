import { supabase } from './supabaseClient.js';
import { initializeCreateTablePage } from './customTable.js';

// ===== FEATURE FLAGS =====
const FEATURE_FLAGS = {
    ENABLE_QR_UPLOAD: false, // Set to false to disable QR functionality
    NEW_CAMERA_CAPTURE: true // For camera preview fix
};

// ===== API CONFIGURATION =====
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:4242'
    : window.location.origin; // Use same domain as frontend for Vercel deployment

// ===== API HELPER FUNCTIONS =====
/**
 * Enhanced function to create checkout session with OCR Packages integration
 * @param {string} priceId - Stripe price ID
 * @param {string} planType - Plan type (basic, vision_pro, vision_max, quick_scan, etc.)
 * @param {Object} options - Additional options for metadata and customization
 * @returns {Promise<Object|null>} Session data or null if failed
 */
async function createCheckoutSession(priceId, planType, options = {}) {
    // Enhanced validation
    if (!priceId || !priceId.startsWith('price_')) {
        console.error('❌ Invalid price ID format:', priceId);
        showNotification('Invalid pricing configuration. Please try again.', 'error');
        return null;
    }

    if (!planType || typeof planType !== 'string') {
        console.error('❌ Invalid plan type:', planType);
        showNotification('Invalid plan type. Please try again.', 'error');
        return null;
    }

    // Guard clause: Ensure user is authenticated
    if (!currentUser || !currentUser.id) {
        console.error('❌ User is not authenticated. Cannot create checkout session.');
        showNotification('Please log in to proceed with payment', 'error');
        return null;
    }

    // Check for placeholder price IDs
    if (priceId.includes('REPLACE_WITH_ACTUAL')) {
        console.error('❌ Placeholder price ID detected:', priceId);
        showNotification('Pricing configuration incomplete. Please contact support.', 'error');
        return null;
    }

    try {
        showNotification('Creating secure payment session...', 'info');

        // Enhanced request payload with metadata
        const requestPayload = {
            priceId: priceId,
            userId: currentUser.id,
            planType: planType,
            metadata: {
                source: 'ocr_packages',
                plan_type: planType,
                user_email: currentUser.email || 'unknown',
                timestamp: new Date().toISOString(),
                ...options.metadata
            }
        };

        console.log('💳 Creating checkout session:', {
            priceId: priceId,
            planType: planType,
            userId: currentUser.id
        });

        const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: response.statusText || 'Failed to create session'
            }));

            // Enhanced error handling
            if (response.status === 400) {
                console.error('❌ Bad request:', errorData.error);
                showNotification('Invalid payment request. Please try again.', 'error');
            } else if (response.status === 401) {
                console.error('❌ Authentication error');
                showNotification('Please log in again to continue.', 'error');
            } else if (response.status === 500) {
                console.error('❌ Server error:', errorData.error);
                showNotification('Payment system temporarily unavailable. Please try again.', 'error');
            } else {
                console.error('❌ Unknown error:', errorData.error);
                showNotification('Payment session creation failed. Please try again.', 'error');
            }

            throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const sessionData = await response.json();

        // Validate session response
        if (!sessionData.url || !sessionData.sessionId) {
            console.error('❌ Invalid session response:', sessionData);
            showNotification('Invalid payment session. Please try again.', 'error');
            return null;
        }

        console.log('✅ Checkout session created successfully:', sessionData.sessionId);
        showNotification('Redirecting to secure payment...', 'success');

        return sessionData;

    } catch (error) {
        console.error('❌ Error creating checkout session:', error);
        showNotification('Payment session creation failed. Please try again.', 'error');
        return null;
    }
}

// Initialize Vercel Analytics (loaded via CDN in index.html)
if (window.va && window.va.inject) {
    window.va.inject();
}

console.log('🚨🚨🚨 DEBUG: app.js is loading...');
console.log('🚨🚨🚨 DEBUG: Current timestamp:', new Date().toISOString());
console.log('📊 Vercel Analytics initialized');
console.log('🏁 Feature Flags:', FEATURE_FLAGS);

// ===== BULK OPERATIONS STATE MANAGEMENT =====
// Global state for bulk operations
const selectedItems = {};

// Bulk operations utility functions
function ensureTableState(tableName) {
    if (!selectedItems[tableName]) {
        selectedItems[tableName] = new Set();
    }
}

// Handle individual row selection changes
function handleSelectionChange(tableName, itemId, isSelected) {
    ensureTableState(tableName);
    const selection = selectedItems[tableName];

    if (isSelected) {
        selection.add(itemId);
    } else {
        selection.delete(itemId);
    }

    // Update UI after every change
    updateBulkActionBar(tableName);
    updateSelectAllCheckbox(tableName);
    updateBulkDeleteButton(tableName);
}

// Update the integrated bulk actions
function updateBulkActionBar(tableName) {
    const selection = selectedItems[tableName] || new Set();
    const selectionCount = selection.size;
    
    const integratedBulkActions = document.getElementById(`integrated-bulk-actions-${tableName}`);
    
    if (!integratedBulkActions) return; // Element doesn't exist yet
    
    if (selectionCount > 0) {
        integratedBulkActions.style.display = 'flex';
        const countElement = integratedBulkActions.querySelector('.selection-count');
        if (countElement) {
            countElement.textContent = `${selectionCount} selected`;
        }
    } else {
        integratedBulkActions.style.display = 'none';
    }
}

// Update bulk delete button visibility for custom tables
function updateBulkDeleteButton(tableName) {
    const selection = selectedItems[tableName] || new Set();
    const selectionCount = selection.size;
    
    // Find the bulk delete button for this table
    const bulkDeleteBtn = document.querySelector(`.${tableName}-bulk-delete-btn`);
    
    if (!bulkDeleteBtn) return; // Button doesn't exist for this table
    
    if (selectionCount > 0) {
        bulkDeleteBtn.style.display = 'inline-block';
        bulkDeleteBtn.textContent = `Delete ${selectionCount} Selected`;
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
}

// Update select-all checkbox state (checked/unchecked/indeterminate)
function updateSelectAllCheckbox(tableName) {
    const selectAllCheckbox = document.getElementById(`select-all-${tableName}`);
    if (!selectAllCheckbox) return;
    
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    if (!tableContainer) return;
    
    const allCheckboxes = tableContainer.querySelectorAll('.select-row');
    const checkedCheckboxes = tableContainer.querySelectorAll('.select-row:checked');
    
    if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}


// Handle bulk delete operation
async function handleBulkDelete(tableName) {
    const selectedIds = Array.from(selectedItems[tableName] || new Set());
    
    if (selectedIds.length === 0) {
        showNotification('No items selected', 'warning');
        return;
    }

    // Show confirmation modal
    const confirmed = await showBulkDeleteConfirmation(selectedIds.length, tableName);
    if (!confirmed) return;

    // Optimistic UI update - add deleting class to all selected rows
    const rowsToDelete = [];
    selectedIds.forEach(id => {
        const row = document.querySelector(`button.delete-btn[data-id="${id}"]`)?.closest('tr');
        if (row) {
            rowsToDelete.push(row);
            row.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
        }
    });

    try {
        // Perform bulk delete with Supabase
        const success = await performBulkDelete(tableName, selectedIds);
        
        if (success) {
            // Remove rows after animation
            setTimeout(() => {
                rowsToDelete.forEach(row => row.remove());
                // Clear selection state
                selectedItems[tableName].clear();
                updateBulkActionBar(tableName);
                updateSelectAllCheckbox(tableName);
                updateBulkDeleteButton(tableName);
                // Update navigation count
                updateNavigationRecordCount(tableName);
                showNotification(`${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} deleted successfully`, 'success');
            }, 300);
        } else {
            throw new Error('Bulk delete failed');
        }
    } catch (error) {
        console.error('Bulk delete error:', error);
        showNotification('Failed to delete items. Please try again.', 'error');
        // Revert optimistic UI
        rowsToDelete.forEach(row => {
            row.style.opacity = '1';
            row.style.transform = 'translateX(0)';
        });
    }
}

// Perform bulk delete using Supabase
async function performBulkDelete(tableName, selectedIds) {
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        return false;
    }

    try {
        let result;
        if (schema.isJsonbTable) {
            // For JSONB custom tables, delete from user_table_data
            result = await supabase
                .from('user_table_data')
                .delete()
                .in('id', selectedIds)
                .eq('user_id', currentUser?.id);
        } else {
            // For built-in tables, also use user_table_data (based on existing pattern)
            result = await supabase
                .from('user_table_data')
                .delete()
                .in('id', selectedIds)
                .eq('user_id', currentUser?.id);
        }

        if (result.error) {
            console.error('Bulk delete API error:', result.error);
            return false;
        }

        // Update dashboard stats
        fetchInitialDashboardData();
        return true;
    } catch (error) {
        console.error('Bulk delete unexpected error:', error);
        return false;
    }
}

// Show bulk delete confirmation modal
async function showBulkDeleteConfirmation(count, tableName) {
    const schema = tableSchemas[tableName];
    const displayName = schema?.displayName || 'items';
    
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Confirm Bulk Delete</h3>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to permanently delete the <strong>${count}</strong> selected ${displayName.toLowerCase()}? This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="bulk-cancel-delete">Cancel</button>
                    <button type="button" class="btn btn-danger" id="bulk-confirm-delete">Delete ${count} Items</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        modal.querySelector('#bulk-confirm-delete').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
        
        modal.querySelector('#bulk-cancel-delete').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

// Clear table selection (Cancel button)
function clearTableSelection(tableName) {
    const selection = selectedItems[tableName];
    if (selection) {
        selection.clear();
    }
    
    // Uncheck all checkboxes
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    if (tableContainer) {
        const checkboxes = tableContainer.querySelectorAll('.select-row');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.disabled = false; // Re-enable any disabled checkboxes
        });
    }
    
    // Update UI
    updateBulkActionBar(tableName);
    updateSelectAllCheckbox(tableName);
    updateBulkDeleteButton(tableName);
    
    // Remove row highlighting
    const rows = document.querySelectorAll('tr.bulk-selected');
    rows.forEach(row => row.classList.remove('bulk-selected'));
}

// Make functions globally accessible
window.handleBulkDelete = handleBulkDelete;
window.clearTableSelection = clearTableSelection;

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
            // Handle bulk delete button clicks for custom tables
            else if (e.target.className.includes('-bulk-delete-btn')) {
                const tableName = extractTableNameFromString(e.target.className);
                if (tableName && tableSchemas[tableName]) {
                    handleBulkDelete(tableName);
                }
            }
            // Handle export button clicks for custom tables
            else if (e.target.classList.contains('export-csv-btn') || e.target.className.includes('-export-csv-btn') || e.target.id.includes('-export-csv-btn')) {
                console.log(`[DEBUG] CSV export button clicked. Classes: ${e.target.className}, ID: ${e.target.id}`);
                const tableName = extractTableNameFromString(e.target.className) || extractTableNameFromString(e.target.id);
                console.log(`[DEBUG] Extracted table name: ${tableName}`);
                console.log(`[DEBUG] tableSchemas has ${tableName}:`, !!tableSchemas[tableName]);
                if (tableName && tableSchemas[tableName]) {
                    console.log(`[DEBUG] Calling handleCustomTableExport(${tableName}, 'csv')`);
                    handleCustomTableExport(tableName, 'csv');
                }
            }
            else if (e.target.classList.contains('export-pdf-btn') || e.target.className.includes('-export-pdf-btn') || e.target.id.includes('-export-pdf-btn')) {
                console.log(`[DEBUG] PDF export button clicked. Classes: ${e.target.className}, ID: ${e.target.id}`);
                const tableName = extractTableNameFromString(e.target.className) || extractTableNameFromString(e.target.id);
                console.log(`[DEBUG] Extracted table name: ${tableName}`);
                console.log(`[DEBUG] tableSchemas has ${tableName}:`, !!tableSchemas[tableName]);
                if (tableName && tableSchemas[tableName]) {
                    console.log(`[DEBUG] Calling handleCustomTableExport(${tableName}, 'pdf')`);
                    handleCustomTableExport(tableName, 'pdf');
                }
            }
            // Handle business cards export buttons
            else if (e.target.id === 'export-business-csv-btn') {
                handleBusinessCardExport('csv');
            }
            else if (e.target.id === 'export-business-pdf-btn') {
                handleBusinessCardExport('pdf');
            }
        });
    }
}

// Helper function for table name extraction from export button classes/IDs
function extractTableNameFromString(str) {
    // Guard clause to ensure we're working with a string
    if (typeof str !== 'string') {
        return null;
    }
    // Handle both export buttons (pattern: tablename-export-format-btn) and bulk delete buttons (pattern: tablename-bulk-delete-btn)
    const exportMatch = str.match(/(\w+)-export-\w+-btn/);
    if (exportMatch) {
        return exportMatch[1];
    }
    
    const bulkDeleteMatch = str.match(/(\w+)-bulk-delete-btn/);
    return bulkDeleteMatch ? bulkDeleteMatch[1] : null;
}

// Handle custom table exports
function handleCustomTableExport(tableName, format) {
    try {
        console.log(`Handling ${format} export for table: ${tableName}`);
        
        if (format === 'csv') {
            enhancedJsonbExport(tableName, 'csv');
        } else if (format === 'pdf') {
            enhancedJsonbExport(tableName, 'pdf');
        }
    } catch (error) {
        console.error(`Export error for ${tableName}:`, error);
        showNotification('Export failed. Please try again.', 'error');
    }
}

// Handle business cards export
function handleBusinessCardExport(format) {
    try {
        console.log(`Handling ${format} export for business cards`);
        
        if (format === 'csv') {
            // Use the enhanced JSONB export for CSV
            enhancedJsonbExport('user_tables', 'csv');
        } else if (format === 'pdf') {
            // Use the enhanced JSONB export for PDF
            enhancedJsonbExport('user_tables', 'pdf');
        }
    } catch (error) {
        console.error(`Business cards export error:`, error);
        showNotification('Export failed. Please try again.', 'error');
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
        saveChangesBtn.addEventListener('click', async () => {
            let success = false;
            
            // Use generic update handler for all tables
            if (currentEditRecord && tableSchemas[currentEditRecord.type]) {
                success = await handleGenericUpdate();
            } else {
                // Fallback to legacy method
                success = await handleUpdate();
            }
            
            // If edit was successful, trigger auto-refresh
            if (success && window.handleEditWithRefresh && currentEditRecord) {
                await window.handleEditWithRefresh(currentEditRecord.type, currentEditRecord.tableName);
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
        confirmDeleteBtn.addEventListener('click', async () => {
            // Use enhanced delete handler with auto-refresh
            if (window.handleDeleteWithRefresh) {
                await window.handleDeleteWithRefresh();
            } else {
                // Fallback to legacy method if tableRefresh.js not loaded
                console.log('🔍 DEBUG: currentDeleteRecord:', currentDeleteRecord);
                console.log('🔍 DEBUG: tableSchemas keys:', Object.keys(tableSchemas));
                console.log('🔍 DEBUG: tableSchemas[currentDeleteRecord.type]:', tableSchemas[currentDeleteRecord.type]);
                
                if (currentDeleteRecord && tableSchemas[currentDeleteRecord.type]) {
                    console.log('🔍 DEBUG: Calling handleGenericDelete for custom table');
                    window.handleGenericDelete();
                } else {
                    console.log('🔍 DEBUG: Calling handleDelete for built-in table');
                    window.handleDelete();
                }
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

    // Insufficient Credits Modal Event Listeners
    const closeInsufficientCreditsBtn = document.getElementById('close-insufficient-credits-modal-btn');
    if (closeInsufficientCreditsBtn) {
        closeInsufficientCreditsBtn.addEventListener('click', closeInsufficientCreditsModal);
    }

    const cancelInsufficientCreditsBtn = document.getElementById('cancel-insufficient-credits-btn');
    if (cancelInsufficientCreditsBtn) {
        cancelInsufficientCreditsBtn.addEventListener('click', closeInsufficientCreditsModal);
    }

    const topupCreditsBtn = document.getElementById('modal-topup-credits-btn');
    if (topupCreditsBtn) {
        topupCreditsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToBillingTab('credit-packs');
        });
    }

    const upgradePlanBtn = document.getElementById('modal-upgrade-plan-btn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const sessionData = await createCheckoutSession('price_1S59leERMwo4L7iyIqBZXwkj', 'basic');
            if (sessionData && sessionData.url) {
                window.open(sessionData.url, '_blank');
            }
        });
    }

    // Close modal when clicking outside
    const insufficientCreditsModal = document.getElementById('insufficient-credits-modal');
    if (insufficientCreditsModal) {
        insufficientCreditsModal.addEventListener('click', (e) => {
            if (e.target === insufficientCreditsModal) closeInsufficientCreditsModal();
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
        isJsonbTable: true,
        tableId: 'b7e8c9d0-1234-5678-9abc-def012345678',
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
    console.log(`🔍 [Mobile Nav Debug] Switching to page: ${pageId} (from: ${currentPage})`);
    
    // ✅ Phase 2.5: Clean up any active QR session when switching pages/tables
    if (crossDeviceUploader?.currentSession?.id && currentPage !== pageId) {
        console.log(`🧹 Page switch detected (${currentPage} → ${pageId}) - cleaning up QR session`);
        crossDeviceUploader.cleanupSession().catch(error => {
            console.warn('Background cleanup error during page switch:', error);
        });
    }
    
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
        
        // Debug navbar button visibility after page switch
        setTimeout(() => {
            console.log('🔍 [Mobile Nav Debug] Running navbar debug check after page switch');
            debugMobileNavbar();
        }, 100);
    } else {
        console.error(`Page with ID '${pageId}' not found`);
    }
}

// Make functions available globally
window.appShowPage = showPage;
window.initializeCreateTablePage = initializeCreateTablePage;
window.loadTableSchemas = loadTableSchemas;
window.updateHamburgerMenu = updateHamburgerMenu;

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
            console.warn('Continuing with built-in schemas only');
            // Don't return early - continue with built-in schemas
        }

        // Merge custom JSONB schemas into our global state (only if no error)
        for (const table of customTables || []) {
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
        
        // Update mobile hamburger menu with new tables
        updateHamburgerMenu();
        
        // Create pages for custom tables
        createCustomTablePages();
        
        console.log('Table schemas loaded:', Object.keys(tableSchemas));
        
        // Make tableSchemas globally accessible for tableRefresh.js
        window.tableSchemas = tableSchemas;
        
        // Update upload button states after loading schemas
        updateUploadButtonStates();
        
    } catch (err) {
        console.error('Unexpected error loading table schemas:', err);
    }
}

/**
 * Update the mobile hamburger menu to include custom tables
 */
function updateHamburgerMenu() {
    const hamburgerMenu = document.querySelector('.hamburger-menu-content');
    if (!hamburgerMenu) return;
    
    // Find existing custom table items and remove them
    const existingCustomItems = hamburgerMenu.querySelectorAll('[data-action^="navigate-to-custom_"]');
    existingCustomItems.forEach(item => item.remove());
    
    // Find the create table item to insert custom tables before it
    const createTableItem = hamburgerMenu.querySelector('[data-action="navigate-to-create-table"]');
    
    // Add custom tables if they exist
    const customTableNames = Object.keys(tableSchemas).filter(name => name.startsWith('custom_'));
    console.log(`🔍 [Hamburger Menu] Found ${customTableNames.length} custom tables in tableSchemas:`, customTableNames);
    console.log(`🔍 [Hamburger Menu] Full tableSchemas keys:`, Object.keys(tableSchemas));
    
    if (customTableNames.length > 0) {
        customTableNames.forEach(tableName => {
            const schema = tableSchemas[tableName];
            if (schema && schema.displayName) {
                const menuItem = document.createElement('a');
                menuItem.href = '#';
                menuItem.className = 'hamburger-menu-item';
                menuItem.setAttribute('data-action', `navigate-to-${tableName}`);
                
                menuItem.innerHTML = `
                    <span class="material-icons">table_chart</span>
                    <span>${schema.displayName}</span>
                `;
                
                // Insert before create table item
                if (createTableItem) {
                    createTableItem.parentNode.insertBefore(menuItem, createTableItem);
                }
            }
        });
        
        console.log(`🔍 [Hamburger Menu] Added ${customTableNames.length} custom tables to hamburger menu`);
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
    const existingCustomPages = mainContent.querySelectorAll('[id^="custom_"]');
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
            newPage.querySelector('.generic-bulk-delete-btn').className = `btn btn-danger ${tableName}-bulk-delete-btn`;
            newPage.querySelector('.generic-export-dropdown').className = `btn btn-primary dropdown-toggle ${tableName}-export-dropdown`;
            newPage.querySelector('.generic-export-csv-btn').className = `dropdown-item ${tableName}-export-csv-btn`;
            newPage.querySelector('.generic-export-pdf-btn').className = `dropdown-item ${tableName}-export-pdf-btn`;
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
            
            // ✅ Add dynamic SelectableTable configuration for custom tables
            initializeCustomTableSelectableTable(tableName);
        }
    }
}

/**
 * Initialize SelectableTable functionality for custom tables
 * Called after each custom table page is created
 */
function initializeCustomTableSelectableTable(tableName) {
    // Add configuration to SelectableTableConfigs
    SelectableTableConfigs[tableName] = {
        selectAllId: `select-all-${tableName}`,
        rowSelector: `#${tableName}-table-container .select-row`,
        containerSelector: `#${tableName}-table-container`,
        rowCheckboxClass: 'select-row',
        tableBodyId: `${tableName}-table-body`,
        dataType: tableName
    };
    
    // Create SelectableTable instance (will be initialized when table is populated)
    selectableTables[tableName] = new SelectableTable(tableName);
    
    console.log(`✅ SelectableTable configured for custom table: ${tableName}`);
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
                let recordId, primaryKeyValue;
                
                if (schema.isJsonbTable) {
                    // For JSONB tables, data is in the 'data' field
                    recordId = row.id;
                    const jsonData = row.data;
                    primaryKeyValue = jsonData[schema.primaryKey] || recordId;
                } else {
                    // For physical tables, data is directly in row
                    recordId = row[schema.primaryKey];
                    primaryKeyValue = recordId;
                }
                
                // Create checkbox with correct class and data-id attribute
                let cells = `<td><input type="checkbox" class="select-row" data-id="${recordId}"></td>`;
                
                if (schema.isJsonbTable) {
                    const jsonData = row.data;
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

        // 4. Setup select all functionality for this table using new SelectableTable system
        if (selectableTables[tableName]) {
            selectableTables[tableName].initialize();
            console.log(`✅ SelectableTable initialized for ${tableName} after population`);
        }

    } catch (err) {
        console.error(`Unexpected error populating table ${tableName}:`, err);
        showNotification(`An error occurred loading ${schema.displayName}`, 'error');
    }
}

// Expose to window scope for tableRefresh.js
window.populateGenericTable = populateGenericTable;

/**
 * Setup select all functionality for a specific table
 */
function setupSelectAllForTable(tableName) {
    const selectAllCheckbox = document.getElementById(`select-all-${tableName}`);
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const tableContainer = document.getElementById(`${tableName}-table-container`);
            if (tableContainer) {
                const rowCheckboxes = tableContainer.querySelectorAll('.select-row');
                rowCheckboxes.forEach(checkbox => {
                    if (!checkbox.disabled) { // Don't change disabled checkboxes
                        checkbox.checked = this.checked;
                        // Trigger selection change for each checkbox
                        const itemId = checkbox.getAttribute('data-id');
                        if (itemId) {
                            handleSelectionChange(tableName, itemId, checkbox.checked);
                            
                            // Add/remove row highlighting
                            const row = checkbox.closest('tr');
                            if (row) {
                                if (checkbox.checked) {
                                    row.classList.add('bulk-selected');
                                } else {
                                    row.classList.remove('bulk-selected');
                                }
                            }
                        }
                    }
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
        if (tableName === 'user_tables') {
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
    if (!currentEditRecord) return false;

    const { type: tableName } = currentEditRecord;
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        showNotification(`Configuration error: Schema not found for ${tableName}`, 'error');
        return false;
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
            return false;
        } else {
            showNotification(`${schema.displayName} record updated successfully!`, 'success');
            
            // Update dashboard stats and navigation (table refresh handled by auto-refresh)
            fetchInitialDashboardData();
            updateNavigationRecordCount(tableName);
            
            return true; // Signal successful update - modal close handled by auto-refresh
        }
    } catch (err) {
        console.error('Unexpected error during update:', err);
        showNotification(`Unexpected error while updating ${schema.displayName}`, 'error');
        return false;
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
    if (!currentDeleteRecord) return false;

    const { id, type: tableName } = currentDeleteRecord;
    const schema = tableSchemas[tableName];
    if (!schema) {
        console.error(`Schema not found for table: ${tableName}`);
        showNotification(`Configuration error: Schema not found for ${tableName}`, 'error');
        return false;
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
                .eq('id', id)
                .eq('user_id', currentUser?.id); // Add user filter for security
            error = result.error;
        } else {
            // Delete from physical table
            const result = await supabase
                .from('user_table_data') // FIXED: Always use user_table_data for all tables
                .delete()
                .eq('id', id)
                .eq('user_id', currentUser?.id); // Add user filter for security
            error = result.error;
        }

        if (error) {
            console.error(`Error deleting from ${tableName}:`, error);
            showNotification(`Failed to delete ${schema.displayName} record: ${error.message}`, 'error');
            return false;
        } else {
            // Optimistic UI update: Find and remove the row from the table immediately
            const rowToRemove = document.querySelector(`button.delete-btn[data-id="${id}"]`)?.closest('tr');
            if (rowToRemove) {
                rowToRemove.style.transition = 'opacity 0.3s ease-out';
                rowToRemove.style.opacity = '0';
                setTimeout(() => rowToRemove.remove(), 300); // Remove after fade
            }

            closeDeleteModal();
            showNotification(`${schema.displayName} record deleted successfully!`, 'success');
            
            // Update dashboard stats and navigation (but don't refresh table - UI already updated optimistically)
            fetchInitialDashboardData();
            updateNavigationRecordCount(tableName);
            
            return true; // Signal successful deletion
        }
    } catch (err) {
        console.error('Unexpected error during deletion:', err);
        showNotification(`Unexpected error while deleting ${schema.displayName} record`, 'error');
        return false;
    } finally {
        // Restore button state
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalButtonText || 'Confirm Delete';
        }
    }
}

// Attach handleGenericDelete to window for global access
window.handleGenericDelete = handleGenericDelete;

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
                window.initializeDateRangePicker(businessCardsDatePicker, 'user_tables');
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
            // Initialize packages section
            initializePackagesSection();
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

// ===== UNIFIED MOBILE/DESKTOP EVENT SYSTEM (Zero Code Duplication) =====
// Maps mobile navigation data-action attributes to existing desktop functions
const UnifiedActions = {
    // Mobile navigation triggers existing desktop functions
    'show-upload-modal': () => {
        console.log('🔥 Mobile action: show-upload-modal -> calling existing openUploadModal()');
        openUploadModal();
    },
    
    'navigate-to-create-table': () => {
        console.log('🔥 Mobile action: navigate-to-create-table -> calling existing showPage()');
        // Remove active class from all nav items
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        // Add active class to desktop create table item
        const desktopNavItem = document.querySelector('[data-page-id="page-create-table"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-create-table');
    },
    
    'navigate-to-settings': () => {
        console.log('🔥 Mobile action: navigate-to-settings -> calling existing showPage()');
        // Update desktop nav state
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const desktopNavItem = document.querySelector('[data-page-id="page-settings"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-settings');
    },
    
    'navigate-to-billing': () => {
        console.log('🔥 Mobile action: navigate-to-billing -> calling existing showPage()');
        // Update desktop nav state
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const desktopNavItem = document.querySelector('[data-page-id="page-billing"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-billing');
    },
    
    'navigate-to-business-cards': () => {
        console.log('🔥 Mobile action: navigate-to-business-cards -> calling existing showPage()');
        // Update desktop nav state
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const desktopNavItem = document.querySelector('[data-page-id="page-business-cards"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-business-cards');
    },
    
    'navigate-to-invoices': () => {
        console.log('🔥 Mobile action: navigate-to-invoices -> calling existing showPage()');
        // Update desktop nav state
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const desktopNavItem = document.querySelector('[data-page-id="page-invoices"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-invoices');
    },
    
    'navigate-to-dashboard': () => {
        console.log('🔥 Mobile action: navigate-to-dashboard -> calling existing showPage()');
        // Update desktop nav state
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        const desktopNavItem = document.querySelector('[data-page-id="page-dashboard"]');
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        showPage('page-dashboard');
    },
    
    'toggle-tables-menu': () => {
        console.log('🔥 Mobile action: toggle-tables-menu -> mobile dropdown UI only');
        MobileNavigation.toggleTablesDropdown();
    },
    
    'toggle-hamburger-menu': () => {
        console.log('🔥 Mobile action: toggle-hamburger-menu -> toggling hamburger menu');
        MobileNavigation.toggleHamburgerMenu();
    },
    
    'close-hamburger-menu': () => {
        console.log('🔥 Mobile action: close-hamburger-menu -> closing hamburger menu');
        MobileNavigation.closeHamburgerMenu();
    },
    
    // User dropdown functionality
    'toggle-user-dropdown': () => {
        console.log('🔥 Mobile action: toggle-user-dropdown');
        const dropdownMenu = document.getElementById('user-dropdown-menu');
        const dropdownBtn = document.getElementById('user-dropdown-btn');
        
        if (dropdownMenu && dropdownBtn) {
            const isOpen = dropdownMenu.getAttribute('aria-hidden') === 'false';
            
            if (isOpen) {
                dropdownMenu.setAttribute('aria-hidden', 'true');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            } else {
                dropdownMenu.setAttribute('aria-hidden', 'false');
                dropdownBtn.setAttribute('aria-expanded', 'true');
            }
        }
    },
    
    'toggle-theme': () => {
        console.log('🔥 Mobile action: toggle-theme');
        // Call existing theme toggle function
        const themeToggle = document.getElementById('header-theme-toggle') || document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.click();
        }
    },
    
    'logout': () => {
        console.log('🔥 Mobile action: logout');
        // Call existing logout function
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.click();
        }
    }
};

// SINGLE EVENT LISTENER - Works for both desktop and mobile
document.addEventListener('click', (event) => {
    const actionElement = event.target.closest('[data-action]');
    
    // Handle click outside user dropdown to close it
    if (!actionElement || actionElement.getAttribute('data-action') !== 'toggle-user-dropdown') {
        const dropdownMenu = document.getElementById('user-dropdown-menu');
        const dropdownBtn = document.getElementById('user-dropdown-btn');
        const userDropdownContainer = event.target.closest('.user-dropdown-container');
        
        if (dropdownMenu && dropdownBtn && !userDropdownContainer) {
            const isOpen = dropdownMenu.getAttribute('aria-hidden') === 'false';
            if (isOpen) {
                dropdownMenu.setAttribute('aria-hidden', 'true');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }
    
    if (!actionElement) return;
    
    const action = actionElement.dataset.action;
    console.log('🔥 Unified action triggered:', action);
    
    if (UnifiedActions[action]) {
        event.preventDefault();
        UnifiedActions[action](actionElement);
    } else if (action.startsWith('navigate-to-custom_')) {
        // Handle custom table navigation dynamically
        event.preventDefault();
        const tableNameWithPrefix = action.replace('navigate-to-', ''); // This will be 'custom_bed'
        const pageKey = tableNameWithPrefix.replace('custom_', '');      // This will be 'bed'
        
        console.log('🔥 Custom table action:', action, '-> navigating to page key:', pageKey);
        
        // Update desktop nav state (remove active from all nav items)
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => item.classList.remove('active'));
        
        // Find and activate corresponding desktop nav item if it exists
        const desktopNavItem = document.querySelector(`[data-page-id="page-${pageKey}"]`);
        if (desktopNavItem) desktopNavItem.classList.add('active');
        
        // Navigate to the correct custom table page ID
        showPage(`page-${pageKey}`);
        
        // Close hamburger menu or bottom sheet after navigation
        if (MobileNavigation.isHamburgerMenuOpen) {
            MobileNavigation.closeHamburgerMenu();
        }
        if (MobileNavigation.isBottomSheetOpen) {
            MobileNavigation.closeTablesBottomSheet();
        }
    }
});

// MOBILE UI MANAGEMENT - Only handles presentation, not business logic
const MobileNavigation = {
    isTablesOpen: false,
    isBottomSheetOpen: false,
    isHamburgerMenuOpen: false,
    
    toggleTablesDropdown() {
        const dropdown = document.querySelector('.nav-dropdown');
        const isCurrentlyOpen = this.isTablesOpen;
        
        console.log('🔥 Mobile dropdown toggle:', isCurrentlyOpen ? 'closing' : 'opening');
        
        if (isCurrentlyOpen) {
            dropdown?.classList.remove('active');
        } else {
            dropdown?.classList.add('active');
        }
        
        this.isTablesOpen = !isCurrentlyOpen;
    },
    
    showTablesBottomSheet() {
        const bottomSheet = document.getElementById('tables-bottom-sheet');
        if (!bottomSheet) return;
        
        console.log('🔥 Opening tables bottom sheet');
        
        // Refresh custom tables every time the sheet is opened
        populateTablesDropdown().then(() => {
            console.log('🔥 Custom tables refreshed in bottom sheet');
        }).catch(error => {
            console.error('🔥 Error refreshing custom tables:', error);
        });
        
        bottomSheet.style.display = 'flex';
        
        // Trigger animation after display
        requestAnimationFrame(() => {
            bottomSheet.classList.add('active');
        });
        
        this.isBottomSheetOpen = true;
        
        // Close on backdrop click
        bottomSheet.addEventListener('click', (e) => {
            if (e.target === bottomSheet) {
                this.closeTablesBottomSheet();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    },
    
    closeTablesBottomSheet() {
        const bottomSheet = document.getElementById('tables-bottom-sheet');
        if (!bottomSheet) return;
        
        console.log('🔥 Closing tables bottom sheet');
        bottomSheet.classList.remove('active');
        
        // Hide after animation completes
        setTimeout(() => {
            bottomSheet.style.display = 'none';
        }, 300);
        
        this.isBottomSheetOpen = false;
        
        // Remove escape key listener
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
    },
    
    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            if (this.isBottomSheetOpen) {
                this.closeTablesBottomSheet();
            } else if (this.isHamburgerMenuOpen) {
                this.closeHamburgerMenu();
            }
        }
    },
    
    toggleHamburgerMenu() {
        if (this.isHamburgerMenuOpen) {
            this.closeHamburgerMenu();
        } else {
            this.showHamburgerMenu();
        }
    },
    
    showHamburgerMenu() {
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        if (!hamburgerMenu || !hamburgerBtn) return;
        
        console.log('🔥 Opening hamburger menu');
        
        // Refresh custom tables in hamburger menu
        if (window.updateHamburgerMenu) {
            window.updateHamburgerMenu();
            console.log('🔥 Custom tables refreshed in hamburger menu');
        }
        
        hamburgerMenu.style.display = 'block';
        hamburgerBtn.classList.add('active');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        
        // Trigger animation after display
        requestAnimationFrame(() => {
            hamburgerMenu.classList.add('active');
        });
        
        this.isHamburgerMenuOpen = true;
        
        // Close on backdrop click
        hamburgerMenu.addEventListener('click', (e) => {
            if (e.target === hamburgerMenu) {
                this.closeHamburgerMenu();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    },
    
    closeHamburgerMenu() {
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        if (!hamburgerMenu || !hamburgerBtn) return;
        
        console.log('🔥 Closing hamburger menu');
        hamburgerMenu.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        
        // Hide after animation completes
        setTimeout(() => {
            hamburgerMenu.style.display = 'none';
        }, 300);
        
        this.isHamburgerMenuOpen = false;
        
        // Remove escape key listener
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
    },
    
    handleResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;
        console.log('🔥 Responsive layout check - Mobile:', isMobile);
        
        // CSS handles most responsive behavior via media queries
        // This just handles any JavaScript-dependent responsive behavior
        if (isMobile) {
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.paddingBottom = '80px';
            }
        }
    }
};

// Initialize responsive layout handling
window.addEventListener('resize', () => {
    MobileNavigation.handleResponsiveLayout();
});

document.addEventListener('DOMContentLoaded', () => {
    MobileNavigation.handleResponsiveLayout();
});

// Close mobile dropdown when clicking outside (UI behavior only)
document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-dropdown') && MobileNavigation.isTablesOpen) {
        console.log('🔥 Closing mobile dropdown - clicked outside');
        MobileNavigation.toggleTablesDropdown();
    }
});

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
    
    // Update user email in header (for both old and new header structures)
    const userEmailElement = document.getElementById('user-email');
    const dropdownUserEmailElement = document.getElementById('dropdown-user-email');
    
    if (currentUser) {
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
        if (dropdownUserEmailElement) {
            dropdownUserEmailElement.textContent = currentUser.email;
        }
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
async function openUploadModal(tableKey = null) {
    uploadModal.style.display = 'flex';
    
    // Populate table selector dropdown
    await populateTableSelector();
    
    // Initialize camera functionality
    initializeCameraOnModalOpen();
    
    if (tableKey) {
        // Pre-select table and initialize QR immediately
        console.log(`✅ Opening modal with table context: ${tableKey}`);
        const tableSelector = document.getElementById('table-selector');
        if (tableSelector) {
            // Find the table ID for the given table key
            let targetTableId = '';
            
            if (tableKey === 'user_tables') {
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
                tableSelector.disabled = true; // Disable dropdown when context is provided
            }
        }
        
        // Keep QR code area hidden initially - user must click "QR Laptop ⇄ Phone" button
        const qrCodeView = document.getElementById('qr-code-view');
        if (qrCodeView) {
            qrCodeView.style.display = 'none';
        }
        
        // Initialize cross-device functionality but don't show QR view yet
        if (FEATURE_FLAGS.ENABLE_QR_UPLOAD) {
            initializeCrossDeviceOnModalOpen();
        } else {
            console.log('⚠️ QR functionality disabled by feature flag');
        }
    } else {
        console.log('⚠️ Opening modal without table context - QR initialization deferred');
        // Hide QR code area until table is selected
        const qrCodeView = document.getElementById('qr-code-view');
        if (qrCodeView) {
            qrCodeView.style.display = 'none';
        }
        
        // Add one-time event listener for table selection
        const tableSelector = document.getElementById('table-selector');
        if (tableSelector) {
            // Remove any existing change listener to prevent duplicates
            const existingListener = tableSelector._qrChangeListener;
            if (existingListener) {
                tableSelector.removeEventListener('change', existingListener);
            }
            
            // Create new listener
            const changeListener = (event) => {
                const selectedTable = event.target.value;
                if (selectedTable) {
                    console.log(`✅ Table selected: ${selectedTable} - initializing QR`);
                    // Show QR code area and initialize functionality only if enabled
                    if (FEATURE_FLAGS.ENABLE_QR_UPLOAD) {
                        if (qrCodeView) {
                            qrCodeView.style.display = 'block';
                        }
                        // Initialize cross-device functionality
                        initializeCrossDeviceOnModalOpen();
                    } else {
                        console.log('⚠️ QR functionality disabled by feature flag');
                    }
                    // Remove this listener since it's one-time
                    tableSelector.removeEventListener('change', changeListener);
                    tableSelector._qrChangeListener = null;
                }
            };
            
            // Store reference for cleanup
            tableSelector._qrChangeListener = changeListener;
            tableSelector.addEventListener('change', changeListener);
        }
    }
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
    // Clean up camera functionality before closing
    cleanupCameraOnModalClose();
    
    // Clean up cross-device functionality before closing
    cleanupCrossDeviceOnModalClose();
    
    // ✅ Phase 1: Reset table selector state
    const tableSelector = document.getElementById('table-selector');
    if (tableSelector) {
        tableSelector.value = '';
        tableSelector.disabled = false; // Re-enable dropdown in case it was disabled
        // Remove any lingering event listeners by cloning and replacing the element
        const newTableSelector = tableSelector.cloneNode(true);
        tableSelector.parentNode.replaceChild(newTableSelector, tableSelector);
    }
    
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
    console.log(`✅ Opening modal for specific table: ${tableKey}`);
    
    // CRITICAL: Validate table context before opening modal
    if (!tableKey) {
        console.error('Cannot open modal: No table key provided');
        showNotification('Please select a table to upload to', 'error');
        return;
    }
    
    // Check if table schema exists
    const schema = tableSchemas[tableKey];
    if (!schema) {
        console.error(`Cannot open modal: Schema not found for table: ${tableKey}`);
        console.log('Available table schemas:', Object.keys(tableSchemas));
        showNotification(`Table configuration not found for ${tableKey}`, 'error');
        return;
    }
    
    console.log(`✅ Table schema validated for: ${tableKey}`, schema);
    await openUploadModal(tableKey);
}

/**
 * Unified entry point for all upload buttons
 * @param {string|null} source - tableKey string or null (derive from UI)
 */
async function showUploadModal(source) {
    console.log(`🚀 showUploadModal called with source:`, source);
    let tableKey = null;
    
    try {
        // 1. Resolve table key based on source type
        if (typeof source === 'string') {
            // Direct table key provided (business cards, custom tables)
            tableKey = source;
            
            // Validate table schema exists for direct table keys
            const schema = tableSchemas[tableKey];
            if (!schema) {
                console.error(`Upload aborted: Schema not found for table: ${tableKey}`);
                console.log('Available schemas:', Object.keys(tableSchemas));
                showNotification(`Table configuration not found for ${tableKey}`, 'error');
                return;
            }
            console.log(`✅ Schema validated for table: ${tableKey}`, schema);
            
        } else {
            // Derive from UI (sidebar, dashboard) - allow null for dashboard
            tableKey = getCurrentTableContext();
            console.log(`🔍 Resolved table key: ${tableKey}`);
            
            // If we have a table context, validate it
            if (tableKey) {
                const schema = tableSchemas[tableKey];
                if (!schema) {
                    console.error(`Upload aborted: Schema not found for table: ${tableKey}`);
                    console.log('Available schemas:', Object.keys(tableSchemas));
                    showNotification(`Table configuration not found for ${tableKey}`, 'error');
                    return;
                }
                console.log(`✅ Schema validated for table: ${tableKey}`, schema);
            } else {
                console.log('ℹ️ No table context - user will select from dropdown');
            }
        }
        
        // 2. Open modal (with or without table context)
        await openUploadModal(tableKey);
        
    } catch (error) {
        console.error('Failed to open upload modal:', error);
        showNotification('Error: Could not open the upload modal', 'error');
    }
}

function previewFiles() {
    filePreviewList.innerHTML = ''; // Clear previous preview
    
    // Handle both fileInput.files (desktop) and window.selectedFiles (mobile/camera)
    const inputFiles = fileInput.files || [];
    const selectedFiles = window.selectedFiles || [];
    
    // Combine both sources
    const allFiles = [...Array.from(inputFiles), ...selectedFiles];
    
    if (allFiles.length > 0) {
        for (const file of allFiles) {
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
    
    // Handle both fileInput.files (desktop) and window.selectedFiles (mobile/camera)
    const inputFiles = fileInput.files || [];
    const selectedFiles = window.selectedFiles || [];
    const files = [...Array.from(inputFiles), ...selectedFiles];

    console.log('📁 Files selected:', files.length);
    console.log('📁 Input files:', inputFiles.length, 'Selected files:', selectedFiles.length);
    if (files.length === 0) {
        showNotification('Please select at least one file to upload.', 'error');
        return;
    }
    
    console.log('👤 Current user:', currentUser);
    if (!currentUser) {
        showNotification('Authentication error. Please log in again.', 'error');
        return;
    }

    // Get current user session and validate authentication
    console.log('🔐 Getting user session for authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('❌ Session error:', sessionError);
        showNotification('Authentication error. Please sign in again.', 'error');
        isUploading = false;
        return;
    }

    if (!session) {
        console.error('❌ No active session found');
        showNotification('Your session has expired. Please sign in again.', 'error');
        isUploading = false;
        return;
    }

    const accessToken = session.access_token;
    console.log('✅ Access token obtained for user authentication');

    // Get selected table from dropdown
    const tableSelector = document.getElementById('table-selector');
    const selectedTableId = tableSelector ? tableSelector.value : '';

    console.log('🏷️ Selected table ID:', selectedTableId);
    if (!selectedTableId) {
        showNotification('Please select a table to upload to.', 'error');
        isUploading = false;
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]); // The key 'files' must match what n8n expects
    }

    // Append the user's ID and table ID to the form data for n8n
    formData.append('userId', currentUser.id);
    formData.append('tableId', selectedTableId);

    // Add access token to FormData to avoid CORS preflight issues
    formData.append('accessToken', accessToken);

    const webhookUrl = 'https://n8n.gbtradingllc.com/webhook/upload-files'; // Production webhook URL

    console.log('📦 FormData prepared. About to send request...');
    console.log('🔗 Webhook URL:', webhookUrl);

    try {
        showNotification('Uploading...', 'info');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        console.log('🌐 Making fetch request with user authentication via FormData...');
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            // Token now sent via FormData to avoid CORS preflight issues
        });

        console.log('📡 Response received:', response.status, response.statusText);

        // First, handle HTTP-level errors (500, 404, network issues)
        if (!response.ok) {
            console.error('❌ Response not ok:', response.status, response.statusText);

            // Try to get a meaningful error message from the response body
            try {
                const errorData = await response.json();
                const errorMessage = errorData.message || `HTTP error! Status: ${response.status}`;
                showNotification(errorMessage, 'error');
            } catch (jsonError) {
                // If response body isn't JSON, use status text
                showNotification(`Upload failed: ${response.statusText || response.status}`, 'error');
            }

            // Reset UI state
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Files';
            return; // Stop execution here
        }

        // Parse response body for application-level results
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('❌ Failed to parse response JSON:', jsonError);
            showNotification('Upload failed: Invalid response format', 'error');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Files';
            return;
        }

        // Check for application-specific errors in response body (like insufficient credits)
        if (result.status === 'error' || result.success === false || result.error) {
            const errorMessage = result.message ||
                               (result.error && result.error.message) ||
                               'Processing failed. Please try again.';
            console.error('❌ Application error:', errorMessage);

            // Check if this is an insufficient credits error and show modal instead of notification
            if (errorMessage.toLowerCase().includes('insufficient credits') ||
                errorMessage.toLowerCase().includes('not enough credits') ||
                result.code === 'INSUFFICIENT_CREDITS') {
                console.log('🎯 Insufficient credits detected - showing modal');
                showInsufficientCreditsModal();
            } else {
                showNotification(errorMessage, 'error');
            }

            // Reset UI state
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Files';
            return;
        }

        console.log('✅ Upload successful!');

        showNotification('Upload successful! Processing documents...', 'success');

        // Clear selectedFiles and sessionStorage after successful upload
        window.selectedFiles = [];
        sessionStorage.removeItem('selectedFiles');
        
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
    handleInvoiceExportFormat('csv'); // Default to CSV for legacy calls
}

// Row Selection Functions
// =================================================================================
// SELECTABLE TABLE COMPONENT SYSTEM
// =================================================================================

/**
 * SelectableTable Configuration
 * Defines table-specific settings for consistent behavior across all tables
 */
const SelectableTableConfigs = {
    'business_cards': {
        selectAllId: 'select-all-business_cards',
        rowSelector: '#business_cards-table-container .select-row',
        containerSelector: '#business_cards-table-container',
        rowCheckboxClass: 'select-row',
        tableBodyId: 'contacts-table-body',
        dataType: 'business_cards'
    },
    'invoices': {
        selectAllId: 'select-all-invoices', 
        rowSelector: '.invoice-row-checkbox',
        containerSelector: null, // Invoices don't have a specific container
        rowCheckboxClass: 'invoice-row-checkbox',
        tableBodyId: 'invoices-table-body',
        dataType: 'invoice'
    }
};

/**
 * Enhanced SelectableTable functionality with configuration-driven approach
 * Handles select-all, bulk operations, and table state management
 */
class SelectableTable {
    constructor(tableType) {
        this.config = SelectableTableConfigs[tableType];
        this.tableType = tableType;
        this.selectAllCheckbox = null;
        this.initialized = false;
    }

    /**
     * Initialize the selectable table functionality
     */
    initialize() {
        if (!this.config) {
            console.warn(`No configuration found for table type: ${this.tableType}`);
            return;
        }

        this.selectAllCheckbox = document.getElementById(this.config.selectAllId);
        if (this.selectAllCheckbox) {
            // Remove any existing listeners to avoid duplicates
            this.selectAllCheckbox.replaceWith(this.selectAllCheckbox.cloneNode(true));
            this.selectAllCheckbox = document.getElementById(this.config.selectAllId);
            
            // Add select-all functionality
            this.selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
            
            this.initialized = true;
            console.log(`✅ SelectableTable initialized for: ${this.tableType}`);
        } else {
            console.warn(`Select-all checkbox not found: ${this.config.selectAllId}`);
        }
    }

    /**
     * Handle select all checkbox change
     */
    handleSelectAll(checked) {
        const rowCheckboxes = document.querySelectorAll(this.config.rowSelector);
        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = checked;
            
            // ✅ Integrate with state management system
            const itemId = checkbox.dataset.id;
            if (itemId && this.config.dataType) {
                handleSelectionChange(this.config.dataType, itemId, checked);
            }
        });
        console.log(`${checked ? 'Selected' : 'Deselected'} ${rowCheckboxes.length} rows in ${this.tableType} table`);
    }

    /**
     * Get all selected row IDs
     */
    getSelectedIds() {
        const checkedBoxes = document.querySelectorAll(`${this.config.rowSelector}:checked`);
        return Array.from(checkedBoxes).map(checkbox => checkbox.dataset.id).filter(id => id);
    }

    /**
     * Get count of selected rows
     */
    getSelectedCount() {
        const checkedBoxes = document.querySelectorAll(`${this.config.rowSelector}:checked`);
        return checkedBoxes.length;
    }

    /**
     * Update select-all checkbox state based on row selection
     */
    updateSelectAllState() {
        if (!this.selectAllCheckbox) return;

        const allRowCheckboxes = document.querySelectorAll(this.config.rowSelector);
        const checkedRowCheckboxes = document.querySelectorAll(`${this.config.rowSelector}:checked`);
        
        if (allRowCheckboxes.length === 0) {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = false;
        } else if (checkedRowCheckboxes.length === allRowCheckboxes.length) {
            this.selectAllCheckbox.checked = true;
            this.selectAllCheckbox.indeterminate = false;
        } else if (checkedRowCheckboxes.length > 0) {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = true;
        } else {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = false;
        }
    }
}

// Global SelectableTable instances
const selectableTables = {
    business_cards: new SelectableTable('business_cards'),
    invoices: new SelectableTable('invoices')
};

/**
 * Initialize all SelectableTable instances
 * Replaces the old setupSelectAllFunctionality function
 */
function setupSelectAllFunctionality() {
    Object.values(selectableTables).forEach(table => {
        table.initialize();
    });
}

// Updated VCF Generation Function - Works with selected rows only
function generateVCF() {
    const businessCardsTable = selectableTables.business_cards;
    if (!businessCardsTable.initialized) {
        showNotification('Table not ready for export.', 'error');
        return;
    }
    
    const selectedCount = businessCardsTable.getSelectedCount();
    if (selectedCount === 0) {
        showNotification('Please select at least one business card to export.', 'error');
        return;
    }
    
    const checkedBoxes = document.querySelectorAll('#business_cards-table-container .select-row:checked');
    
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
function handleInvoiceExportFormat(format) {
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
    const tableName = type === 'contact' || type === 'business_cards' ? 'user_tables' : 'invoices';
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
            type === 'contact' || type === 'business_cards' ? 'Edit Business Card' : 'Edit Invoice';
        
        // Generate form fields based on record type
        const formFields = document.getElementById('edit-form-fields');
        formFields.innerHTML = '';
        
        if (type === 'contact' || type === 'business_cards') {
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
        return false;
    }

    const { id, type } = currentEditRecord;
    const tableName = type === 'contact' || type === 'business_cards' ? 'user_tables' : 'invoices';
    const primaryKeyColumn = primaryKeys[tableName]; // Get the correct primary key for the table
    
    try {
        let updateData = {};
        
        if (type === 'contact' || type === 'business_cards') {
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
        showNotification(`${type === 'contact' || type === 'business_cards' ? 'Business card' : 'Invoice'} updated successfully!`, 'success');
        
        // Refresh dashboard stats (table refresh and modal close handled by auto-refresh)
        fetchInitialDashboardData();
        
        return true; // Signal successful update

    } catch (error) {
        console.error('Error updating record:', error);
        showNotification('Error updating record. Please try again.', 'error');
        return false;
    }
}

// Delete Confirmation Functions
function openDeleteConfirm(id, type) {
    currentDeleteRecord = { id, type };
    window.currentDeleteRecord = { id, type }; // Make globally accessible
    
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
    window.currentDeleteRecord = null; // Clear global reference
}

// In app.js, find and update this function

async function handleDelete() {
    if (!currentDeleteRecord) { // Use the correct state variable for deletion
        showNotification('No record selected for deletion.', 'error');
        return false;
    }
    
    const { id, type } = currentDeleteRecord; // Use currentDeleteRecord instead of currentEditRecord
    
    try {
        let error;
        
        if (type === 'contact' || type === 'business_cards') {
            // For business cards, delete from user_table_data (JSONB system)
            console.log('🗑️ Attempting to delete record with ID:', id);
            console.log('🗑️ For current user ID:', currentUser?.id);
            console.log('🗑️ ID type:', typeof id);
            
            const deleteResult = await supabase
                .from('user_table_data')
                .delete()
                .eq('id', id)
                .eq('user_id', currentUser?.id); // Additional security check
            error = deleteResult.error;
            
            if (error) {
                console.error('🚨 Supabase delete error:', error);
            } else {
                console.log('✅ Delete successful');
            }
        } else {
            // For invoices, use the old table structure
            const deleteResult = await supabase
                .from('invoices')
                .delete()
                .eq(primaryKeys['invoices'], id);
            error = deleteResult.error;
        }

        if (error) throw error;

        // Success - close modal and refresh data
        // Optimistic UI update: Find and remove the row from the table immediately
        const rowToRemove = document.querySelector(`button.delete-btn[data-id="${id}"]`)?.closest('tr');
        if (rowToRemove) {
            rowToRemove.style.transition = 'opacity 0.3s ease-out';
            rowToRemove.style.opacity = '0';
            setTimeout(() => rowToRemove.remove(), 300); // Remove after fade
        }

        closeDeleteModal();
        showNotification(`${type === 'contact' || type === 'business_cards' ? 'Business card' : 'Invoice'} deleted successfully!`, 'success');
        
        // Refresh dashboard stats (table refresh handled optimistically - UI already updated)
        fetchInitialDashboardData();
        
        return true; // Signal successful deletion

    } catch (error) {
        console.error('Error deleting record:', error);
        showNotification('Error deleting record. Please try again.', 'error');
        return false;
    }
}

// Attach handleDelete to window for global access
window.handleDelete = handleDelete;

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
        if (!currentUser?.id) {
            console.log('No user logged in, skipping dashboard data fetch');
            return;
        }

        // Call the new optimized RPC function to get all dashboard metrics in one call
        const { data: dashboardMetrics, error: metricsError } = await supabase
            .rpc('get_user_dashboard_metrics');

        if (metricsError) {
            throw metricsError;
        }

        // Extract metrics from the response (single row)
        const metrics = dashboardMetrics?.[0] || {
            total_documents_processed: 0,
            total_value_created: 0,
            total_hours_saved: 0,
            monthly_pages_processed: 0,
            monthly_pages_limit: 0,
            credits_remaining: 0
        };

        console.log('📊 Dashboard metrics received:', metrics);

        // Update the HTML elements with the fetched data
        document.getElementById('stat-docs-processed').textContent = metrics.total_documents_processed || 0;

        // Note: The "Accuracy Rate" is left as a static value for the MVP
        // as we don't have a column for this data yet.

        console.log(`✅ Dashboard loaded: ${metrics.total_documents_processed} documents, $${metrics.total_value_created} value, ${metrics.total_hours_saved}h saved`);

        // Update the dashboard value proposition section with cumulative metrics
        updateDashboardValueProposition(metrics.total_documents_processed, metrics);

        // Update the usage chart with current month's usage and plan limits
        updateUsageChartWithRealData(metrics);

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
            .select('id, user_id, data, created_at')
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
                    <td><input type="checkbox" class="select-row" data-id="${record.id}"></td>
                    <td>${contact.Name || 'N/A'}</td>
                    <td>${contact.Job_Title || 'N/A'}</td>
                    <td>${contact.Company || 'N/A'}</td>
                    <td>${contact.Phone || 'N/A'}</td>
                    <td>${contact.Email || 'N/A'}</td>
                    <td>${formatDate(record.created_at)}</td>
                    <td><span class="status-badge status-success">Processed</span></td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${record.id}" data-type="business_cards">✏️</button>
                        <button class="action-btn delete-btn" data-id="${record.id}" data-type="business_cards">🗑️</button>
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
        // Use existing invoice export (default to CSV)
        handleInvoiceExportFormat('csv');
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
    const signupForm = document.getElementById('signup-form-element');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSignUp();
        });
    }

    // Form switching
    const showSignup = document.getElementById('show-signup');
    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            showSignupForm();
        });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }

    // Google OAuth buttons
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleGoogleAuth();
        });
    }

    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleGoogleAuth();
        });
    }

    // Logout button (check both old and new structures)
    const logoutBtn = document.getElementById('logout-btn') || document.getElementById('dropdown-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
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
    if (quickActionExportInvoices) quickActionExportInvoices.addEventListener('click', () => handleInvoiceExportFormat('csv'));

    // Export VCF Button in table header
    const exportVcfBtn = document.getElementById('export-vcf-btn');
    if (exportVcfBtn) exportVcfBtn.addEventListener('click', exportContacts);

    // Export Invoices Button in table header (new standardized buttons)
    const exportInvoicesCsvBtn = document.getElementById('export-invoices-csv-btn');
    if (exportInvoicesCsvBtn) exportInvoicesCsvBtn.addEventListener('click', () => handleInvoiceExportFormat('csv'));
    
    const exportInvoicesPdfBtn = document.getElementById('export-invoices-pdf-btn');
    if (exportInvoicesPdfBtn) exportInvoicesPdfBtn.addEventListener('click', () => handleInvoiceExportFormat('pdf'));
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
    
    // Populate mobile navbar custom tables dropdown
    console.log('🚨 [Mobile Nav] About to call populateTablesDropdown from DOMContentLoaded');
    await populateTablesDropdown();
    console.log('🚨 [Mobile Nav] Finished calling populateTablesDropdown');
    
    // Debug navbar button visibility on page load
    setTimeout(() => {
        console.log('🚨 [Mobile Nav] Running navbar debug check after page load');
        debugMobileNavbar();
    }, 1000);

    // Initialize selectedFiles array and restore from sessionStorage
    window.selectedFiles = [];
    const savedFiles = sessionStorage.getItem('selectedFiles');
    if (savedFiles) {
        try {
            const fileMetadata = JSON.parse(savedFiles);
            console.log('📁 Restored file metadata from session:', fileMetadata);
            // Note: File objects can't be fully restored, but metadata is preserved
            // This prevents loss of file list on page reload
        } catch (e) {
            console.warn('Failed to parse saved files from sessionStorage:', e);
            sessionStorage.removeItem('selectedFiles');
        }
    }
    
    // Initialize rainbow text effect for "Scan the future"
    initializeRainbowText();
    
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
        
        // Handle QR code button fallback
        if (event.target.matches('#use-phone-camera') || event.target.closest('#use-phone-camera')) {
            console.log('🚨🚨🚨 DEBUG: Fallback handler - use-phone-camera button triggered');
            event.preventDefault();
            
            if (!FEATURE_FLAGS.ENABLE_QR_UPLOAD) {
                console.warn('⚠️ QR Upload is disabled by feature flag');
                return;
            }
            
            // Initialize cross-device uploader if not already done
            if (typeof crossDeviceUploader !== 'undefined' && crossDeviceUploader) {
                crossDeviceUploader.showQRView();
            } else {
                console.log('🚨🚨🚨 DEBUG: CrossDeviceUploader not available, initializing...');
                initializeCrossDeviceOnModalOpen();
                setTimeout(() => {
                    if (typeof crossDeviceUploader !== 'undefined' && crossDeviceUploader) {
                        crossDeviceUploader.showQRView();
                    }
                }, 100);
            }
            return;
        }
        
        // Handle per-table upload buttons
        const perTableBtn = event.target.closest('.upload-to-table-btn');
        if (perTableBtn) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - per-table upload button triggered');
            const tableKey = perTableBtn.dataset.table || 'unknown';
            console.log('🚨🚨🚨 DEBUG: Table key:', tableKey);
            event.preventDefault();
            await showUploadModal(tableKey);
            return;
        }
        
        // Handle generic custom table upload buttons
        if (event.target.matches('.generic-upload-to-table-btn') || event.target.closest('.generic-upload-to-table-btn')) {
            console.log('🚨🚨🚨 DEBUG: Delegated click - generic table upload button triggered');
            event.preventDefault();
            await showUploadModal(); // Will derive table from current page context
            return;
        }
        
        // Handle dashboard upload area button (div with child elements)
        if (event.target.matches('#upload-area-button') || event.target.closest('#upload-area-button')) {
            console.log('✅ Dashboard upload area button triggered');
            event.preventDefault();
            await showUploadModal(); // Will derive table from current page context
            return;
        }
        
        // Handle upload page button  
        if (event.target.matches('#upload-page-button') || event.target.closest('#upload-page-button')) {
            console.log('✅ Upload page button triggered');
            event.preventDefault();
            await showUploadModal(); // Will derive table from current page context
            return;
        }
    });
    
    // Make key functions globally available so HTML onclick can find them
    // This is a simpler fix than refactoring all the HTML right now
    window.exportContacts = exportContacts;
    window.downloadInvoices = downloadInvoices;
    window.handleInvoiceExportFormat = handleInvoiceExportFormat;
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
 * Fetch user's subscription data from API endpoint with enhanced credit tracking
 * @returns {Object|null} User subscription data or null if not found
 */
async function fetchUserSubscription() {
    if (!currentUser) {
        console.error('No user logged in');
        return null;
    }

    console.log('Fetching user subscription data for user:', currentUser.id);

    try {
        // Use direct Supabase call (removed API endpoint that was causing 404 errors)
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching subscription:', error);
            return null;
        }

        if (!data) {
            console.log('No subscription found, creating default free plan');
            return createDefaultFreeSubscription();
        }

        console.log('User subscription data loaded:', data.plan_type);
        return data;

    } catch (error) {
        console.error('Error fetching subscription from Supabase:', error);
        return createDefaultFreeSubscription();
    }
}

/**
 * Create a default free subscription for new users
 * @returns {Object} Default free subscription object
 */
function createDefaultFreeSubscription() {
    return {
        plan_type: 'free',
        plan_status: 'active',
        pages_limit: 20,
        pages_used: 0,
        trial_ends_at: null,
        price_amount: 0,
        currency: 'usd',
        created_at: new Date().toISOString()
    };
}

/**
 * Calculate current month usage for the user
 * Updated to use the same data source as the dashboard for consistency
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
        // Use the same RPC function that the dashboard uses for consistency
        const { data: dashboardMetrics, error } = await supabase
            .rpc('get_user_dashboard_metrics');

        if (error) {
            console.error('Error calculating usage from dashboard metrics:', error);
            return 0;
        }

        // Extract monthly pages processed from the response
        const metrics = dashboardMetrics?.[0] || {};
        const totalUsage = metrics.monthly_pages_processed || 0;

        console.log('Current month usage from dashboard metrics:', totalUsage, 'pages');
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
        
        // Update the billing usage chart with real metrics from RPC (moved earlier to prevent conflicts)
        const { data: dashboardMetrics, error: metricsError } = await supabase
            .rpc('get_user_dashboard_metrics');

        console.log('🔍 [Billing Debug] RPC call result:', { dashboardMetrics, metricsError });

        if (!metricsError && dashboardMetrics?.[0]) {
            console.log('✅ [Billing Debug] Updating billing page with real data:', dashboardMetrics[0]);
            updateUsageChartWithRealData(dashboardMetrics[0], 'billing');
        } else {
            console.error('❌ [Billing Debug] Could not load metrics for billing page:', metricsError);
        }

        // Update all other sections of the billing page (removed conflicting updateUsageDisplay)
        updateCurrentPlanDisplay(subscription);
        updateValueProposition(subscription, currentUsage);
        updatePlanComparison(subscription);
        updatePaymentMethod(subscription);
        
        console.log('Billing page populated successfully');
        
        // Initialize billing tabs after data is loaded
        initializeBillingTabs();
        
    } catch (error) {
        console.error('Error populating billing page:', error);
        showNotification('Could not load billing information.', 'error');
        // Hide loading states on error
        hideBillingLoadingStates();
    }
}

/**
 * Initialize billing tabs functionality
 */
function initializeBillingTabs() {
    const billingTabs = document.querySelectorAll('.billing-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // Add click event listeners to tabs
    billingTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            
            // Remove active class from all tabs and contents
            billingTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            if (tabType === 'monthly') {
                const monthlyContent = document.getElementById('monthly-plans');
                if (monthlyContent) {
                    monthlyContent.classList.add('active');
                    monthlyContent.style.display = 'block';
                }
            } else if (tabType === 'topup') {
                const topupContent = document.getElementById('topup-packages');
                if (topupContent) {
                    topupContent.classList.add('active');
                    topupContent.style.display = 'block';
                }
            }
        });
    });
    
    console.log('Billing tabs initialized successfully');
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
    
    if (subscription.plan_type === 'free') {
        if (planPrice) planPrice.textContent = 'Free Plan';
        if (planBillingCycle) {
            planBillingCycle.textContent = 'Forever free';
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
 * Update the usage display section with credit-based tracking
 * @param {Object} subscription - User subscription data
 * @param {number} currentUsage - Current month usage count
 */
function updateUsageDisplay(subscription, currentUsage) {
    // Use credits data if available, otherwise fall back to pages
    const creditsRemaining = subscription.credits_remaining || 0;
    const monthlyCredits = subscription.monthlyCredits || subscription.pages_limit || 20;
    const creditsUsed = monthlyCredits - creditsRemaining;
    const usagePercentage = monthlyCredits > 0 ? (creditsUsed / monthlyCredits) * 100 : 0;
    
    // Update plan info
    const planInfo = document.getElementById('billing-plan-info');
    if (planInfo) {
        const planNames = {
            'free': 'Free Plan',
            'starter': 'Basic Plan - 100 pages/month',
            'business': 'Vision Pro+ Plan - 500 pages/month',
            'enterprise': 'Vision Max Plan - 2000 pages/month',
            'pay_as_you_go': 'Credit Pack'
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
        usageText.textContent = `${creditsUsed.toLocaleString()} / ${monthlyCredits.toLocaleString()} credits used`;
    }
    
    // Update remaining text
    const remainingText = document.getElementById('billing-usage-remaining');
    if (remainingText) {
        const remainingPercentage = Math.max(0, 100 - usagePercentage);
        remainingText.textContent = `${remainingPercentage.toFixed(1)}% remaining`;
    }
    
    // Update credit summary cards
    const creditsRemainingEl = document.getElementById('credits-remaining');
    if (creditsRemainingEl) {
        creditsRemainingEl.textContent = creditsRemaining.toLocaleString();
    }
    
    const nextResetEl = document.getElementById('next-reset-date');
    if (nextResetEl) {
        if (subscription.nextBillingDate) {
            nextResetEl.textContent = subscription.nextBillingDate;
        } else if (subscription.plan_type === 'free') {
            nextResetEl.textContent = 'N/A';
        } else {
            nextResetEl.textContent = 'Never';
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
async function calculateTotalDocumentsProcessed() {
    try {
        if (!currentUser) {
            return 0;
        }

        // Use the same logic as in fetchDashboardStats
        const [contactsResult, invoicesResult] = await Promise.all([
            supabase.from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', 'b7e8c9d0-1234-5678-9abc-def012345678') // Business cards
                .eq('user_id', currentUser?.id),
            supabase.from('user_table_data')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', 'a1b2c3d4-1234-5678-9abc-def012345678') // Invoices
                .eq('user_id', currentUser?.id)
        ]);

        const contactsCount = contactsResult.count || 0;
        const invoicesCount = invoicesResult.count || 0;
        const totalDocs = contactsCount + invoicesCount;

        console.log(`Total documents processed: ${totalDocs} (${contactsCount} business cards + ${invoicesCount} invoices)`);
        return totalDocs;
    } catch (error) {
        console.error('Error calculating total documents:', error);
        return 0;
    }
}

async function updateBillingUsage(totalDocs = 0) {
    console.log('Updating billing usage chart with', totalDocs, 'documents processed');
    
    try {
        // Get current user's subscription info
        const subscription = await fetchUserSubscription();

        // Define plan limits (pages per month)
        const planLimits = {
            'Trial': 20,
            'Basic': 500,
            'Vision Pro+': 5000,
            'Vision Max': 25000
        };
        
        // Get plan name and limit
        let planName = 'Trial';
        let planLimit = planLimits['Trial'];
        
        if (subscription && subscription.plan_name) {
            planName = subscription.plan_name;
            planLimit = planLimits[planName] || planLimits['Trial'];
        }
        
        // Assuming each document equals roughly 1-2 pages (using average of 1.5)
        const estimatedPages = Math.round(totalDocs * 1.5);
        const usagePercentage = (estimatedPages / planLimit * 100);
        const remainingPercentage = Math.max(0, 100 - usagePercentage);
        
        // Update the billing page HTML elements
        const planInfoElement = document.getElementById('billing-plan-info');
        const usageFillElement = document.getElementById('billing-usage-fill');
        const usageTextElement = document.getElementById('billing-usage-text');
        const usageRemainingElement = document.getElementById('billing-usage-remaining');
        
        if (planInfoElement) {
            planInfoElement.textContent = `${planName} Plan - ${planLimit.toLocaleString()} pages/month`;
        }
        
        if (usageFillElement) {
            usageFillElement.style.width = Math.min(usagePercentage, 100) + '%';
        }
        
        if (usageTextElement) {
            usageTextElement.textContent = `${estimatedPages.toLocaleString()} / ${planLimit.toLocaleString()} pages used`;
        }
        
        if (usageRemainingElement) {
            usageRemainingElement.textContent = `${remainingPercentage.toFixed(1)}% remaining`;
        }
        
        console.log(`Billing usage updated: ${estimatedPages}/${planLimit} pages (${usagePercentage.toFixed(1)}%)`);
        
    } catch (error) {
        console.error('Error updating billing usage chart:', error);
        
        // Fallback to loading state - no hardcoded values
        const elements = {
            'billing-plan-info': 'Loading plan info...',
            'billing-usage-fill': '0%',
            'billing-usage-text': 'Loading usage data...',
            'billing-usage-remaining': 'Loading...'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'billing-usage-fill') {
                    element.style.width = value;
                } else {
                    element.textContent = value;
                }
            }
        });
    }
}

// New optimized function that uses real data from RPC
async function updateUsageChartWithRealData(metrics, context = 'dashboard') {
    console.log('Updating usage chart with real metrics:', metrics, 'for context:', context);

    try {
        const {
            monthly_pages_processed = 0,
            monthly_pages_limit = 0,
            credits_remaining = 0
        } = metrics;

        // Calculate usage percentage based on actual pages processed this month
        const usagePercentage = monthly_pages_limit > 0
            ? Math.min(100, (monthly_pages_processed / monthly_pages_limit) * 100)
            : 0;

        // Determine element IDs based on context (dashboard vs billing page)
        const elementIds = context === 'billing' ? {
            planInfo: 'billing-plan-info',
            usageFill: 'billing-usage-fill',
            usageStats: 'billing-usage-text',
            usageRemaining: 'billing-usage-remaining'
        } : {
            planInfo: 'current-plan-info',
            usageFill: 'usage-fill',
            usageStats: 'usage-stats-text',
            usageRemaining: 'usage-remaining'
        };

        // Update the HTML elements
        const planInfoElement = document.getElementById(elementIds.planInfo);
        const usageFillElement = document.getElementById(elementIds.usageFill);
        const usageStatsElement = document.getElementById(elementIds.usageStats);
        const usageRemainingElement = document.getElementById(elementIds.usageRemaining);

        if (planInfoElement) {
            if (context === 'billing') {
                // For billing page, show full plan name with limit
                const planName = monthly_pages_limit === 100 ? 'Starter Plan' :
                                monthly_pages_limit === 500 ? 'Vision Pro+ Plan' :
                                monthly_pages_limit === 2000 ? 'Vision Max Plan' :
                                monthly_pages_limit === 20 ? 'Trial Plan' : 'Unknown Plan';
                planInfoElement.textContent = `${planName} - ${monthly_pages_limit} pages/month`;
            } else {
                // For dashboard, show just the limit
                if (monthly_pages_limit > 0) {
                    planInfoElement.textContent = `${monthly_pages_limit} pages/month`;
                } else {
                    planInfoElement.textContent = 'No active plan';
                }
            }
        }

        if (usageFillElement) {
            usageFillElement.style.width = `${usagePercentage}%`;
        }

        if (usageStatsElement) {
            usageStatsElement.textContent = `${monthly_pages_processed} of ${monthly_pages_limit || 0} pages used`;
        }

        if (usageRemainingElement) {
            const remaining = Math.max(0, monthly_pages_limit - monthly_pages_processed);
            usageRemainingElement.textContent = `${remaining} pages remaining`;
        }

        // Update credits display for billing page
        if (context === 'billing') {
            const creditsRemainingEl = document.getElementById('credits-remaining');
            if (creditsRemainingEl) {
                creditsRemainingEl.textContent = credits_remaining.toLocaleString();
            }
        }

        console.log(`✅ [${context}] Usage chart updated: ${monthly_pages_processed}/${monthly_pages_limit} pages (${usagePercentage.toFixed(1)}%)`);
        if (context === 'billing') {
            console.log(`🔍 [Billing Debug] Updated elements:`, {
                planInfo: planInfoElement?.textContent,
                usageText: usageStatsElement?.textContent,
                usagePercentage: `${usagePercentage.toFixed(1)}%`,
                remaining: usageRemainingElement?.textContent,
                creditsRemaining: document.getElementById('credits-remaining')?.textContent
            });
        }

    } catch (error) {
        console.error(`❌ Error updating ${context} usage chart:`, error);
    }
}

// Keep the old function for backward compatibility
async function updateUsageChart(totalDocs = 0) {
    console.log('Updating usage chart with', totalDocs, 'documents processed');

    try {
        // Get current user's subscription info
        const subscription = await fetchUserSubscription();

        // Define plan limits (pages per month)
        const planLimits = {
            'Trial': 20,
            'Basic': 500,
            'Vision Pro+': 5000,
            'Vision Max': 25000
        };

        // Get plan name and limit
        let planName = 'Trial';
        let planLimit = planLimits['Trial'];

        if (subscription && subscription.plan_name) {
            planName = subscription.plan_name;
            planLimit = planLimits[planName] || planLimits['Trial'];
        }

        // Assuming each document equals roughly 1-2 pages (using average of 1.5)
        const estimatedPages = Math.round(totalDocs * 1.5);
        const usagePercentage = (estimatedPages / planLimit * 100);
        const remainingPercentage = Math.max(0, 100 - usagePercentage);

        // Update the HTML elements
        const planInfoElement = document.getElementById('current-plan-info');
        const usageFillElement = document.getElementById('usage-fill');
        const usageStatsElement = document.getElementById('usage-stats-text');
        const usageRemainingElement = document.getElementById('usage-remaining');
        
        if (planInfoElement) {
            planInfoElement.textContent = `${planName} Plan - ${planLimit.toLocaleString()} pages/month`;
        }
        
        if (usageFillElement) {
            usageFillElement.style.width = Math.min(usagePercentage, 100) + '%';
        }
        
        if (usageStatsElement) {
            usageStatsElement.textContent = `${estimatedPages.toLocaleString()} / ${planLimit.toLocaleString()} pages used`;
        }
        
        if (usageRemainingElement) {
            usageRemainingElement.textContent = `${remainingPercentage.toFixed(1)}% remaining`;
        }
        
        console.log(`Usage updated: ${estimatedPages}/${planLimit} pages (${usagePercentage.toFixed(1)}%)`);
        
    } catch (error) {
        console.error('Error updating usage chart:', error);
        
        // Fallback to loading state - no hardcoded values
        document.getElementById('current-plan-info').textContent = 'Loading plan info...';
        document.getElementById('usage-fill').style.width = '0%';
        document.getElementById('usage-stats-text').textContent = 'Loading usage data...';
        document.getElementById('usage-remaining').textContent = 'Loading...';
    }
}

async function updateDashboardValueProposition(documentsProcessed = 0, preCalculatedMetrics = null) {
    console.log('Updating dashboard value proposition...');
    
    try {
        // Get current user's document processing stats
        if (!currentUser) {
            console.log('No user logged in, skipping value proposition update');
            return;
        }

        let hoursSaved = 0;
        let valueSaved = 0;

        if (preCalculatedMetrics) {
            // ✅ PHASE 4: Use pre-calculated metrics from processing events ledger
            hoursSaved = parseFloat(preCalculatedMetrics.total_hours_saved) || 0;
            valueSaved = parseFloat(preCalculatedMetrics.total_value_created) || 0;
            
            console.log(`✅ Using cumulative metrics from processing events: ${hoursSaved}h saved, $${valueSaved} value created`);
        } else {
            // Fallback: Calculate from document count (legacy approach)
            console.log('⚠️ No pre-calculated metrics available, falling back to legacy calculation');
            const MINUTES_PER_DOC = 4;
            const HOURLY_RATE = 15; // Dashboard uses $15/hr vs billing uses $30/hr
            
            const totalDocs = documentsProcessed;
            const minutesSaved = totalDocs * MINUTES_PER_DOC;
            hoursSaved = Math.round(minutesSaved / 60 * 10) / 10; // Round to 1 decimal place
            valueSaved = Math.round((minutesSaved / 60) * HOURLY_RATE);
        }
        
        // Fetch user subscription data for ROI calculation
        const subscription = await fetchUserSubscription();

        if (!subscription) {
            console.log('No subscription data found, using default values for ROI calculation');
        }

        // Calculate ROI (Return on Investment) - This can exceed 100% based on cumulative value
        let roiPercentage = 0;
        if (subscription && subscription.price_amount > 0) {
            const monthlySubscriptionCost = subscription.price_amount / 100; // Convert cents to dollars
            
            // ROI based on total cumulative value created vs monthly cost
            if (monthlySubscriptionCost > 0) {
                roiPercentage = Math.round(((valueSaved - monthlySubscriptionCost) / monthlySubscriptionCost) * 100);
            }
        } else if (valueSaved > 0) {
            // For trial users or pay-as-you-go, show positive ROI if any value is created
            roiPercentage = 100;
        }

        // Update the dashboard elements
        updateDashboardValueElements(hoursSaved, valueSaved, roiPercentage);
        
        console.log(`Dashboard value proposition updated: ${hoursSaved}h, $${valueSaved}, ${roiPercentage}% ROI (can exceed 100%)`);

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
    if (subscription.plan_type === 'free' || subscription.plan_type === 'pay_as_you_go') {
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
 * Setup billing page event listeners with Stripe integration
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
        
        // Package upgrade buttons in billing section
        if (e.target.classList.contains('btn-pkg')) {
            e.preventDefault();
            const priceId = e.target.dataset.priceId;
            const planType = e.target.dataset.plan;
            if (priceId && planType) {
                handleStripeCheckout(priceId, planType);
            }
        }
    });
    
    // New upgrade plan button in current plan section
    const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', async () => {
            try {
                const userId = currentUser?.id;
                if (!userId) {
                    showNotification('Please log in to upgrade your plan', 'error');
                    return;
                }

                showNotification('Creating payment session...', 'info');

                // Call our API to create a checkout session
                const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        priceId: 'price_1S59leERMwo4L7iyIqBZXwkj', // Basic plan price ID
                        userId: userId,
                        planType: 'basic'
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to create checkout session');
                }

                const { url } = await response.json();
                window.open(url, '_blank');

            } catch (error) {
                console.error('Error creating checkout session:', error);
                showNotification('Failed to create payment session', 'error');
            }
        });
    }
    
    // New buy credits button in current plan section
    const buyCreditsBtn = document.getElementById('buy-credits-btn');
    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', () => {
            // Switch to credit packs tab and scroll to it
            const creditPacksTab = document.querySelector('[data-tab="credit-packs"]');
            const packagesSection = document.querySelector('.packages-section');
            
            if (creditPacksTab) {
                creditPacksTab.click(); // Switch to credit packs tab
            }
            
            if (packagesSection) {
                packagesSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
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
        free: {
            plan_type: 'free',
            plan_status: 'active',
            pages_limit: 20,
            pages_used: 8, // Some test usage
            trial_ends_at: null,
            price_amount: 0,
            currency: 'usd'
        },
        starter: {
            plan_type: 'starter',
            plan_status: 'active',
            pages_limit: 100,
            pages_used: 27, // Some test usage
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            price_amount: 1499, // $14.99 in cents
            currency: 'usd'
        },
        business: {
            plan_type: 'business',
            plan_status: 'active',
            pages_limit: 500,
            pages_used: 142, // Some test usage
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            price_amount: 4999, // $49.99 in cents
            currency: 'usd'
        },
        enterprise: {
            plan_type: 'enterprise',
            plan_status: 'active',
            pages_limit: 2000,
            pages_used: 387, // Some test usage
            billing_cycle_start: new Date().toISOString(),
            billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            price_amount: 12999, // $129.99 in cents
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
 * Updated to use the new event sourcing system for consistency with dashboard
 */
async function createTestUsage(pageCount = 25) {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    try {
        let successCount = 0;
        const now = new Date();

        // Create processing events using the new RPC function
        for (let i = 0; i < pageCount; i++) {
            const randomDaysAgo = Math.floor(Math.random() * 30);
            const processedAt = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));
            const documentType = Math.random() > 0.5 ? 'business_card' : 'invoice';

            // Use the new event sourcing RPC function
            const { error } = await supabase.rpc('add_processing_event', {
                p_user_id: currentUser.id,
                p_document_type: documentType,
                p_documents_processed_delta: 1,
                p_pages_processed_delta: 1,
                p_value_created_delta: documentType === 'business_card' ? 0.50 : 1.25,
                p_hours_saved_delta: documentType === 'business_card' ? 0.0167 : 0.0833,
                p_metadata: {
                    source: 'test_function',
                    processed_at: processedAt.toISOString()
                }
            });

            if (error) {
                console.error('Error creating processing event:', error);
                break;
            }
            successCount++;
        }

        if (successCount > 0) {
            console.log(`Created ${successCount} test processing events`);
            showNotification(`${successCount} test usage entries created! Refreshing billing page and dashboard...`, 'success');

            // Refresh both billing page and dashboard to show synchronized data
            setTimeout(async () => {
                await Promise.all([
                    populateBillingPage(),
                    fetchInitialDashboardData()
                ]);
            }, 1000);

            return true;
        } else {
            throw new Error('No test events were created successfully');
        }
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
 * Handle Stripe checkout for plan upgrades and credit purchases
 */
async function handleStripeCheckout(priceId, planType) {
    console.log('Creating Stripe checkout session for:', planType, 'with price ID:', priceId);

    const sessionData = await createCheckoutSession(priceId, planType);
    if (sessionData && sessionData.url) {
        showNotification('Redirecting to secure payment...', 'info');
        window.location.href = sessionData.url;
    }
}

/**
 * Handle plan upgrade (legacy function, now uses Stripe)
 */
function handlePlanUpgrade(planType) {
    console.log('Plan upgrade requested:', planType);
    // For now, redirect to pricing page which has proper Stripe integration
    window.location.href = './pricing.html';
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
            case 'pdf':
                exportToPDF(data, schema, tableName);
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
    console.log(`[DEBUG] getSelectedRowIds called for table: ${tableName}`);
    
    // Handle business cards with legacy checkbox system
    if (tableName === 'business_cards') {
        const selectedCheckboxes = document.querySelectorAll('.contact-row-checkbox:checked');
        console.log(`[DEBUG] Found ${selectedCheckboxes.length} selected business card checkboxes`);
        
        const ids = Array.from(selectedCheckboxes).map(checkbox => {
            const id = checkbox.getAttribute('data-id');
            console.log(`[DEBUG] Business card checkbox data-id:`, id);
            return id;
        }).filter(id => id && id !== 'undefined' && id !== 'null');
        console.log(`[DEBUG] Business cards selected IDs (filtered):`, ids);
        return ids;
    }
    
    const tableContainer = document.getElementById(`${tableName}-table-container`);
    console.log(`[DEBUG] Looking for container: ${tableName}-table-container, found:`, tableContainer);
    if (!tableContainer) return [];
    
    const selectedCheckboxes = tableContainer.querySelectorAll('.select-row:checked');
    console.log(`[DEBUG] Found ${selectedCheckboxes.length} selected custom table checkboxes`);
    
    const ids = Array.from(selectedCheckboxes).map(checkbox => {
        const id = checkbox.getAttribute('data-id');
        console.log(`[DEBUG] Custom table checkbox data-id:`, id);
        return id;
    });
    console.log(`[DEBUG] Custom table selected IDs:`, ids);
    return ids;
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
 * Export data to PDF format
 */
function exportToPDF(data, schema, tableName) {
    try {
        // Check if jsPDF is available
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showNotification('PDF library not loaded. Please try again.', 'error');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(20);
        doc.text(`${schema.displayName || tableName} Export`, 14, 22);
        
        // Add export date
        doc.setFontSize(10);
        doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 32);
        
        let yPosition = 50;
        const leftMargin = 14;
        const lineHeight = 8;
        
        // Process each record
        data.forEach((row, index) => {
            if (yPosition > 280) { // Start new page if needed
                doc.addPage();
                yPosition = 20;
            }
            
            // Add record header
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Record ${index + 1}:`, leftMargin, yPosition);
            yPosition += lineHeight + 2;
            
            // Add record fields
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            schema.fields.forEach(field => {
                if (yPosition > 280) { // Start new page if needed
                    doc.addPage();
                    yPosition = 20;
                }
                
                let value = '';
                if (schema.isJsonbTable) {
                    value = row.data[field.columnName] || '';
                } else {
                    value = row[field.columnName] || '';
                }
                
                // Convert value to string and limit length
                const stringValue = String(value).substring(0, 100);
                
                doc.text(`${field.displayName}: ${stringValue}`, leftMargin + 5, yPosition);
                yPosition += lineHeight;
            });
            
            // Add created date if available
            if (row.created_at) {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 20;
                }
                doc.text(`Date Added: ${new Date(row.created_at).toLocaleString()}`, leftMargin + 5, yPosition);
                yPosition += lineHeight;
            }
            
            yPosition += 5; // Space between records
        });
        
        // Save the PDF
        const filename = `${tableName}_export_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        showNotification(`${data.length} records exported to PDF successfully!`, 'success');
        
    } catch (error) {
        console.error('PDF export error:', error);
        showNotification('PDF export failed. Please try again.', 'error');
    }
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
    'user_tables': populateContactTable,
    'business_cards': populateContactTable,  // Add mapping for business_cards class name
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
        
        // Skip select-all checkboxes
        if (e.target.id && e.target.id.startsWith('select-all-')) {
            console.log('✅ Select-all checkbox ignored:', e.target.id);
            return;
        }
        
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

    // Add event listeners for row selection checkboxes
    mainContent.addEventListener('change', (e) => {
        if (e.target.classList.contains('select-row') && e.target.type === 'checkbox') {
            const itemId = e.target.getAttribute('data-id');
            const row = e.target.closest('tr');
            
            if (itemId && row) {
                // Determine table name from the closest table container
                const tableContainer = e.target.closest('[id$="-table-container"]');
                let tableName = null;
                
                if (tableContainer) {
                    const containerId = tableContainer.id;
                    tableName = containerId.replace('-table-container', '');
                } else {
                    // Fallback: try to find table name from data-type attributes
                    const editBtn = row.querySelector('.edit-btn, .delete-btn');
                    if (editBtn) {
                        tableName = editBtn.getAttribute('data-type');
                    }
                }
                
                if (tableName) {
                    console.log(`🔘 Checkbox changed for ${tableName}: ${itemId} = ${e.target.checked}`);
                    handleSelectionChange(tableName, itemId, e.target.checked);
                    
                    // Add/remove row highlighting
                    if (e.target.checked) {
                        row.classList.add('bulk-selected');
                    } else {
                        row.classList.remove('bulk-selected');
                    }
                }
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
    const fieldLabel = fieldData?.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '';
    const fieldType = fieldData?.type || fieldData?.dataType?.toLowerCase() || 'text';
    const isExistingField = !!fieldData; // Check if this is an existing field or new one

    console.log('🔍 DEBUG: Using fieldName:', fieldName, 'fieldLabel:', fieldLabel, 'fieldType:', fieldType);

    row.innerHTML = `
        <input type="hidden" class="field-name" value="${fieldName}">
        <input type="text" placeholder="Display Label" class="field-label" value="${fieldLabel}" required ${isExistingField ? 'data-original-name="' + fieldName + '"' : ''}>
        ${isExistingField ?
            `<small style="color: #6b7280; font-size: 0.75rem; margin-top: 2px;">Field: ${fieldName}</small>` :
            `<input type="text" placeholder="Field name (auto-generated)" class="field-name-input" value="${fieldName}" style="font-size: 0.9rem; color: #6b7280;">`
        }
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

    // Add event listener to auto-generate field name for new fields
    if (!isExistingField) {
        const labelInput = row.querySelector('.field-label');
        const nameInput = row.querySelector('.field-name-input');
        const hiddenNameInput = row.querySelector('.field-name');

        labelInput.addEventListener('input', function() {
            const label = this.value;
            const generatedName = label.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .replace(/^[^a-z]/, 'field_')
                .substring(0, 30);
            nameInput.value = generatedName;
            hiddenNameInput.value = generatedName;
        });

        nameInput.addEventListener('change', function() {
            hiddenNameInput.value = this.value;
        });
    }

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
 * Analyze field changes to determine what type of updates are needed
 */
function analyzeFieldChanges(oldFields, newFields) {
    const analysis = {
        isLabelOnlyChanges: false,
        hasStructuralChanges: false,
        hasFieldNameChanges: false,
        labelChanges: [],
        structuralChanges: []
    };

    // Create maps for easier comparison
    const oldFieldMap = new Map(oldFields.map(f => [f.name, f]));
    const newFieldMap = new Map(newFields.map(f => [f.name, f]));

    // Get field names
    const oldFieldNames = new Set(oldFields.map(f => f.name));
    const newFieldNames = new Set(newFields.map(f => f.name));

    // Check for structural changes (added or removed fields)
    const addedFields = newFields.filter(f => !oldFieldNames.has(f.name));
    const removedFields = oldFields.filter(f => !newFieldNames.has(f.name));

    if (addedFields.length > 0 || removedFields.length > 0) {
        analysis.hasStructuralChanges = true;
        analysis.structuralChanges.push(...addedFields.map(f => ({ type: 'added', field: f })));
        analysis.structuralChanges.push(...removedFields.map(f => ({ type: 'removed', field: f })));
    }

    // Check for field property changes (excluding label changes)
    const commonFields = newFields.filter(f => oldFieldNames.has(f.name));
    for (const newField of commonFields) {
        const oldField = oldFieldMap.get(newField.name);

        // Check if non-label properties changed
        if (oldField.type !== newField.type ||
            oldField.primary_key !== newField.primary_key ||
            oldField.order !== newField.order) {
            analysis.hasStructuralChanges = true;
            analysis.structuralChanges.push({ type: 'modified', field: newField, oldField });
        }

        // Check if label changed
        if (oldField.label !== newField.label) {
            analysis.labelChanges.push({
                fieldName: newField.name,
                oldLabel: oldField.label,
                newLabel: newField.label
            });
        }
    }

    // Determine if this is a label-only change
    analysis.isLabelOnlyChanges = analysis.labelChanges.length > 0 && !analysis.hasStructuralChanges;

    console.log('🔍 Field change analysis result:', {
        labelOnlyChanges: analysis.isLabelOnlyChanges,
        structuralChanges: analysis.hasStructuralChanges,
        labelChangesCount: analysis.labelChanges.length,
        structuralChangesCount: analysis.structuralChanges.length
    });

    return analysis;
}

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
            const hiddenNameInput = row.querySelector('.field-name');
            const labelInput = row.querySelector('.field-label');
            const nameInput = row.querySelector('.field-name-input'); // For new fields

            let name = hiddenNameInput ? hiddenNameInput.value.trim() : '';
            const label = labelInput ? labelInput.value.trim() : '';
            const type = row.querySelector('.column-type').value;
            const isPrimary = row.querySelector('.primary-key').checked;

            // For new fields, use the generated name from the visible input
            if (!name && nameInput) {
                name = nameInput.value.trim();
            }

            if (!label) {
                showNotification('All columns must have display labels', 'error');
                return;
            }

            if (!name) {
                showNotification('All columns must have valid field names', 'error');
                return;
            }

            if (!/^[a-z][a-z0-9_]*$/.test(name)) {
                showNotification('Field names must start with a letter and contain only lowercase letters, numbers, and underscores', 'error');
                return;
            }

            if (isPrimary) primaryKeyField = name;

            fields.push({
                name,
                label,
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
        
        // Get current schema to compare field changes
        const currentSchema = tableSchemas[currentEditingTable];
        const oldFields = currentSchema?.fields || [];

        console.log('🔍 Debugging field changes:');
        console.log('📋 Current schema fields:', oldFields.map(f => ({ name: f.name, label: f.label, order: f.order })));
        console.log('📋 New fields:', fields.map(f => ({ name: f.name, label: f.label, order: f.order })));

        // Analyze what type of changes we have
        const changeAnalysis = analyzeFieldChanges(oldFields, fields);
        console.log('🔍 Change analysis:', changeAnalysis);

        if (changeAnalysis.isLabelOnlyChanges) {
            console.log('📝 Detected label-only changes, using optimized update method');
            console.log('🚀 Using new update_schema_field_label RPC function - no data migration needed!');
            showNotification('Updating field labels...', 'info');

            // Get the table UUID
            const { data: tableInfo, error: tableInfoError } = await supabase
                .from('user_tables')
                .select('id')
                .eq('table_key', currentEditingTable)
                .eq('user_id', user.id)
                .maybeSingle();

            if (tableInfoError || !tableInfo) {
                console.error('Error fetching table info:', tableInfoError);
                showNotification('Failed to find table information', 'error');
                return;
            }

            // Update each field label using the new RPC function
            let allUpdatesSuccessful = true;
            for (const change of changeAnalysis.labelChanges) {
                console.log(`📝 Updating label for field "${change.fieldName}": "${change.oldLabel}" → "${change.newLabel}"`);

                try {
                    const { data: updateResult, error: updateError } = await supabase.rpc('update_schema_field_label', {
                        target_table_id: tableInfo.id,
                        target_field_name: change.fieldName,
                        new_label: change.newLabel
                    });

                    console.log(`🔍 RPC call result for field "${change.fieldName}":`, { updateResult, updateError });

                    if (updateError) {
                        console.error(`RPC error for field "${change.fieldName}":`, updateError);
                        showNotification(`Failed to update label for field "${change.fieldName}": ${updateError.message}`, 'error');
                        allUpdatesSuccessful = false;
                        break;
                    } else if (updateResult !== true) {
                        console.error(`RPC returned false for field "${change.fieldName}". This may indicate the field was not found or unauthorized access.`);
                        showNotification(`Failed to update label for field "${change.fieldName}": field not found or unauthorized`, 'error');
                        allUpdatesSuccessful = false;
                        break;
                    } else {
                        console.log(`✅ Successfully updated label for field "${change.fieldName}"`);
                    }
                } catch (rpcError) {
                    console.error(`Exception during RPC call for field "${change.fieldName}":`, rpcError);
                    showNotification(`Failed to update label for field "${change.fieldName}": ${rpcError.message}`, 'error');
                    allUpdatesSuccessful = false;
                    break;
                }
            }

            if (allUpdatesSuccessful) {
                showNotification('Field labels updated successfully!', 'success');
            } else {
                return; // Exit early if label updates failed
            }
        } else if (changeAnalysis.hasStructuralChanges) {
            console.log('🔧 Detected structural changes, using full schema update');
            showNotification('Updating table structure...', 'info');

            // For structural changes, we still need the original migration logic
            // but we'll simplify it since we're not doing field renames anymore
            if (changeAnalysis.hasFieldNameChanges) {
                showNotification('Field name changes detected. This may affect existing data.', 'warning');
            }
        } else {
            console.log('ℹ️ No significant changes detected');
        }

        // Update the table schema in Supabase
        // For label-only changes, we've already updated via RPC calls above
        let updateError = null;
        if (!changeAnalysis.isLabelOnlyChanges) {
            const { error } = await supabase
                .from('user_tables')
                .update({
                    name: newName,
                    schema_definition: fields
                })
                .eq('table_key', currentEditingTable)
                .eq('user_id', user.id);
            updateError = error;
        } else {
            // For label-only changes, we only update the table name if it changed
            const currentTableName = currentSchema?.name || '';
            if (newName !== currentTableName) {
                const { error } = await supabase
                    .from('user_tables')
                    .update({ name: newName })
                    .eq('table_key', currentEditingTable)
                    .eq('user_id', user.id);
                updateError = error;
            }
        }

        if (updateError) {
            console.error('Error updating table:', updateError);
            showNotification('Failed to update table', 'error');
        } else {
            if (!changeAnalysis.isLabelOnlyChanges) {
                showNotification('Table updated successfully!', 'success');
            }
            hideEditTableModal();

            // Reload table schemas and rebuild pages
            await loadTableSchemas();

            // Force refresh the current table to show updated data immediately
            console.log('🔄 Refreshing table data after schema update...');
            await populateGenericTable(currentEditingTable);

            // Also update navigation record count
            if (window.updateNavigationRecordCount) {
                await updateNavigationRecordCount(currentEditingTable);
            }

            console.log('✅ Table refresh completed after schema update');
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

// =================================================================================
// PACKAGES SECTION FUNCTIONALITY
// =================================================================================

/**
 * Initialize packages functionality
 */
function initializePackagesSection() {
    // Initialize package button handlers
    const packageButtons = document.querySelectorAll('.btn-pkg');
    packageButtons.forEach(button => {
        button.addEventListener('click', handlePackageSelection);
    });

    // Initialize tab switching
    const tabButtons = document.querySelectorAll('.plan-tab');
    tabButtons.forEach(tab => {
        tab.addEventListener('click', handleTabSwitch);
    });

    // Set initial active tab
    const firstTab = document.querySelector('.plan-tab');
    if (firstTab) {
        firstTab.click();
    }
}

/**
 * Handle tab switching between Subscriptions and Credit Packs
 */
function handleTabSwitch(event) {
    const clickedTab = event.target;
    const allTabs = document.querySelectorAll('.plan-tab');
    const subscriptions = document.getElementById('subscriptions');
    const creditPacks = document.getElementById('credit-packs');
    
    // Remove active class from all tabs
    allTabs.forEach(tab => tab.classList.remove('active'));
    
    // Add active class to clicked tab
    clickedTab.classList.add('active');
    
    // Show/hide containers based on tab
    if (clickedTab.textContent.includes('Subscriptions')) {
        subscriptions.style.display = 'grid';
        creditPacks.style.display = 'none';
    } else if (clickedTab.textContent.includes('Credit Packs')) {
        subscriptions.style.display = 'none';
        creditPacks.style.display = 'grid';
    }
}

/**
 * Handle package selection
 */
async function handlePackageSelection(event) {
    const button = event.target;
    const packageCard = button.closest('.package-card');
    const packageTitle = packageCard.querySelector('.package-card__title').textContent;
    const packagePrice = packageCard.querySelector('.package-card__price').textContent;

    // Check if button is disabled (current plan)
    if (button.disabled) {
        return;
    }

    try {
        // Show selection feedback
        showNotification(`Creating payment session for ${packageTitle} plan...`, 'info');

        // Map plan titles to price IDs and plan types
        let priceId, planType;
        const isSubscriptionTab = document.querySelector('.plan-tab.active')?.textContent === 'Subscriptions';

        if (isSubscriptionTab) {
            // Subscription plans
            switch (packageTitle.toLowerCase()) {
                case 'basic':
                    priceId = 'price_1S59leERMwo4L7iyIqBZXwkj'; // Basic monthly subscription
                    planType = 'basic';
                    break;
                case 'vision pro+':
                    priceId = 'price_1S59leERMwo4L7iyKqoKPlp2'; // Vision Pro+ monthly subscription
                    planType = 'vision_pro';
                    break;
                case 'vision max':
                    priceId = 'price_1S59leERMwo4L7iyUPrEiYsQ'; // Vision Max monthly subscription
                    planType = 'vision_max';
                    break;
                default:
                    priceId = 'price_1S59leERMwo4L7iyIqBZXwkj'; // Default to basic
                    planType = 'basic';
            }
        } else {
            // Credit packs - all use pay_as_you_go plan type but different credit amounts
            switch (packageTitle.toLowerCase()) {
                case 'quick scan':
                    priceId = 'price_1S8SP6ERMwo4L7iyCRXJY6jl'; // 50 credits
                    planType = 'credits';
                    break;
                case 'power pack':
                    priceId = 'price_1S8SRSERMwo4L7iy9OeaVIr3'; // 250 credits
                    planType = 'credits';
                    break;
                case 'professional':
                    priceId = 'price_1S8SRpERMwo4L7iyu230zcuA'; // 600 credits
                    planType = 'credits';
                    break;
                case 'enterprise':
                    priceId = 'price_1S8SSIERMwo4L7iykBOMIH4n'; // 1000 credits
                    planType = 'credits';
                    break;
                default:
                    priceId = 'price_1S8SP6ERMwo4L7iyCRXJY6jl'; // Default to quick scan (50 credits)
                    planType = 'credits';
            }
        }

        // Use unified checkout session creation
        const sessionData = await createCheckoutSession(priceId, planType);
        if (sessionData && sessionData.url) {
            window.open(sessionData.url, '_blank');
        }

        console.log('Package selected:', {
            plan: packageTitle,
            price: packagePrice,
            priceId: priceId,
            planType: planType,
            tab: document.querySelector('.plan-tab.active')?.textContent || 'Unknown'
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        showNotification('Failed to create payment session', 'error');
    }
}

/**
 * Initialize rainbow text effect for "Scan the future"
 */
function initializeRainbowText() {
    const target = document.querySelector('.packages-subtitle-neon');
    if (target) {
        const text = target.textContent.trim();
        target.innerHTML = ''; // Clear original text
        
        text.split('').forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.setProperty('--i', index);
            // Add space styling for actual space characters
            if (char === ' ') {
                span.style.marginRight = '0.25em';
            }
            target.appendChild(span);
        });
        
        console.log('🌈 Rainbow text initialized for "Scan the future"');
    }
}


/**
 * Camera functionality for upload modal
 */
class CameraUploader {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('capture-canvas');
        this.context = this.canvas?.getContext('2d');
        
        // UI elements
        this.uploadMethodSelection = document.getElementById('upload-method-selection');
        this.cameraView = document.getElementById('camera-view');
        this.cameraError = document.getElementById('camera-error');
        this.useDeviceCameraBtn = document.getElementById('use-device-camera');
        this.backToUploadBtn = document.getElementById('back-to-upload');
        this.capturePhotoBtn = document.getElementById('capture-photo');
    }

    bindEvents() {
        if (this.useDeviceCameraBtn) {
            this.useDeviceCameraBtn.addEventListener('click', () => this.showCameraView());
        }
        
        if (this.backToUploadBtn) {
            this.backToUploadBtn.addEventListener('click', () => this.hideCameraView());
        }
        
        if (this.capturePhotoBtn) {
            this.capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        }
    }

    // Check if camera is supported and available
    isCameraSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Get local camera device to avoid Phone Link interference
    async getLocalCameraDevice() {
        try {
            // First, we need to request permission to enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('📷 Available video devices:', videoDevices.map(d => ({
                id: d.deviceId,
                label: d.label,
                kind: d.kind
            })));

            // Look for local camera devices (avoid virtual or Phone Link cameras)
            const localCameras = videoDevices.filter(device => {
                const label = device.label.toLowerCase();
                // Filter out Phone Link and virtual cameras
                return !label.includes('phone') && 
                       !label.includes('virtual') && 
                       !label.includes('obs') &&
                       !label.includes('teams') &&
                       !label.includes('zoom') &&
                       !label.includes('skype') &&
                       device.deviceId !== 'default';
            });

            if (localCameras.length > 0) {
                // Prefer integrated cameras (usually built-in laptop cameras)
                const integratedCamera = localCameras.find(device => {
                    const label = device.label.toLowerCase();
                    return label.includes('integrated') || 
                           label.includes('built-in') || 
                           label.includes('internal') ||
                           label.includes('front') ||
                           label.includes('camera');
                });

                const selectedCamera = integratedCamera || localCameras[0];
                console.log('📷 Selected local camera:', selectedCamera.label);
                return selectedCamera.deviceId;
            }

            console.log('📷 No specific local camera found, using default');
            return null;
        } catch (error) {
            console.warn('📷 Could not enumerate devices:', error);
            return null;
        }
    }

    // Show camera view and request camera access
    async showCameraView() {
        if (!this.isCameraSupported()) {
            this.showError('Camera is not supported on this browser.');
            return;
        }

        try {
            // Hide upload method selection and show camera view
            this.uploadMethodSelection.style.display = 'none';
            this.cameraView.style.display = 'block';
            this.hideError();

            // --- START: MODIFIED CAMERA LOGIC ---

            // Define the ideal video constraints we want
            const videoConstraints = {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                aspectRatio: { ideal: 16/9 }
            };

            try {
                // First, specifically attempt to get the rear-facing (environment) camera.
                console.log('📷 Attempting to get rear camera (environment)...');
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        ...videoConstraints,
                        facingMode: { exact: 'environment' } // Use 'exact' for a stronger preference
                    }
                });
                console.log('✅ Successfully accessed rear camera.');
            } catch (error) {
                // If getting the rear camera fails (e.g., it doesn't exist or permission is denied for it),
                // fall back to requesting any available camera. This makes it work on desktops.
                console.warn(`⚠️ Rear camera failed with error: "${error.name}". Falling back to any available camera.`);
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints // No facingMode constraint, let the browser choose
                });
                console.log('✅ Fallback successful, accessed default camera.');
            }
            
            // --- END: MODIFIED CAMERA LOGIC ---

            this.video.srcObject = this.stream;
            
            console.log('📷 Camera access granted and stream is active.');
        } catch (error) {
            // This will catch any errors if both attempts fail.
            console.error('Error accessing camera after fallback:', error);
            this.handleCameraError(error);
        }
    }

    // Hide camera view and return to upload options
    hideCameraView() {
        this.stopCamera();
        this.cameraView.style.display = 'none';
        this.uploadMethodSelection.style.display = 'block';
        this.hideError();
    }

    // Stop camera stream and release resources
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
            if (this.video) {
                this.video.srcObject = null;
            }
            console.log('📷 Camera stopped');
        }
    }

    // Capture photo from video stream
    async capturePhoto() {
        if (!this.video || !this.canvas || !this.context) {
            console.error('Camera elements not properly initialized');
            return;
        }

        if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
            this.showError('Camera is not ready. Please wait a moment and try again.');
            return;
        }

        try {
            // IMPROVED CAMERA CAPTURE - Match preview to captured size
            if (FEATURE_FLAGS.NEW_CAMERA_CAPTURE) {
                // Get video dimensions (native resolution and CSS display size)
                const videoNativeWidth = this.video.videoWidth;
                const videoNativeHeight = this.video.videoHeight;
                const videoCSSWidth = this.video.clientWidth;
                const videoCSSHeight = this.video.clientHeight;
                
                console.log('📷 Video dimensions:', {
                    native: `${videoNativeWidth}x${videoNativeHeight}`,
                    css: `${videoCSSWidth}x${videoCSSHeight}`,
                    devicePixelRatio: window.devicePixelRatio
                });
                
                // Calculate aspect ratios
                const videoRatio = videoNativeWidth / videoNativeHeight;
                const targetRatio = videoCSSWidth / videoCSSHeight;
                
                // Set canvas to match CSS display size
                this.canvas.width = videoCSSWidth;
                this.canvas.height = videoCSSHeight;
                
                // Calculate source rectangle that matches what's visible in preview
                let sx = 0, sy = 0, sWidth = videoNativeWidth, sHeight = videoNativeHeight;
                
                if (videoRatio > targetRatio) {
                    // Video is wider than target, crop horizontally to match preview
                    sWidth = videoNativeHeight * targetRatio;
                    sx = (videoNativeWidth - sWidth) / 2;
                } else {
                    // Video is taller than target, crop vertically to match preview
                    sHeight = videoNativeWidth / targetRatio;
                    sy = (videoNativeHeight - sHeight) / 2;
                }
                
                // Draw the calculated sub-rectangle that matches the preview
                this.context.drawImage(
                    this.video,
                    sx, sy, sWidth, sHeight,  // Source rectangle (matches preview)
                    0, 0, this.canvas.width, this.canvas.height  // Destination
                );
                
                console.log('📷 Capture details:', {
                    sourceRect: `${sx}, ${sy}, ${sWidth}x${sHeight}`,
                    canvasSize: `${this.canvas.width}x${this.canvas.height}`
                });
                
            } else {
                // LEGACY CAPTURE METHOD (causes size mismatch)
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            }

            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                this.canvas.toBlob(resolve, 'image/jpeg', 0.9);
            });

            if (!blob) {
                throw new Error('Failed to capture image');
            }

            // Create a File object from the blob
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `camera-capture-${timestamp}.jpg`;
            const imageFile = new File([blob], fileName, { type: 'image/jpeg' });

            console.log('📷 Photo captured:', imageFile.name);

            // Add the captured file to the existing upload flow
            this.addCapturedFileToUpload(imageFile);

            // Return to upload view
            this.hideCameraView();

        } catch (error) {
            console.error('Error capturing photo:', error);
            this.showError('Failed to capture photo. Please try again.');
        }
    }

    // Add captured file to the existing upload system
    addCapturedFileToUpload(imageFile) {
        // This integrates with the existing file upload system
        // We'll add the file to the file list and trigger the preview
        const event = {
            target: {
                files: [imageFile]
            }
        };

        // Use existing file handling logic
        if (window.handleFileSelect) {
            window.handleFileSelect(event);
        } else {
            // Fallback: manually add to file preview
            this.addFileToPreview(imageFile);
        }
    }

    // Manual fallback to add file to preview list
    addFileToPreview(file) {
        const filePreviewList = document.getElementById('file-preview-list');
        if (!filePreviewList) return;

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="file-preview-item">
                <span class="material-icons">photo_camera</span>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB (Camera Capture)</div>
                </div>
                <button type="button" class="remove-file-btn" onclick="this.parentElement.parentElement.remove()">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;
        
        filePreviewList.appendChild(li);
        
        // Store the file for upload
        if (!window.selectedFiles) {
            window.selectedFiles = [];
        }
        window.selectedFiles.push(file);
    }

    // Handle different camera errors
    handleCameraError(error) {
        let errorMessage = 'Camera access failed. ';
        
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage += 'Please enable camera permissions for this site in your browser settings.';
                break;
            case 'NotFoundError':
                errorMessage += 'No camera was found on this device.';
                break;
            case 'NotReadableError':
                errorMessage += 'Camera is already being used by another application.';
                break;
            case 'OverconstrainedError':
                errorMessage += 'Camera does not meet the required specifications.';
                break;
            default:
                errorMessage += 'Please check your camera and try again.';
        }
        
        this.showError(errorMessage);
    }

    // Show error message
    showError(message) {
        if (this.cameraError) {
            this.cameraError.querySelector('p').textContent = message;
            this.cameraError.style.display = 'block';
        }
    }

    // Hide error message
    hideError() {
        if (this.cameraError) {
            this.cameraError.style.display = 'none';
        }
    }

    // Clean up when modal is closed
    destroy() {
        this.stopCamera();
        this.hideCameraView();
    }
}

// Initialize camera functionality
let cameraUploader = null;

// Initialize camera when upload modal is opened
function initializeCameraOnModalOpen() {
    if (!cameraUploader) {
        cameraUploader = new CameraUploader();
    }
    
    // Check camera support and show/hide button accordingly
    const useDeviceCameraBtn = document.getElementById('use-device-camera');
    if (useDeviceCameraBtn) {
        if (cameraUploader.isCameraSupported()) {
            useDeviceCameraBtn.style.display = 'flex';
        } else {
            useDeviceCameraBtn.style.display = 'none';
        }
    }
}

// Clean up camera when modal is closed
function cleanupCameraOnModalClose() {
    if (cameraUploader) {
        cameraUploader.destroy();
    }
}

// Cross-Device QR Code Upload System - DISABLED BY FEATURE FLAG
class CrossDeviceUploader {
    constructor() {
        // Runtime assertion - prevent construction when QR is disabled
        if (!FEATURE_FLAGS.ENABLE_QR_UPLOAD) {
            console.error('❌ QR Upload functionality is disabled by feature flag');
            throw new Error('QR Upload functionality is disabled by feature flag ENABLE_QR_UPLOAD');
        }
        this.currentSession = null;
        this.realtimeSubscription = null;
        this.pollingInterval = null;
        this.timerInterval = null;
        this.qrTimer = 300; // 5 minutes in seconds
        
        this.initializeElements();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.qrCodeView = document.getElementById('qr-code-view');
        this.qrCodeDisplay = document.getElementById('qr-code-display');
        this.qrLoading = document.getElementById('qr-loading');
        this.qrError = document.getElementById('qr-error');
        this.qrStatusText = document.getElementById('qr-status-text');
        this.statusDot = document.getElementById('status-dot');
        this.statusLabel = document.getElementById('status-label');
        this.qrTimerElement = document.getElementById('qr-timer');
        this.usePhoneCameraBtn = document.getElementById('use-phone-camera');
        this.backToUploadFromQrBtn = document.getElementById('back-to-upload-from-qr');
        this.refreshQrBtn = document.getElementById('refresh-qr');
        
        // Debug logging
        console.log('🚨🚨🚨 DEBUG: CrossDeviceUploader initializeElements()');
        console.log('🚨🚨🚨 DEBUG: use-phone-camera button found:', !!this.usePhoneCameraBtn);
        console.log('🚨🚨🚨 DEBUG: qr-code-view found:', !!this.qrCodeView);
    }
    
    setupEventListeners() {
        if (this.usePhoneCameraBtn) {
            this.usePhoneCameraBtn.addEventListener('click', () => this.showQRView());
        }
        
        if (this.backToUploadFromQrBtn) {
            this.backToUploadFromQrBtn.addEventListener('click', () => this.hideQRView());
        }
        
        if (this.refreshQrBtn) {
            this.refreshQrBtn.addEventListener('click', () => this.generateNewSession());
        }
        
        // Bind the keydown handler once for reuse
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        
        // Add backdrop click listener to modal
        const uploadModal = document.getElementById('upload-modal');
        if (uploadModal) {
            uploadModal.addEventListener('click', (e) => this.handleBackdropClick(e));
        }
    }
    
    async showQRView() {
        // Store the currently focused element to return to later
        this.previousFocusedElement = document.activeElement;
        
        // Hide upload method selection and show QR view
        const uploadMethodSelection = document.getElementById('upload-method-selection');
        if (uploadMethodSelection) {
            uploadMethodSelection.style.display = 'none';
        }
        
        if (this.qrCodeView) {
            this.qrCodeView.style.display = 'block';
            
            // Add event listeners when modal opens (scoped lifecycle)
            document.addEventListener('keydown', this.boundHandleKeyDown);
            
            // Set initial focus to the back button for accessibility
            const backButton = this.qrCodeView.querySelector('#back-to-upload-from-qr');
            if (backButton) {
                backButton.focus();
            }
        }
        
        // Generate new session
        await this.generateNewSession();
    }
    
    hideQRView() {
        // Show upload method selection and hide QR view
        const uploadMethodSelection = document.getElementById('upload-method-selection');
        if (uploadMethodSelection) {
            uploadMethodSelection.style.display = 'block';
        }
        
        if (this.qrCodeView) {
            this.qrCodeView.style.display = 'none';
        }
        
        // Remove event listeners when modal closes (scoped lifecycle)
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        
        // Return focus to the element that opened the QR view
        if (this.previousFocusedElement) {
            this.previousFocusedElement.focus();
            this.previousFocusedElement = null;
        }
        
        // Clean up current session (non-blocking)
        this.cleanupSession().catch(error => {
            console.warn('Background cleanup error:', error);
        });
    }
    
    // Event handler for keyboard interactions
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.hideQRView();
        } else if (e.key === 'Tab') {
            this.trapFocus(e);
        }
    }
    
    // Add cleanup method for event listeners
    destroy() {
        // Remove event listener if still attached
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        this.cleanupSession().catch(error => {
            console.warn('Background cleanup error:', error);
        });
    }
    
    trapFocus(e) {
        // Get all potentially focusable elements within the QR modal
        const focusableElements = this.qrCodeView.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        // Filter to only visible focusable elements
        const visibleFocusableElements = Array.from(focusableElements).filter(
            el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'
        );
        
        if (visibleFocusableElements.length === 0) return;
        
        const firstFocusable = visibleFocusableElements[0];
        const lastFocusable = visibleFocusableElements[visibleFocusableElements.length - 1];
        
        // If shift + tab pressed and we're on first focusable, go to last
        if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
        }
        // If tab pressed and we're on last focusable, go to first  
        else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
        }
    }
    
    // Add backdrop click handling to HTML (user will need to add data-backdrop-click to backdrop element)
    handleBackdropClick(e) {
        // Only close if clicking the backdrop itself, not child elements
        if (e.target.hasAttribute('data-backdrop-click')) {
            this.hideQRView();
        }
    }
    
    async generateNewSession() {
        try {
            // Show loading state
            this.showLoading();
            this.updateStatus('pending', 'Generating secure link...');
            
            // Reset timer
            this.qrTimer = 300; // 5 minutes
            
            // Verify user is authenticated
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            console.log('Auth check:', { user: user?.id, error: userError });
            
            if (!user) {
                throw new Error('Please sign in to use cross-device functionality');
            }
            
            // Also get the session to ensure we have a valid token
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Session check:', { hasSession: !!session, userId: user.id });
            
            // Create new session in database
            const { data, error } = await supabase
                .from('cross_device_sessions')
                .insert([
                    {
                        user_id: user.id, // Include user_id for RLS policy
                        status: 'pending',
                        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                    }
                ])
                .select()
                .single();
                
            if (error) {
                throw new Error(`Failed to create session: ${error.message}`);
            }
            
            this.currentSession = data;
            
            // Generate QR code with upload URL
            const uploadUrl = `${window.location.origin}/mobile-upload.html?session=${data.id}`;
            await this.generateQRCode(uploadUrl);
            
            // Start monitoring session
            this.startRealtimeMonitoring();
            this.startTimer();
            
            this.updateStatus('pending', 'Ready! Scan with your phone');
            
        } catch (error) {
            console.error('Failed to generate QR session:', error);
            this.showError('Failed to generate QR code. Please try again.');
        }
    }
    
    async generateQRCode(url) {
        try {
            // Use QR Code library (we'll need to include this in the HTML)
            // For now, we'll use a QR code service API
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
            
            const img = document.createElement('img');
            img.src = qrApiUrl;
            img.alt = 'QR Code for mobile upload';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            // Wait for image to load
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            // Clear loading and display QR code
            this.qrCodeDisplay.innerHTML = '';
            this.qrCodeDisplay.appendChild(img);
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            throw new Error('QR code generation failed');
        }
    }
    
    startRealtimeMonitoring() {
        if (!this.currentSession) return;
        
        console.log('🚨 DEBUG: Starting realtime monitoring for session:', this.currentSession.id);
        
        // Check authentication status
        supabase.auth.getSession().then(({data: {session}, error}) => {
            if (error) {
                console.error('🚨 DEBUG: Auth session error:', error);
            } else if (session) {
                console.log('✅ DEBUG: Authenticated session found:', session.user.id);
            } else {
                console.error('🚨 DEBUG: No authenticated session found!');
            }
        });
        
        // Set up Supabase Realtime subscription with unified event handler
        this.realtimeSubscription = supabase
            .channel('cross-device-sessions')
            .on('postgres_changes', {
                event: '*', // Listen to ALL events to avoid binding conflicts
                schema: 'public',
                table: 'cross_device_sessions',
                filter: `id=eq.${this.currentSession.id}`
            }, (payload) => {
                console.log('📡 REALTIME EVENT:', payload.eventType, payload);
                
                if (payload.eventType === 'UPDATE') {
                    console.log('✅ REALTIME UPDATE EVENT:', payload.new);
                    this.handleSessionUpdate(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    console.log('🗑️ REALTIME DELETE EVENT:', payload.old);
                    this.handleSessionDeletion(payload.old);
                } else {
                    console.log('ℹ️ REALTIME OTHER EVENT:', payload.eventType, payload);
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to realtime channel!');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('🚨 Realtime channel error:', err);
                    // Force unsubscribe on error to prevent orphaned channels
                    try {
                        this.realtimeSubscription?.unsubscribe({ reconnect: false });
                    } catch (unsubError) {
                        console.error('Failed to unsubscribe on error:', unsubError);
                    }
                } else {
                    console.log('🚨 DEBUG: Subscription status:', status, err);
                }
            });
            
        // Fallback polling mechanism
        this.pollingInterval = setInterval(() => {
            this.checkSessionStatus();
        }, 3000); // Poll every 3 seconds
    }
    
    async checkSessionStatus() {
        if (!this.currentSession) return;
        
        try {
            const { data, error } = await supabase
                .from('cross_device_sessions')
                .select('*')
                .eq('id', this.currentSession.id)
                .single();
                
            if (error) {
                // Check if error indicates session was deleted (row not found)
                if (error.code === 'PGRST116' || error.message?.includes('No rows returned')) {
                    console.log('🧹 Session deleted externally - cleaning up client via fallback polling');
                    this.handleSessionDeletion({ id: this.currentSession.id });
                    return;
                } else {
                    console.error('Failed to check session status:', error);
                    return;
                }
            }
            
            if (data) {
                this.handleSessionUpdate(data);
            }
        } catch (error) {
            console.error('Session status check error:', error);
        }
    }
    
    handleSessionUpdate(sessionData) {
        console.log('🚨 DEBUG: handleSessionUpdate called');
        console.log('🚨 DEBUG: sessionData:', sessionData);
        
        const oldStatus = this.currentSession?.status;
        console.log('🚨 DEBUG: oldStatus:', oldStatus, '-> newStatus:', sessionData.status);
        this.currentSession = sessionData;
        
        // Update UI based on status
        switch (sessionData.status) {
            case 'scanned':
                if (oldStatus !== 'scanned') {
                    this.updateStatus('scanned', 'QR Code scanned! Upload page opened on phone');
                }
                break;
                
            case 'uploaded':
                if (oldStatus !== 'uploaded') {
                    this.updateStatus('uploaded', 'File uploaded! Processing...');
                    this.handleUploadComplete();
                }
                break;
                
            case 'completed':
                if (oldStatus !== 'completed') {
                    this.updateStatus('completed', 'Upload completed successfully!');
                    this.handleUploadComplete();
                }
                break;
                
            case 'expired':
                this.updateStatus('expired', 'Session expired');
                this.cleanupSession().catch(error => {
                    console.warn('Background cleanup error:', error);
                });
                break;
        }
    }
    
    handleSessionDeletion(deletedSessionData) {
        console.log('🗑️ Session deleted via cleanup:', deletedSessionData?.id || 'unknown');
        console.log('🚨 DEBUG: handleSessionDeletion called with:', deletedSessionData);
        
        // Clear current session state completely
        this.currentSession = null;
        
        // Update UI to show session was cleaned up
        this.updateStatus('expired', 'Session deleted - files removed');
        
        // Clear any upload state/UI elements
        this.clearUploadUI();
        
        // Stop any ongoing operations
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        console.log('✅ Client-side cleanup completed after server deletion');
    }
    
    clearUploadUI() {
        // Clear file preview if exists
        const filePreview = document.getElementById('file-preview');
        if (filePreview) {
            filePreview.style.display = 'none';
            filePreview.innerHTML = '';
        }
        
        // Clear upload progress if exists
        const uploadProgress = document.getElementById('upload-progress');
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
            uploadProgress.innerHTML = '';
        }
        
        // Reset QR code display to initial state
        const qrContainer = document.getElementById('qr-code');
        if (qrContainer && this.qrCode) {
            qrContainer.innerHTML = '';
            this.generateQRCode(); // Regenerate fresh QR for new session
        }
    }
    
    async handleUploadComplete() {
        console.log('🚨 DEBUG: handleUploadComplete called');
        console.log('🚨 DEBUG: this context:', this);
        console.log('🚨 DEBUG: typeof this.addFileToPreview:', typeof this.addFileToPreview);
        
        if (!this.currentSession?.file_path) return;
        
        try {
            // Move file from temp storage to permanent storage
            console.log('🚨 DEBUG: Attempting to download file from path:', `'${this.currentSession.file_path}'`);
            console.log('🚨 DEBUG: File path length:', this.currentSession.file_path.length);
            console.log('🚨 DEBUG: Path should NOT contain bucket name. Contains "temp-uploads/"?', this.currentSession.file_path.includes('temp-uploads/'));
            console.log('🚨 DEBUG: Current session:', this.currentSession);
            
            // Download the temporary file
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('temp-uploads')
                .download(this.currentSession.file_path);
                
            if (downloadError) {
                console.error('Failed to download temp file:', downloadError);
                console.error('🚨 DEBUG: Full download error object:', JSON.stringify(downloadError, null, 2));
                return;
            }
            
            // Create File object from the downloaded data
            const file = new File([fileData], `mobile-upload-${Date.now()}.jpg`, {
                type: fileData.type || 'image/jpeg'
            });
            
            // Add to selected files for regular upload processing
            if (!window.selectedFiles) {
                window.selectedFiles = [];
            }
            window.selectedFiles.push(file);
            
            // Persist to sessionStorage to survive page reloads
            sessionStorage.setItem('selectedFiles', JSON.stringify(
                window.selectedFiles.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    lastModified: f.lastModified
                }))
            ));
            
            // Update file preview using main preview system
            console.log('🚨 DEBUG: About to call previewFiles');
            console.log('🚨 DEBUG: File details:', {name: file.name, size: file.size, type: file.type});
            console.log('🚨 DEBUG: window.selectedFiles length:', window.selectedFiles.length);
            previewFiles(); // Use main preview function that handles both sources
            console.log('🚨 DEBUG: previewFiles call completed');
            
            // Clean up temp file from storage
            const { error: deleteError } = await supabase.storage
                .from('temp-uploads')
                .remove([this.currentSession.file_path]);
                
            if (deleteError) {
                console.error('Failed to clean up temp file:', deleteError);
            } else {
                console.log('✅ Cleaned up temp file:', this.currentSession.file_path);
            }
            
            // Clean up session (non-blocking)
            this.cleanupSession().catch(error => {
                console.warn('Background cleanup error:', error);
            });
            
            // Return to upload view
            this.hideQRView();
            
            // Show success message
            alert('Photo received from phone successfully!');
            
        } catch (error) {
            console.error('Failed to process uploaded file:', error);
            
            // Still attempt cleanup even if processing failed
            try {
                const { error: deleteError } = await supabase.storage
                    .from('temp-uploads')
                    .remove([this.currentSession.file_path]);
                    
                if (deleteError) {
                    console.error('Failed to clean up temp file after error:', deleteError);
                }
            } catch (cleanupError) {
                console.error('Error during emergency cleanup:', cleanupError);
            }
        }
    }
    
    addFileToPreview(file) {
        const filePreviewList = document.getElementById('file-preview-list');
        if (!filePreviewList) return;
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="file-preview-item">
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB (Mobile Upload)</div>
                </div>
                <button type="button" class="remove-file-btn" onclick="this.parentElement.parentElement.remove()">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;
        
        filePreviewList.appendChild(li);
    }
    
    startTimer() {
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.qrTimer--;
            this.updateTimerDisplay();
            
            if (this.qrTimer <= 0) {
                this.handleSessionExpired();
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        if (!this.qrTimerElement) return;
        
        const minutes = Math.floor(this.qrTimer / 60);
        const seconds = this.qrTimer % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        this.qrTimerElement.textContent = display;
        
        // Update timer color based on remaining time
        const timerContainer = this.qrTimerElement.parentElement;
        if (this.qrTimer <= 60) {
            timerContainer.className = 'qr-timer danger';
        } else if (this.qrTimer <= 120) {
            timerContainer.className = 'qr-timer warning';
        } else {
            timerContainer.className = 'qr-timer';
        }
    }
    
    handleSessionExpired() {
        this.updateStatus('expired', 'Session expired. Generate a new QR code');
        this.cleanupSession().catch(error => {
            console.warn('Background cleanup error:', error);
        });
    }
    
    updateStatus(status, message) {
        if (this.qrStatusText) {
            this.qrStatusText.textContent = message;
        }
        
        if (this.statusDot) {
            this.statusDot.className = `status-dot ${status}`;
        }
        
        if (this.statusLabel) {
            this.statusLabel.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }
    
    showLoading() {
        if (this.qrLoading) {
            this.qrLoading.style.display = 'flex';
        }
        if (this.qrCodeDisplay) {
            this.qrCodeDisplay.innerHTML = '';
        }
        this.hideError();
    }
    
    hideLoading() {
        if (this.qrLoading) {
            this.qrLoading.style.display = 'none';
        }
    }
    
    showError(message) {
        if (this.qrError) {
            this.qrError.querySelector('p').textContent = message;
            this.qrError.style.display = 'block';
        }
        this.hideLoading();
    }
    
    hideError() {
        if (this.qrError) {
            this.qrError.style.display = 'none';
        }
    }
    
    async cleanupSession() {
        // Clear intervals
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Unsubscribe from realtime with enhanced error handling
        if (this.realtimeSubscription) {
            try {
                console.log('🔌 Unsubscribing from realtime channel');
                this.realtimeSubscription.unsubscribe({ reconnect: false });
                console.log('✅ Successfully unsubscribed from realtime channel');
            } catch (unsubError) {
                console.error('⚠️ Failed to unsubscribe from realtime channel:', unsubError);
            } finally {
                this.realtimeSubscription = null;
            }
        }
        
        // ✅ Phase 2: Server-side file cleanup integration with retry logic
        if (this.currentSession?.id) {
            const sessionId = this.currentSession.id;
            const maxRetries = 2;
            let attempts = 0;
            
            console.log(`🧹 CLEANUP START: Session ${sessionId}, Status: ${this.currentSession.status}`);
            
            const attemptCleanup = async () => {
                try {
                    attempts++;
                    console.log(`🧹 Cleanup attempt ${attempts}/${maxRetries + 1} for session: ${sessionId}`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                    
                    const response = await fetch(`${SUPABASE_URL}/functions/v1/cleanup-session-files`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ session_id: sessionId }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`✅ Server cleanup completed:`, result);
                        console.log(`📊 FILES DELETED: ${result.files_deleted}, ERRORS: ${result.errors}`);
                        return true; // Success
                    } else if (response.status >= 400 && response.status < 500) {
                        // Client error - don't retry
                        const error = await response.text();
                        console.warn(`⚠️ Server cleanup failed (${response.status}):`, error);
                        return true; // Don't retry client errors
                    } else {
                        // Server error - might retry
                        throw new Error(`Server error: ${response.status}`);
                    }
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.warn(`⏱️ Cleanup timeout (attempt ${attempts}):`, error);
                    } else {
                        console.warn(`🚨 Cleanup error (attempt ${attempts}):`, error);
                    }
                    
                    if (attempts <= maxRetries) {
                        // Exponential backoff: 500ms, 1000ms, 2000ms
                        const delay = 500 * Math.pow(2, attempts - 1);
                        console.log(`🔄 Retrying cleanup in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return attemptCleanup();
                    } else {
                        console.warn('🚨 All cleanup attempts failed - scheduled jobs will handle orphaned files');
                        return false;
                    }
                }
            };
            
            // Execute cleanup with retry logic (non-blocking)
            attemptCleanup().catch(error => {
                console.warn('🚨 Final cleanup error:', error);
            });
        }
        
        this.currentSession = null;
    }
    
    async destroy() {
        await this.cleanupSession();
        this.hideQRView();
    }
}

// Initialize cross-device uploader
let crossDeviceUploader = null;

// ✅ Phase 2: Browser unload cleanup handler
window.addEventListener('beforeunload', (event) => {
    if (crossDeviceUploader?.currentSession?.id) {
        try {
            // Attempt session deletion on browser close/navigate away
            // Note: This may not complete due to browser restrictions, but scheduled jobs will handle it
            const payload = new Blob([JSON.stringify({
                session_id: crossDeviceUploader.currentSession.id
            })], { type: 'application/json' });
            
            const success = navigator.sendBeacon(
                `${SUPABASE_URL}/functions/v1/cleanup-session-files`,
                payload
            );
            
            console.log(success ? 
                '🧹 Session deletion beacon sent successfully for session:' : 
                '⚠️ Session deletion beacon failed for session:', 
                crossDeviceUploader.currentSession.id
            );
        } catch (error) {
            console.warn('🚨 Beacon cleanup failed:', error);
            // Scheduled jobs will handle cleanup
        }
    }
});

// Initialize cross-device uploader when upload modal is opened
/**
 * Detect current table context from the active page
 * @returns {string|null} tableKey for current page or null if no specific context
 */
function getCurrentTableContext() {
    // Check if we're on a specific table page
    if (currentPage) {
        // Extract table name from page ID (e.g., 'page-business_cards' -> 'business_cards')
        const tableName = getTableNameFromPageId(currentPage);
        if (tableName && tableName !== 'dashboard' && tableName !== 'upload' && tableName !== 'create-table') {
            console.log(`✅ Detected table context: ${tableName}`);
            return tableName;
        }
    }
    
    console.log('⚠️ No specific table context detected');
    return null;
}

function initializeCrossDeviceOnModalOpen() {
    if (!crossDeviceUploader) {
        crossDeviceUploader = new CrossDeviceUploader();
    }
}

// Clean up cross-device uploader when modal is closed
function cleanupCrossDeviceOnModalClose() {
    if (crossDeviceUploader) {
        crossDeviceUploader.destroy();
    }
}

// ===== MOBILE NAVBAR CUSTOM TABLES DROPDOWN =====

/**
 * Fetches custom tables from Supabase database
 * @returns {Promise<Array<{table_key: string, display_name: string}>>}
 */
async function getCustomTables() {
    console.log('🔍 [Mobile Nav] Fetching custom tables from user_tables...');
    
    try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('🔍 [Mobile Nav] User not authenticated, skipping custom tables');
            return [];
        }

        // Fixed query to match actual user_tables schema
        const { data, error } = await supabase
            .from('user_tables')
            .select('table_key, name, schema_definition')
            .eq('user_id', user.id)  // Filter by current user
            .order('name', { ascending: true });

        if (error) {
            console.error('🔍 [Mobile Nav] Error fetching custom tables:', error);
            console.error('🔍 [Mobile Nav] Error details:', {
                code: error.code,
                message: error.message,
                details: error.details
            });
            
            // Check if the table exists
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                console.warn('🔍 [Mobile Nav] user_tables table does not exist - this is normal for new users');
            }
            
            return [];
        }

        console.log(`🔍 [Mobile Nav] Found ${data?.length || 0} custom tables:`, data);
        
        // Transform data to match expected format for backward compatibility
        const transformedData = data?.map(table => ({
            table_key: table.table_key,
            display_name: table.name,  // Map 'name' to 'display_name' for compatibility
            schema: table.schema_definition
        })) || [];
        
        return transformedData;
    } catch (error) {
        console.error('🔍 [Mobile Nav] Failed to fetch custom tables:', error);
        return [];
    }
}

/**
 * Populates both the mobile tables dropdown and bottom sheet with custom tables
 */
async function populateTablesDropdown() {
    console.log('🔍 [Mobile Nav] Starting populateTablesDropdown...');
    
    // Get containers for both old dropdown and new bottom sheet
    const dropdownContainer = document.getElementById('custom-tables-container');
    const bottomSheetContainer = document.querySelector('#custom-tables-sheet-section #custom-tables-container');
    const bottomSheetSection = document.getElementById('custom-tables-sheet-section');
    
    try {
        const customTables = await getCustomTables();
        console.log('🔍 [Mobile Nav] Custom tables retrieved:', customTables);

        if (customTables.length === 0) {
            console.log('🔍 [Mobile Nav] No custom tables to show');
            
            // Hide bottom sheet custom tables section
            if (bottomSheetSection) {
                bottomSheetSection.style.display = 'none';
            }
            
            // Clear old dropdown container if it exists
            if (dropdownContainer) {
                dropdownContainer.innerHTML = '';
            }
            
            return;
        }

        console.log('🔍 [Mobile Nav] Populating custom tables in both dropdown and bottom sheet...');

        // Show bottom sheet custom tables section
        if (bottomSheetSection) {
            bottomSheetSection.style.display = 'block';
        }

        // Populate old dropdown (for backward compatibility)
        if (dropdownContainer) {
            dropdownContainer.innerHTML = '';
            
            // Add divider before custom tables in dropdown
            const divider = document.createElement('div');
            divider.className = 'dropdown-divider';
            dropdownContainer.appendChild(divider);

            // Create dropdown items
            customTables.forEach(table => {
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'dropdown-item';
                // Use full table_key to ensure consistent navigation actions
                link.setAttribute('data-action', `navigate-to-${table.table_key}`);
                
                const icon = document.createElement('span');
                icon.className = 'material-icons';
                icon.textContent = 'table_chart';
                
                link.appendChild(icon);
                link.appendChild(document.createTextNode(' ' + table.display_name));
                
                dropdownContainer.appendChild(link);
            });
        }

        // Populate new bottom sheet
        if (bottomSheetContainer) {
            bottomSheetContainer.innerHTML = '';
            console.log(`🔍 [Mobile Nav] Adding ${customTables.length} custom tables to bottom sheet`);
            
            customTables.forEach((table, index) => {
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'sheet-item';
                // Use full table_key to ensure consistent navigation actions
                link.setAttribute('data-action', `navigate-to-${table.table_key}`);
                
                console.log(`🔍 [Mobile Nav] Creating link for table ${index + 1}:`, {
                    display_name: table.display_name,
                    table_key: table.table_key,
                    action: `navigate-to-${table.table_key}`
                });
                
                const icon = document.createElement('span');
                icon.className = 'material-icons';
                icon.textContent = 'table_chart';
                
                const text = document.createElement('span');
                text.textContent = table.display_name;
                
                link.appendChild(icon);
                link.appendChild(text);
                
                bottomSheetContainer.appendChild(link);
            });
            
            bottomSheetSection.style.display = 'block';
            console.log('🔍 [Mobile Nav] Custom tables bottom sheet populated successfully');
        } else {
            console.warn('🔍 [Mobile Nav] Bottom sheet container not found!');
        }

        console.log(`✅ [Mobile Nav] Added ${customTables.length} custom tables to both dropdown and bottom sheet`);
    } catch (error) {
        console.error('🔍 [Mobile Nav] Failed to populate custom tables:', error);
    }
}

// Expose function globally for use in other modules
window.populateTablesDropdown = populateTablesDropdown;

/**
 * Debug function to check mobile navbar button visibility
 */
function debugMobileNavbar() {
    const navbar = document.getElementById('mobile-bottom-nav');
    if (!navbar) {
        console.warn('🔍 [Mobile Nav Debug] Navbar not found');
        return;
    }

    const navItems = navbar.querySelectorAll('.nav-item');
    const visibleItems = Array.from(navItems).filter(item => {
        const styles = window.getComputedStyle(item);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
    });

    console.log(`🔍 [Mobile Nav Debug] Current page: ${currentPage || 'unknown'}`);
    console.log(`🔍 [Mobile Nav Debug] Total nav items: ${navItems.length}`);
    console.log(`🔍 [Mobile Nav Debug] Visible nav items: ${visibleItems.length}`);
    
    navItems.forEach((item, index) => {
        const styles = window.getComputedStyle(item);
        const label = item.querySelector('.nav-label')?.textContent || 'No label';
        const isVisible = styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
        console.log(`🔍 [Mobile Nav Debug] Item ${index + 1}: "${label}" - Visible: ${isVisible} - Display: ${styles.display}`);
    });
}

// Expose debug function globally
window.debugMobileNavbar = debugMobileNavbar;

// Credit System Functions
/**
 * Insert data into user_table_data with credit validation
 * @param {string} tableId - The table ID to insert data into
 * @param {object} rowData - The data to insert
 * @returns {Promise<{success: boolean, credits_remaining?: number, error?: string}>}
 */
async function insertUserTableRowWithCreditCheck(tableId, rowData) {
    try {
        const { data, error } = await supabase.rpc('insert_user_table_row_with_credit_check', {
            p_table_id: tableId,
            p_row_data: rowData
        });

        if (error) {
            console.error('Credit validation error:', error);
            
            if (error.message.includes('Insufficient credits')) {
                showCreditWarning(error.message);
                return { success: false, error: error.message };
            } else if (error.message.includes('No active subscription')) {
                showSubscriptionWarning();
                return { success: false, error: error.message };
            } else {
                showErrorMessage(`Failed to process document: ${error.message}`);
                return { success: false, error: error.message };
            }
        }

        // Success - update UI with new credit balance
        if (data?.credits_remaining !== undefined) {
            updateCreditsDisplay(data.credits_remaining);
        }

        console.log(`Document processed successfully. Credits remaining: ${data?.credits_remaining || 'unknown'}`);
        return { success: true, credits_remaining: data?.credits_remaining };

    } catch (error) {
        console.error('Unexpected error during credit check:', error);
        showErrorMessage(`Unexpected error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Show insufficient credits modal
 */
function showInsufficientCreditsModal() {
    const modal = document.getElementById('insufficient-credits-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Close insufficient credits modal
 */
function closeInsufficientCreditsModal() {
    const modal = document.getElementById('insufficient-credits-modal');
    if (modal) {
        console.log('🔍 Modal found, hiding it...');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';

        // Also remove any backdrop if it exists
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }

        console.log('🔍 Modal hidden successfully');
    } else {
        console.warn('🔍 Modal not found when trying to close');
    }
}

/**
 * Navigates to the billing page and activates a specific tab.
 * @param {string} tabId - The value of the data-tab attribute for the tab to activate ('subscriptions' or 'credit-packs').
 */
function navigateToBillingTab(tabId) {
    console.log(`🔍 navigateToBillingTab called with tabId: ${tabId}`);

    // 1. Close the "Insufficient Credits" modal
    console.log('🔍 Closing insufficient credits modal...');
    closeInsufficientCreditsModal();

    // 2. Close the upload modal if it's open
    console.log('🔍 Closing upload modal if open...');
    if (uploadModal && uploadModal.style.display !== 'none') {
        closeUploadModal();
    }

    // 3. Update navigation highlighting - remove active from all nav items
    console.log('🔍 Updating navigation highlighting...');
    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(item => item.classList.remove('active'));

    // 4. Add active class to billing nav item
    const billingNavItem = document.querySelector('[data-page-id="page-billing"]');
    if (billingNavItem) {
        billingNavItem.classList.add('active');
        console.log('🔍 Added active class to billing nav item');
    } else {
        console.warn('🔍 Billing nav item not found');
    }

    // 5. Switch to the billing page using the existing function
    console.log('🔍 Switching to billing page...');
    showPage('page-billing');

    // 6. Wait a bit for the page to load, then find and click the target tab
    setTimeout(() => {
        console.log(`🔍 Looking for tab with data-tab="${tabId}"`);
        const tabElement = document.querySelector(`[data-tab="${tabId}"]`);
        if (tabElement) {
            console.log(`🔍 Found tab element, clicking it...`);
            tabElement.click();
        } else {
            console.warn(`🔍 Billing tab with data-tab="${tabId}" not found.`);
        }
    }, 100);
}

/**
 * Show credit warning modal when insufficient credits (legacy function - now uses new modal)
 */
function showCreditWarning(message) {
    showInsufficientCreditsModal();
}

/**
 * Show subscription warning when no active subscription
 */
function showSubscriptionWarning() {
    // Remove existing modal if present
    const existingModal = document.getElementById('subscription-warning-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'subscription-warning-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3 style="color: #dc2626;">🔒 Subscription Required</h3>
                <button class="close-btn" onclick="closeSubscriptionWarning()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px;">
                    You need an active subscription to process documents.
                </p>
                <p style="color: #6b7280; font-size: 14px;">
                    Choose from our flexible plans starting at just $14.99/month with 100 processing credits included.
                </p>
            </div>
            <div class="modal-footer" style="gap: 12px;">
                <a href="./pricing.html" class="btn btn-primary" style="text-decoration: none;">
                    <span class="material-icons" style="font-size: 1rem; margin-right: 6px;">shopping_cart</span>
                    Choose Plan
                </a>
                <button class="btn btn-secondary" onclick="closeSubscriptionWarning()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Close credit warning modal
 */
function closeCreditWarning() {
    const modal = document.getElementById('credit-warning-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Close subscription warning modal
 */
function closeSubscriptionWarning() {
    const modal = document.getElementById('subscription-warning-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Update credits display in the UI
 */
function updateCreditsDisplay(creditsRemaining) {
    // Update credits display in various places
    const creditElements = document.querySelectorAll('[data-credits-display]');
    creditElements.forEach(element => {
        element.textContent = creditsRemaining;
    });

    // Update progress bars if they exist
    const progressBars = document.querySelectorAll('[data-credits-progress]');
    progressBars.forEach(bar => {
        const maxCredits = parseInt(bar.dataset.maxCredits) || 100;
        const percentage = Math.max(0, (creditsRemaining / maxCredits) * 100);
        bar.style.width = `${percentage}%`;
    });

    // Show warning if credits are low
    if (creditsRemaining <= 5) {
        showLowCreditsNotification(creditsRemaining);
    }
}

/**
 * Show low credits notification
 */
function showLowCreditsNotification(creditsRemaining) {
    const message = creditsRemaining === 0 
        ? 'You have no credits remaining!'
        : `Low credits warning: Only ${creditsRemaining} credits remaining.`;
    
    showNotification(message, 'warning', 5000);
}

// Expose credit functions globally
window.insertUserTableRowWithCreditCheck = insertUserTableRowWithCreditCheck;
window.showCreditWarning = showCreditWarning;
window.showSubscriptionWarning = showSubscriptionWarning;
window.closeCreditWarning = closeCreditWarning;
window.closeSubscriptionWarning = closeSubscriptionWarning;
window.updateCreditsDisplay = updateCreditsDisplay;

