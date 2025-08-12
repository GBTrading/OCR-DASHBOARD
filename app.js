import { supabase } from './supabaseClient.js';

// Table Action Event Delegation
function setupTableActionEventListeners() {
    // Event delegation for contacts table
    const contactsTableBody = document.getElementById('contacts-table-body');
    if (contactsTableBody) {
        contactsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                openEditModal(id, type);
            } else if (e.target.classList.contains('delete-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                openDeleteConfirm(id, type);
            }
        });
    }

    // Event delegation for invoices table
    const invoicesTableBody = document.getElementById('invoices-table-body');
    if (invoicesTableBody) {
        invoicesTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const id = e.target.getAttribute('data-id');
                const type = e.target.getAttribute('data-type');
                openEditModal(id, type);
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
        saveChangesBtn.addEventListener('click', handleUpdate);
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
        confirmDeleteBtn.addEventListener('click', handleDelete);
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
let currentPage = 'page-dashboard'; // Track current active page

// Central configuration for table primary keys
const primaryKeys = {
    business_cards: 'Email',
    invoices: 'Invoice_Number'
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
        
        // Load page-specific data
        loadPageData(pageId);
    } else {
        console.error(`Page with ID '${pageId}' not found`);
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
            break;
        case 'page-invoices':
            // Load invoices table
            populateInvoiceTable();
            break;
        case 'page-upload':
            // No specific data loading needed for upload page
            break;
        case 'page-settings':
        case 'page-billing':
            // Placeholder pages - no data loading yet
            break;
        default:
            console.log(`No data loading defined for page: ${pageId}`);
    }
}

