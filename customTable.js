// =================================================================================
// CUSTOM TABLE CREATION FUNCTIONALITY
// =================================================================================

import { supabase } from './supabaseClient.js';

// Global variables
let fieldCounter = 0;

// Reserved SQL words that need special handling
const RESERVED_SQL_WORDS = new Set([
    'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'table', 
    'index', 'view', 'database', 'schema', 'column', 'primary', 'foreign', 'key', 'constraint',
    'not', 'null', 'default', 'unique', 'check', 'references', 'on', 'cascade', 'restrict',
    'set', 'action', 'match', 'full', 'partial', 'simple', 'grant', 'revoke', 'commit', 
    'rollback', 'savepoint', 'transaction', 'begin', 'end', 'declare', 'cursor', 'fetch',
    'close', 'open', 'user', 'group', 'role', 'order', 'by', 'group', 'having', 'distinct',
    'union', 'intersect', 'except', 'join', 'inner', 'outer', 'left', 'right', 'full',
    'cross', 'natural', 'using', 'as', 'case', 'when', 'then', 'else', 'if', 'exists',
    'between', 'like', 'ilike', 'similar', 'in', 'any', 'some', 'all', 'and', 'or',
    'type', 'cast', 'extract', 'interval', 'timestamp', 'date', 'time', 'year', 'month',
    'day', 'hour', 'minute', 'second', 'timezone'
]);

/**
 * Normalize column name from display name to database-safe system name
 * @param {string} displayName - User-friendly column name
 * @param {Set} existingNames - Set of existing system names to avoid duplicates
 * @returns {string} Database-safe system name
 */
function normalizeColumnName(displayName, existingNames = new Set()) {
    if (!displayName || typeof displayName !== 'string') {
        return 'unnamed_field';
    }

    let normalized = displayName
        .trim()
        .toLowerCase()
        // Handle international characters by removing diacritics and converting to ASCII
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        // Convert common international characters to ASCII equivalents
        .replace(/[àáâãäåæ]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõöø]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ýÿ]/g, 'y')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[ß]/g, 'ss')
        .replace(/[œ]/g, 'oe')
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^a-z0-9_]/g, '') // Remove special characters
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores

    // Handle empty result after normalization
    if (!normalized) {
        normalized = 'unnamed_field';
    }

    // Ensure it starts with a letter
    if (!/^[a-z]/.test(normalized)) {
        normalized = `col_${normalized}`;
    }

    // Handle reserved SQL words
    if (RESERVED_SQL_WORDS.has(normalized)) {
        normalized = `${normalized}_col`;
    }

    // Truncate to PostgreSQL limit (63 characters)
    if (normalized.length > 63) {
        normalized = normalized.substring(0, 60) + '_tr'; // _tr for truncated
    }

    // Handle duplicates
    let finalName = normalized;
    let counter = 1;
    while (existingNames.has(finalName)) {
        const suffix = `_${counter}`;
        const maxLength = 63 - suffix.length;
        finalName = normalized.substring(0, maxLength) + suffix;
        counter++;
    }

    return finalName;
}

/**
 * Initialize the create table page functionality
 */
export function initializeCreateTablePage() {
    // Add initial field
    addFieldRow();
    
    // Event listeners
    setupCreateTableEventListeners();
}

/**
 * Setup all event listeners for the create table page
 */
function setupCreateTableEventListeners() {
    const addFieldBtn = document.getElementById('add-field-btn');
    const createTableForm = document.getElementById('create-table-form');
    const cancelBtn = document.getElementById('cancel-table-creation');
    
    if (addFieldBtn) {
        addFieldBtn.addEventListener('click', addFieldRow);
    }
    
    if (createTableForm) {
        createTableForm.addEventListener('submit', handleCreateTable);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            // Go back to dashboard
            showPage('page-dashboard');
        });
    }
}

/**
 * Add a new field row to the form
 */
function addFieldRow() {
    fieldCounter++;
    const fieldsContainer = document.getElementById('fields-container');
    
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.dataset.fieldId = fieldCounter;
    
    fieldRow.innerHTML = `
        <div class="field-input-group">
            <label>Field Name *</label>
            <input type="text" class="field-input field-display-name" placeholder="e.g., Customer Name" required>
            <div class="system-name-preview">
                <small>Database name: <span class="field-system-name">customer_name</span></small>
            </div>
            <input type="hidden" class="field-name" value="">
        </div>
        
        
        
        <button type="button" class="remove-field-btn" onclick="removeFieldRow(${fieldCounter})">
            Remove
        </button>
    `;
    
    fieldsContainer.appendChild(fieldRow);
    
    
    // Add event listener for auto-normalization
    const displayNameInput = fieldRow.querySelector('.field-display-name');
    const systemNameSpan = fieldRow.querySelector('.field-system-name');
    const hiddenSystemNameInput = fieldRow.querySelector('.field-name');
    
    displayNameInput.addEventListener('input', function() {
        const displayName = this.value;
        const existingNames = new Set();
        
        // Collect existing system names
        document.querySelectorAll('.field-name').forEach(input => {
            if (input.value && input !== hiddenSystemNameInput) {
                existingNames.add(input.value);
            }
        });
        
        const systemName = normalizeColumnName(displayName, existingNames);
        systemNameSpan.textContent = systemName || 'field_name';
        hiddenSystemNameInput.value = systemName;
    });
}

