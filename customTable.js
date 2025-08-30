// =================================================================================
// CUSTOM TABLE CREATION FUNCTIONALITY
// =================================================================================

import { supabase } from './supabaseClient.js';

// Global variables
let fieldCounter = 0;

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
            <input type="text" class="field-input field-name" placeholder="e.g., merchant_name" required>
            <small class="help-text">Use lowercase with underscores (e.g., merchant_name)</small>
        </div>
        
        <div class="field-input-group">
            <label>Data Type</label>
            <select class="field-select field-type">
                <option value="TEXT">Text</option>
                <option value="NUMERIC">Number</option>
                <option value="DATE">Date</option>
            </select>
        </div>
        
        <div class="field-input-group">
            <label>Primary Key</label>
            <div class="primary-key-radio">
                <input type="radio" name="primary-key" value="${fieldCounter}" class="primary-key-field">
            </div>
        </div>
        
        <button type="button" class="remove-field-btn" onclick="removeFieldRow(${fieldCounter})">
            Remove
        </button>
    `;
    
    fieldsContainer.appendChild(fieldRow);
    
    // Auto-select first field as primary key
    if (fieldCounter === 1) {
        const primaryRadio = fieldRow.querySelector('.primary-key-field');
        primaryRadio.checked = true;
    }
}

/**
 * Remove a field row from the form
 */
window.removeFieldRow = function(fieldId) {
    const fieldRow = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (fieldRow) {
        const wasChecked = fieldRow.querySelector('.primary-key-field').checked;
        fieldRow.remove();
        
        // If this was the primary key, select the first available field
        if (wasChecked) {
            const firstRadio = document.querySelector('.primary-key-field');
            if (firstRadio) {
                firstRadio.checked = true;
            }
        }
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
    let primaryKeyColumn = null;
    let hasValidPrimaryKey = false;
    
    // Validate fields
    for (let i = 0; i < fieldRows.length; i++) {
        const row = fieldRows[i];
        const fieldName = row.querySelector('.field-name').value.trim();
        const fieldType = row.querySelector('.field-type').value;
        const isPrimaryKey = row.querySelector('.primary-key-field').checked;
        
        // Validate field name
        if (!fieldName) {
            showFieldError(row.querySelector('.field-name'), 'Field name is required');
            return;
        }
        
        // Validate field name format (lowercase with underscores)
        if (!/^[a-z][a-z0-9_]*$/.test(fieldName)) {
            showFieldError(row.querySelector('.field-name'), 'Field name must start with a letter and contain only lowercase letters, numbers, and underscores');
            return;
        }
        
        // Check for duplicate field names
        if (fieldNames.has(fieldName)) {
            showFieldError(row.querySelector('.field-name'), 'Field names must be unique');
            return;
        }
        
        fieldNames.add(fieldName);
        
        if (isPrimaryKey) {
            primaryKeyColumn = fieldName;
            hasValidPrimaryKey = true;
        }
        
        fields.push({
            column_name: fieldName,
            display_name: fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            data_type: fieldType,
            order: i
        });
    }
    
    // Validate primary key selection
    if (!hasValidPrimaryKey) {
        showNotification('Please select one field as the primary key', 'error');
        return;
    }
    
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
            primary_key: field.column_name === primaryKeyColumn
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