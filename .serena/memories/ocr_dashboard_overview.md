# OCR Dashboard Project Overview

## Project Purpose
A modern web-based OCR (Optical Character Recognition) dashboard that processes uploaded documents (business cards and invoices) and extracts structured data. The system uses:
- Frontend: Modern HTML/CSS/JavaScript with Tailwind CSS
- Backend: n8n workflow automation for OCR processing  
- Database: Supabase for data storage and authentication
- Authentication: Supabase Auth with email/password and Google OAuth

## Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth
- **File Upload**: HTML5 File API with drag-and-drop
- **OCR Processing**: n8n webhook automation
- **PDF Generation**: jsPDF library
- **External APIs**: Google OAuth, Material Icons, Google Fonts

## Code Structure
```
OCR DASHBOARD/
├── index.html          # Main application file with all UI components
├── app.js              # Main application logic and functionality
├── style.css           # Custom styles and animations
├── supabaseClient.js   # Supabase configuration and client setup
├── .gitignore          # Git ignore rules
└── setup files...      # Environment setup scripts
```

## Key Features
1. **Authentication System**: Login/signup with email or Google OAuth
2. **Document Upload**: Drag-and-drop file upload with preview
3. **Data Management**: View, edit, delete business cards and invoices
4. **Export Functionality**: VCF export for contacts, CSV/PDF for invoices
5. **Search & Filter**: Real-time search and date filtering
6. **Responsive Design**: Modern UI with glass effects and animations

## Database Schema
- **business_cards**: Name, Job_Title, Company, Phone, Email, user_id, created_at
- **invoices**: Invoice_Number, Exporter_Name, Product, Port_of_Loading, Total_Invoice_Value, user_id, created_at

## Development Workflow
- Modern JavaScript (ES6+ modules)
- Responsive design patterns
- Real-time data synchronization
- Security-first authentication
- Error handling and user feedback
