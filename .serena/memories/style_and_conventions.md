# OCR Dashboard - Style and Conventions

## JavaScript Style Guide

### Naming Conventions
- **Variables**: camelCase (`currentUser`, `fileInput`, `uploadModal`)
- **Functions**: camelCase (`handleLogin`, `populateContactTable`, `showNotification`)
- **Constants**: UPPER_SNAKE_CASE (`PRIMARY_KEYS`, `WEBHOOK_URL`)
- **Classes**: PascalCase (not used in this project)
- **Files**: kebab-case or camelCase (`supabaseClient.js`, `app.js`)

### Code Organization
```javascript
// 1. Imports at top
import { supabase } from './supabaseClient.js';

// 2. Global variables and configuration
let currentUser = null;
const primaryKeys = { business_cards: 'Email' };

// 3. Core functionality functions
async function handleLogin() { /* ... */ }

// 4. UI utility functions
function showNotification(message, type) { /* ... */ }

// 5. Event listeners setup
function setupEventListeners() { /* ... */ }

// 6. Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkUser();
});
```

### Function Structure
- Use async/await for asynchronous operations
- Include try/catch blocks for error handling
- Add JSDoc comments for complex functions
- Keep functions focused and single-purpose

### Error Handling Pattern
```javascript
try {
    // Operation
    const { data, error } = await supabase.from('table').select('*');
    if (error) throw error;
    
    // Success handling
    showNotification('Operation successful!', 'success');
} catch (error) {
    console.error('Operation failed:', error);
    showNotification('Error message', 'error');
}
```

## HTML/CSS Conventions

### HTML Structure
- Semantic HTML5 elements
- Accessible form labels and ARIA attributes
- Consistent class naming with utility-first approach
- Data attributes for JavaScript hooks (`data-id`, `data-type`)

### CSS/Tailwind Usage
- Utility-first approach with Tailwind CSS
- Custom CSS in style.css for animations and complex layouts
- Responsive design with mobile-first approach
- Consistent spacing using Tailwind spacing scale

### CSS Custom Properties
```css
:root {
    --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --glass-effect: rgba(255, 255, 255, 0.1);
    --shadow-elevated: 0 20px 40px rgba(0, 0, 0, 0.1);
}
```

## Database Conventions
- Table names: snake_case (`business_cards`, `invoices`)
- Column names: Snake_Case with capital first letter (`Job_Title`, `Phone`)
- Primary keys: Use email for business_cards, Invoice_Number for invoices
- Foreign keys: `user_id` for user association
- Timestamps: `created_at`, `updated_at`

## API Conventions
- Use Supabase client for all database operations
- Consistent error handling with try/catch
- Real-time subscriptions for live data updates
- Proper authentication checks before operations

## File Organization
- Keep all styles in dedicated CSS files
- Separate concerns: HTML structure, CSS styling, JS functionality
- Use ES6 modules for code organization
- Maintain clear separation between UI and business logic
