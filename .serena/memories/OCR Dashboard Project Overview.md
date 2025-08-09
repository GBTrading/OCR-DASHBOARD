# OCR Dashboard Project Overview

## Project Structure
```
OCR DASHBOARD/
├── index.html          # Main HTML file with authentication and dashboard UI
├── app.js              # Main JavaScript application logic
├── style.css           # Custom CSS styling (dark theme with glass effects)
├── supabaseClient.js   # Supabase client configuration
└── .serena/            # Serena project configuration
```

## Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+ modules)
- **CSS Framework**: Tailwind CSS (CDN)
- **Icons**: Material Icons, Google Fonts (Inter)
- **Backend**: Supabase (Authentication + Database)
- **File Processing**: n8n webhook integration
- **PDF Generation**: jsPDF library
- **Deployment**: Web-based application

## Key Features

### Authentication System
- Email/password login and signup
- Google OAuth integration
- Session management with Supabase Auth
- Protected dashboard routes

### Dashboard Interface
- **Statistics Cards**: Documents processed, business cards, invoices, accuracy rate
- **Usage Chart**: Monthly usage tracking (Pro Plan)
- **Quick Actions**: Upload documents functionality

### Business Cards Management
- Table view with pagination
- Search functionality (name, company, email)
- Date range filtering
- Bulk selection with "Select All"
- VCF export for selected contacts
- Edit/Delete individual records
- CRUD operations with Supabase

### Invoices Management  
- Table view with invoice data
- Search functionality (invoice number, exporter name)
- Date range filtering
- Bulk selection capabilities
- Export options: CSV and PDF formats
- Edit/Delete individual records
- CRUD operations with Supabase

### File Upload System
- Drag & drop interface
- File preview before upload
- Integration with n8n webhook (https://n8n.gbtradingllc.com/webhook-test/upload-files)
- Support for multiple file types
- Processing status tracking

## Database Schema (Supabase)

### business_cards table
- Primary Key: `Email`
- Fields: user_id, Name, Job_Title, Company, Phone, Email, created_at

### invoices table  
- Primary Key: `Invoice_Number`
- Fields: user_id, Invoice_Number, Exporter_Name, Product, Port_of_Loading, Total_Invoice_Value, created_at

## Architecture Patterns

### Authentication Flow
1. Check existing session on app load
2. Show auth forms if no session
3. Handle login/signup with Supabase
4. Redirect to dashboard on success
5. Session persistence across page reloads

### Data Management
- Supabase client for all database operations
- Primary key configuration object for dynamic queries
- Error handling with user-friendly notifications
- Real-time data refresh after operations

### UI/UX Features
- Dark theme with glass morphism effects
- Responsive design
- Loading states and animations
- Toast notifications for user feedback
- Modal dialogs for forms and confirmations
- Debounced search to prevent excessive API calls

## File Upload Integration
- Frontend uploads to n8n webhook
- n8n processes documents (OCR)
- Processed data stored back to Supabase
- Dashboard refreshes to show new data

## Key JavaScript Functions
- `initializeApp()`: Main dashboard initialization
- `populateContactTable()`: Load and display business cards
- `populateInvoiceTable()`: Load and display invoices  
- `handleFileUpload()`: Process file uploads to n8n
- `generateVCF()`: Export selected contacts to VCF format
- `exportInvoicesAsPDF()`/`exportInvoicesAsCSV()`: Export invoice data

## Styling Approach
- Custom CSS with Tailwind utility classes
- Dark theme (#0f172a background)
- Glass morphism effects with backdrop-filter
- Material Design inspired components
- Responsive grid layouts
- Smooth animations and transitions

## Configuration
- Supabase URL: https://gidcaqjahzuvmmqlaohj.supabase.co
- n8n Webhook: https://n8n.gbtradingllc.com/webhook-test/upload-files
- Uses Supabase anon key for client-side operations

## Current Status
- Full-featured OCR dashboard application
- Authentication working with Supabase
- CRUD operations implemented
- File upload integrated with n8n
- Export functionality for both data types
- Search and filtering capabilities
- Modern, responsive UI design