/**
 * Remove a field row from the form
 */
window.removeFieldRow = function(fieldId) {
    const fieldRow = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (fieldRow) {
        fieldRow.remove();
    }
    
    // Prevent having no fields
    const remainingFields = document.querySelectorAll('.field-row');
    if (remainingFields.length === 0) {
        addFieldRow();
    }
};

/**
 * Handle the form submission to create a custom table
 */
async function handleCreateTable(event) {
    event.preventDefault();
    
    // Get submit button and show loading state
    const submitButton = document.getElementById('create-table-btn');
    const originalButtonText = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="loading-spinner"></span> Creating Table...';
    }
    
    // Clear any previous errors
    clearFormErrors();
    
    // Get form data
    const displayName = document.getElementById('table-display-name').value.trim();
    const typeName = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    // Validate display name
    if (!displayName) {
        showFieldError('table-display-name', 'Display name is required');
        return;
    }
    
    // Get field definitions
    const fieldRows = document.querySelectorAll('.field-row');
    const fields = [];
    const fieldNames = new Set();
    
    // Validate fields
    for (let i = 0; i < fieldRows.length; i++) {
        const row = fieldRows[i];
        const fieldName = row.querySelector('.field-name').value.trim();
        const fieldType = 'TEXT'; // Auto-default all fields to TEXT type
        
        const displayName = row.querySelector('.field-display-name').value.trim();
        
        // Validate display name
        if (!displayName) {
            showFieldError(row.querySelector('.field-display-name'), 'Field name is required');
            return;
        }
        
        // Get the auto-generated system name
        const systemName = fieldName || normalizeColumnName(displayName, fieldNames);
        
        // Check for duplicate system names
        if (fieldNames.has(systemName)) {
            showFieldError(row.querySelector('.field-display-name'), 'This field name conflicts with an existing field');
            return;
        }
        
        fieldNames.add(systemName);
        
        fields.push({
            column_name: systemName,
            display_name: displayName,
            data_type: fieldType,
            order: i,
            primary_key: false // No user-selected primary keys
        });
    }
    
    // Auto-inject UUID primary key at the beginning
    fields.unshift({
        column_name: 'id',
        display_name: 'ID',
        data_type: 'UUID',
        order: -1,
        primary_key: true,
        hidden: true // Hide from default display
    });
    
    // Show loading state
    const submitBtn = document.getElementById('save-table-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons" style="font-size: 1rem; margin-right: 8px;">hourglass_empty</span>Creating...';
    
    try {
        // Create JSONB schema definition
        const schemaDefinition = fields.map(field => ({
            name: field.column_name,
            label: field.display_name,
            type: field.data_type.toLowerCase(),
            order: field.order,
            primary_key: field.primary_key || false,
            hidden: field.hidden || false
        }));

        // Get current user session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('You must be logged in to create tables', 'error');
            return;
        }

        // Insert into user_tables (JSONB approach)
        const { data, error } = await supabase
            .from('user_tables')
            .insert({
                user_id: user.id,
                name: displayName,
                table_key: `custom_${typeName}`,
                schema_definition: schemaDefinition
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating custom table:', error);
            showNotification(`Failed to create table: ${error.message}`, 'error');
        } else {
            showNotification(`Table "${displayName}" created successfully! You can now use it to organize your documents.`, 'success');
            
            // Reset form
            resetCreateTableForm();
            
            // Reload table schemas to include the new table
            if (window.loadTableSchemas) {
                await window.loadTableSchemas();
            }
            
            // Go to the new table page
            setTimeout(() => {
                if (window.appShowPage) {
                    const pageId = `page-${typeName}`;
                    window.appShowPage(pageId);
                }
            }, 2000);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        showNotification('An unexpected error occurred. Please try again.', 'error');
    } finally {
        // Reset button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText || 'Create Table';
        }
    }
}

/**
 * Clear all form errors
 */
function clearFormErrors() {
    // Remove error classes and messages
    const errorInputs = document.querySelectorAll('.form-input.error, .field-input.error');
    errorInputs.forEach(input => input.classList.remove('error'));
    
    const errorMessages = document.querySelectorAll('.error-text');
    errorMessages.forEach(msg => msg.remove());
}

/**
 * Show an error for a specific field
 */
function showFieldError(input, message) {
    input.classList.add('error');
    
    // Remove any existing error message
    const existingError = input.parentNode.querySelector('.error-text');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorMsg = document.createElement('small');
    errorMsg.className = 'error-text';
    errorMsg.textContent = message;
    input.parentNode.appendChild(errorMsg);
    
    // Focus on the first error field
    input.focus();
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

/**
 * Reset the create table form
 */
function resetCreateTableForm() {
    document.getElementById('table-display-name').value = '';
    
    // Clear all field rows
    const fieldsContainer = document.getElementById('fields-container');
    fieldsContainer.innerHTML = '';
    
    // Reset counter and add initial field
    fieldCounter = 0;
    addFieldRow();
    
    // Clear any errors
    clearFormErrors();
}

/**
 * Make showPage function available globally for the cancel button
 * This is a temporary solution - ideally we'd have a proper module system
 */
window.showPage = function(pageId) {
    // This will be defined in app.js
    if (window.appShowPage) {
        window.appShowPage(pageId);
    }
};