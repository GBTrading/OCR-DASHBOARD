# OCR Dashboard - Complete Code Index

## 📁 File Structure & Symbols

### 🔧 supabaseClient.js
**Configuration & Exports:**
- `supabaseUrl` - Supabase project URL constant
- `supabaseAnonKey` - Anonymous key for Supabase client
- `supabase` - Main Supabase client instance (exported)

### 📱 app.js - Main Application Logic

## 🌟 Global State Variables
- `currentUser` - Stores authenticated user object
- `currentEditRecord` - Holds record being edited (id, type, data)
- `primaryKeys` - Configuration object mapping table names to primary key columns

## 🔐 Authentication Functions
- `handleSignUp()` - Process user registration with email/password
- `handleLogin()` - Process user login with email/password
- `handleGoogleAuth()` - Handle Google OAuth authentication
- `handleLogout()` - Sign out user and clear session
- `checkUser()` - Verify existing session on app load

## 🎨 UI State Management
- `showAuth()` - Display authentication container
- `showDashboard()` - Display main dashboard interface
- `showLoginForm()` - Switch to login form view
- `showSignupForm()` - Switch to signup form view
- `clearAuthForms()` - Reset all authentication form fields
- `showAuthMessage(message, type)` - Display auth success/error messages
- `clearAuthMessage()` - Hide authentication messages
- `setAuthLoading(loading, formType)` - Manage loading states for auth buttons

## 📊 Dashboard Data Functions
- `fetchInitialDashboardData()` - Load stats for dashboard cards
- `populateContactTable(filters)` - Load and display business cards table
- `populateInvoiceTable(filters)` - Load and display invoices table
- `updateStats()` - Refresh dashboard statistics display
- `initializeApp()` - Main dashboard initialization function

## 📤 File Upload System
**DOM Elements:**
- `uploadModal` - Upload modal dialog element
- `closeModalBtn` - Close button for upload modal
- `uploadBtn` - Upload trigger button
- `fileInput` - File input element
- `dropZone` - Drag & drop zone element
- `filePreviewList` - Container for file preview list

**Functions:**
- `openUploadModal()` - Show file upload dialog
- `closeUploadModal()` - Hide upload dialog and clear files
- `previewFiles()` - Generate preview of selected files
- `handleFileUpload()` - Process file upload to n8n webhook

## 💼 Business Cards Management
- `generateVCF()` - Export selected contacts to VCF format
- `exportContacts()` - Wrapper function for VCF export
- `setupSelectAllFunctionality()` - Handle "select all" checkbox behavior

## 🧾 Invoice Management
- `handleInvoiceExport()` - Process invoice export based on selected format
- `exportInvoicesAsCSV(invoices)` - Export invoice data to CSV format
- `exportInvoicesAsPDF(invoices)` - Export invoice data to PDF format
- `downloadInvoices()` - Wrapper function for invoice export

## ✏️ CRUD Operations (Edit/Delete)
- `openEditModal(id, type)` - Open edit dialog for record
- `closeEditModal()` - Close edit dialog
- `handleUpdate()` - Save changes to edited record
- `openDeleteConfirm(id, type)` - Show delete confirmation dialog
- `closeDeleteModal()` - Close delete confirmation dialog
- `handleDelete()` - Execute record deletion

## 🔍 Search & Filter System
- `setupSearchAndFilterEventListeners()` - Initialize search/filter functionality
- `debounce(func, delay)` - Utility function to limit API calls
- Search functionality includes:
  - Real-time search with debouncing
  - Date range filtering
  - Apply/Clear filter buttons
  - Separate systems for contacts and invoices

## 🎛️ Event Management
- `setupEventListeners()` - Master function to initialize all event listeners
- `setupAuthEventListeners()` - Authentication form event handlers
- `setupModalEventListeners()` - Upload modal event handlers
- `setupDashboardEventListeners()` - Dashboard button event handlers
- `setupTableActionEventListeners()` - Table row action event delegation
- `setupEditDeleteModalEventListeners()` - Edit/delete modal event handlers

## 🛠️ Utility Functions
- `formatDate(dateString)` - Convert dates to human-readable format
- `formatCurrency(amount, currency)` - Format monetary values
- `showNotification(message, type)` - Display toast notifications

## 🚀 Application Initialization
- `document.addEventListener('DOMContentLoaded')` - Main app entry point
  - Sets up global function references for HTML onclick attributes
  - Initializes all event listeners
  - Calls `checkUser()` to determine initial app state

## 🔄 Data Flow Architecture

### Authentication Flow:
1. `checkUser()` → `showAuth()` or `showDashboard()`
2. Login/Signup → `handleLogin()`/`handleSignUp()` → `showDashboard()`
3. `showDashboard()` → `initializeApp()`

### Dashboard Initialization:
1. `initializeApp()` calls:
   - `fetchInitialDashboardData()` - Load stats
   - `populateContactTable()` - Load business cards
   - `populateInvoiceTable()` - Load invoices
   - `setupSearchAndFilterEventListeners()` - Enable filtering

### File Upload Flow:
1. User clicks upload → `openUploadModal()`
2. Files selected → `previewFiles()`
3. Upload button → `handleFileUpload()` → n8n webhook
4. Success → refresh tables with new data

### CRUD Operations Flow:
1. Edit button → `openEditModal()` → populate form
2. Save → `handleUpdate()` → Supabase update → refresh table
3. Delete button → `openDeleteConfirm()` → `handleDelete()` → refresh table

## 🎯 Key Integration Points
- **Supabase**: All database operations (auth, CRUD, queries)
- **n8n Webhook**: File upload processing endpoint
- **jsPDF**: PDF generation for invoice exports
- **Material Icons**: UI iconography
- **Tailwind CSS**: Styling framework

## 📋 Table Configurations
- **business_cards**: Primary key = 'Email'
- **invoices**: Primary key = 'Invoice_Number'
- Configuration stored in `primaryKeys` object for dynamic queries