/**
 * Set up navigation event listeners for sidebar items
 */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach((navItem, index) => {
        navItem.addEventListener('click', () => {
            // Remove active class from all nav items
            navItems.forEach(item => item.classList.remove('active'));
            
            // Add active class to clicked item
            navItem.classList.add('active');
            
            // Get page ID from data attribute - robust approach
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
    });
}

// Upload modal elements - Add these variables at the top with other global variables
const uploadModal = document.getElementById('upload-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const filePreviewList = document.getElementById('file-preview-list');

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
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        setAuthLoading(true, 'login');
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        currentUser = data.user;
        showDashboard();
        
    } catch (error) {
        console.error('Login error:', error);
        showAuthMessage(error.message || 'Invalid email or password', 'error');
    } finally {
        setAuthLoading(false, 'login');
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
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session && session.user) {
            currentUser = session.user;
            showDashboard();
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Session check error:', error);
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
function openUploadModal() {
    uploadModal.style.display = 'flex';
}

function closeUploadModal() {
    uploadModal.style.display = 'none';
    fileInput.value = ''; // Clear selected files
    filePreviewList.innerHTML = ''; // Clear the preview
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
    const files = fileInput.files;

    if (files.length === 0) {
        showNotification('Please select at least one file to upload.', 'error');
        return;
    }
    
    if (!currentUser) {
        showNotification('Authentication error. Please log in again.', 'error');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]); // The key 'files' must match what n8n expects
    }
    
    // Append the user's ID to the form data for n8n
    formData.append('userId', currentUser.id);

    const webhookUrl = 'https://n8n.gbtradingllc.com/webhook-test/upload-files'; // <-- IMPORTANT: PASTE YOUR URL HERE

    try {
        showNotification('Uploading...', 'info');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            // If you set up Header Auth in n8n, add it here
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
        }

        showNotification('Upload successful! Processing documents...', 'success');
        closeUploadModal();
        
        // Refresh dashboard data after a delay to allow for processing
        setTimeout(() => {
            fetchInitialDashboardData();
            populateContactTable();
            populateInvoiceTable();
        }, 5000); // 5 second delay

    } catch (error) {
        console.error('Upload error:', error);
        showNotification(error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Files';
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

        // Update record in Supabase
        const { error } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', id);

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
    currentEditRecord = { id, type }; // Reuse the same variable for simplicity
    
    const recordType = type === 'contact' ? 'business card' : 'invoice';
    document.getElementById('delete-message').textContent = 
        `Are you sure you want to delete this ${recordType}? This action cannot be undone.`;
    
    document.getElementById('delete-confirm-modal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
    currentEditRecord = null;
}

// In app.js, find and update this function

async function handleDelete() {
    if (!currentEditRecord) { // Or however you store the record to delete
        showNotification('No record selected for deletion.', 'error');
        return;
    }
    
    const { id, type } = currentEditRecord; // Assuming id is the PK value
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
        // We can run both count queries at the same time for better performance
        const [contactsResult, invoicesResult] = await Promise.all([
            supabase
                .from('business_cards')
                .select('*', { count: 'exact', head: true }), // Fetches only the count
            supabase
                .from('invoices')
                .select('*', { count: 'exact', head: true }) // Fetches only the count
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

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        showNotification('Could not load dashboard stats.', 'error');
    }
}

async function populateContactTable(filters = {}) {
    console.log('Fetching contacts and populating table...');
    
    // Build dynamic query
    let query = supabase
        .from('business_cards') 
        .select('user_id, Name, Job_Title, Company, Phone, Email, created_at');

    // Add search filter if provided
    if (filters.searchTerm) {
        const searchTerm = `%${filters.searchTerm}%`;
        query = query.or(`Name.ilike.${searchTerm},Company.ilike.${searchTerm},Email.ilike.${searchTerm}`);
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
        console.error('Error fetching contacts:', error);
        showNotification('Could not load business cards.', 'error');
        return;
    }
    
    if (data) {
        const tableBody = document.getElementById('contacts-table-body');
        tableBody.innerHTML = ''; 
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 40px;">No business cards found matching your criteria.</td></tr>';
            return;
        }
        
        // Create an HTML row for each contact with checkbox
        tableBody.innerHTML = data.map(contact => `
            <tr>
                <td><input type="checkbox" class="contact-row-checkbox"></td>
                <td>${contact.Name || 'N/A'}</td>
                <td>${contact.Job_Title || 'N/A'}</td>
                <td>${contact.Company || 'N/A'}</td>
                <td>${contact.Phone || 'N/A'}</td>
                <td>${contact.Email || 'N/A'}</td>
                <td>${formatDate(contact.created_at)}</td>
                <td><span class="status-badge status-success">Processed</span></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${contact.Email}" data-type="contact">✏️</button>
                    <button class="action-btn delete-btn" data-id="${contact.Email}" data-type="contact">🗑️</button>
                </td>
            </tr>
        `).join('');
    }
    
    // Re-setup select all functionality after table is populated
    setupSelectAllFunctionality();
}

async function populateInvoiceTable(filters = {}) {
    console.log('Fetching invoices and populating table...');
    
    // Build dynamic query
    let query = supabase
        .from('invoices')
        .select('user_id, Invoice_Number, Exporter_Name, Product, Port_of_Loading, Total_Invoice_Value, created_at'); 

    // Add search filter if provided
    if (filters.searchTerm) {
        const searchTerm = `%${filters.searchTerm}%`;
        query = query.or(`Invoice_Number.ilike.${searchTerm},Exporter_Name.ilike.${searchTerm}`);
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
        
        // Create an HTML row for each invoice with checkbox
        tableBody.innerHTML = data.map(invoice => `
            <tr>
                <td><input type="checkbox" class="invoice-row-checkbox"></td>
                <td>${invoice.Invoice_Number || 'N/A'}</td>
                <td>${invoice.Exporter_Name || 'N/A'}</td>
                <td>${invoice.Product || 'N/A'}</td>
                <td>${invoice.Port_of_Loading || 'N/A'}</td>
                <td>${invoice.Total_Invoice_Value || 'N/A'}</td>
                <td>${formatDate(invoice.created_at)}</td>
                <td><span class="status-badge status-success">Processed</span></td>
                <td>
                    <button class="action-btn edit-btn" data-id="${invoice.Invoice_Number}" data-type="invoice">✏️</button>
                    <button class="action-btn delete-btn" data-id="${invoice.Invoice_Number}" data-type="invoice">🗑️</button>
                </td>
            </tr>
        `).join('');
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
        setupSearchAndFilterEventListeners();
        
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

// Search and Filter Event Listeners
function setupSearchAndFilterEventListeners() {
    // Debounced search functions
    const debouncedContactSearch = debounce((searchTerm) => {
        const startDate = document.getElementById('contacts-start-date').value;
        const endDate = document.getElementById('contacts-end-date').value;
        populateContactTable({ searchTerm, startDate, endDate });
    }, 500);

    const debouncedInvoiceSearch = debounce((searchTerm) => {
        const startDate = document.getElementById('invoices-start-date').value;
        const endDate = document.getElementById('invoices-end-date').value;
        populateInvoiceTable({ searchTerm, startDate, endDate });
    }, 500);

    // Contact search
    const contactsSearch = document.getElementById('contacts-search');
    if (contactsSearch) {
        contactsSearch.addEventListener('input', function() {
            debouncedContactSearch(this.value.trim());
        });
    }

    // Invoice search
    const invoicesSearch = document.getElementById('invoices-search');
    if (invoicesSearch) {
        invoicesSearch.addEventListener('input', function() {
            debouncedInvoiceSearch(this.value.trim());
        });
    }

    // Contact filter buttons
    const contactsApplyFilter = document.getElementById('contacts-apply-filter');
    if (contactsApplyFilter) {
        contactsApplyFilter.addEventListener('click', () => {
            const searchTerm = document.getElementById('contacts-search').value.trim();
            const startDate = document.getElementById('contacts-start-date').value;
            const endDate = document.getElementById('contacts-end-date').value;
            populateContactTable({ searchTerm, startDate, endDate });
        });
    }

    const contactsClearFilter = document.getElementById('contacts-clear-filter');
    if (contactsClearFilter) {
        contactsClearFilter.addEventListener('click', () => {
            document.getElementById('contacts-search').value = '';
            document.getElementById('contacts-start-date').value = '';
            document.getElementById('contacts-end-date').value = '';
            populateContactTable(); // No filters
        });
    }

    // Invoice filter buttons
    const invoicesApplyFilter = document.getElementById('invoices-apply-filter');
    if (invoicesApplyFilter) {
        invoicesApplyFilter.addEventListener('click', () => {
            const searchTerm = document.getElementById('invoices-search').value.trim();
            const startDate = document.getElementById('invoices-start-date').value;
            const endDate = document.getElementById('invoices-end-date').value;
            populateInvoiceTable({ searchTerm, startDate, endDate });
        });
    }

    const invoicesClearFilter = document.getElementById('invoices-clear-filter');
    if (invoicesClearFilter) {
        invoicesClearFilter.addEventListener('click', () => {
            document.getElementById('invoices-search').value = '';
            document.getElementById('invoices-start-date').value = '';
            document.getElementById('invoices-end-date').value = '';
            populateInvoiceTable(); // No filters
        });
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
    document.getElementById('login-form-element').addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });

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
    // Upload Modal Event Listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeUploadModal);
    if (uploadBtn) uploadBtn.addEventListener('click', handleFileUpload); // RENAMED function
    
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
    setupSearchAndFilterEventListeners();
    setupTableActionEventListeners();
    setupEditDeleteModalEventListeners();
    setupNavigation(); // Set up client-side routing
}

document.addEventListener('DOMContentLoaded', () => {
    // Make key functions globally available so HTML onclick can find them
    // This is a simpler fix than refactoring all the HTML right now
    window.exportContacts = exportContacts;
    window.downloadInvoices = downloadInvoices;
    window.handleInvoiceExport = handleInvoiceExport;
    // Set up upload button event listeners
    const uploadAreaButton = document.getElementById('upload-area-button');
    if (uploadAreaButton) {
        uploadAreaButton.addEventListener('click', openUploadModal);
    }
    
    const uploadPageButton = document.getElementById('upload-page-button');
    if (uploadPageButton) {
        uploadPageButton.addEventListener('click', openUploadModal);
    }

    setupEventListeners(); // A master setup function
    checkUser();
});