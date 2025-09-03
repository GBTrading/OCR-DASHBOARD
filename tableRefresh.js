// Auto-refresh functionality for tables after CRUD operations
// This module provides functions to refresh tables while preserving user filters

/**
 * Get current filters for any table based on table name/type
 * @param {string} tableIdentifier - Table name or type (e.g., 'business_cards', 'invoices', 'contacts')
 * @returns {Object} Current filter state
 */
function getCurrentFilters(tableIdentifier) {
    const filters = {};
    
    // Map table types to their CSS class patterns
    const tableClassMap = {
        'business_cards': 'business_cards',
        'contact': 'business_cards',  // business cards use 'contact' as data-type
        'invoices': 'invoices',
        'invoice': 'invoices'         // invoices use 'invoice' as data-type
    };
    
    const className = tableClassMap[tableIdentifier] || tableIdentifier;
    
    // Get search input
    const searchInput = document.querySelector(`.${className}-search`);
    const searchTerm = searchInput?.value?.trim() || '';
    
    // Get date range input
    const dateRangeInput = document.querySelector(`.${className}-date-range`);
    const selectedDates = dateRangeInput?._flatpickr?.selectedDates || [];
    
    // Only add filters that have actual values
    if (searchTerm) {
        filters.searchTerm = searchTerm;
    }
    
    if (selectedDates.length > 0) {
        if (selectedDates.length === 1) {
            // Single date selection
            const date = new Date(selectedDates[0]);
            filters.startDate = new Date(date.setHours(0, 0, 0, 0)).toISOString();
            filters.endDate = new Date(date.setHours(23, 59, 59, 999)).toISOString();
        } else if (selectedDates.length === 2) {
            // Date range selection
            const startDate = new Date(selectedDates[0]);
            const endDate = new Date(selectedDates[1]);
            filters.startDate = new Date(startDate.setHours(0, 0, 0, 0)).toISOString();
            filters.endDate = new Date(endDate.setHours(23, 59, 59, 999)).toISOString();
        }
    }
    
    return filters;
}

/**
 * Table refresher mapping - connects data-type to refresh functions
 */
const tableRefreshers = {
    'contact': () => {
        const filters = getCurrentFilters('business_cards');
        return window.populateContactTable(filters);
    },
    'business_cards': () => {
        const filters = getCurrentFilters('business_cards');
        return window.populateContactTable(filters);
    },
    'invoice': () => {
        const filters = getCurrentFilters('invoices');
        return window.populateInvoiceTable(filters);
    },
    'invoices': () => {
        const filters = getCurrentFilters('invoices');
        return window.populateInvoiceTable(filters);
    }
};

/**
 * Refresh table after successful CRUD operation
 * @param {string} type - Table type from data-type attribute
 * @param {string} tableName - Table name (for generic tables)
 */
async function refreshTable(type, tableName = null) {
    try {
        const refreshFn = tableRefreshers[type];
        
        if (refreshFn) {
            console.log(`🔄 Refreshing table of type: ${type}${tableName ? ` (${tableName})` : ''}`);
            await refreshFn(tableName);
            console.log(`✅ Table refreshed successfully`);
        } else if (type && type.startsWith('custom_')) {
            // Handle custom tables using the generic table populate function
            console.log(`🔄 Refreshing custom table: ${type}`);
            const filters = getCurrentFilters(type);
            await window.populateGenericTable(type, filters);
            console.log(`✅ Custom table refreshed successfully`);
        } else {
            console.warn(`⚠️ No refresh function found for type: "${type}"`);
        }
    } catch (error) {
        console.error('❌ Failed to refresh table:', error);
        // Don't throw - we don't want refresh failures to break the user flow
    }
}

/**
 * Enhanced delete handler that includes auto-refresh
 * Call this after successful delete operations
 */
async function handleDeleteWithRefresh() {
    const { id, type, tableName } = window.currentDeleteRecord || {};
    
    if (!id || !type) {
        console.error('❌ Delete context is missing');
        return false;
    }
    
    try {
        // Call the existing delete function (handleGenericDelete or handleDelete)
        let deleteSuccess = false;
        
        if (window.tableSchemas && window.tableSchemas[type]) {
            // Use generic delete for custom tables
            deleteSuccess = await window.handleGenericDelete();
        } else {
            // Use legacy delete for built-in tables
            deleteSuccess = await window.handleDelete();
        }
        
        // If delete was successful, the UI has already been updated optimistically
        // No need to refresh the table since the row was removed immediately
        if (deleteSuccess !== false) {
            // await refreshTable(type, tableName); // REMOVED: Optimistic update handles UI changes
            console.log(`✅ Delete completed with optimistic UI update for type: ${type}`);
        }
        
        return deleteSuccess;
        
    } catch (error) {
        console.error('❌ Delete operation failed:', error);
        return false;
    }
}

/**
 * Enhanced edit handler that includes auto-refresh  
 * Call this after successful edit operations
 */
async function handleEditWithRefresh(type, tableName = null) {
    try {
        // Refresh the table to show updated data
        await refreshTable(type, tableName);
        
        // Close the edit modal
        const editModal = document.getElementById('edit-modal');
        if (editModal) {
            editModal.style.display = 'none';
        }
        
        console.log(`✅ Edit completed and table refreshed for type: ${type}`);
        
    } catch (error) {
        console.error('❌ Failed to refresh table after edit:', error);
    }
}

// Export functions for use in other modules
window.refreshTable = refreshTable;
window.handleDeleteWithRefresh = handleDeleteWithRefresh;
window.handleEditWithRefresh = handleEditWithRefresh;
window.getCurrentFilters = getCurrentFilters;

export { refreshTable, handleDeleteWithRefresh, handleEditWithRefresh, getCurrentFilters };