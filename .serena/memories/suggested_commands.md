# OCR Dashboard - Suggested Commands

## System Commands (Windows)
```bash
# Directory navigation
dir                     # List directory contents
cd <path>              # Change directory
type <file>            # Display file contents
copy <src> <dest>      # Copy files
del <file>             # Delete files
mkdir <dir>            # Create directory

# Git commands
git status             # Check repository status
git add .              # Stage all changes
git commit -m "msg"    # Commit changes
git push               # Push to remote
git pull               # Pull from remote

# Development server (if using)
python -m http.server 8000    # Simple HTTP server
# Or using Live Server extension in VS Code
```

## Testing Commands
```bash
# Open the application
# 1. Open index.html in a web browser directly, or
# 2. Use a local server:
python -m http.server 8000
# Then navigate to http://localhost:8000

# Test Supabase connection
# Open browser developer tools and check console for:
# - Authentication status
# - Database connection messages
# - Any error messages

# Test n8n webhook
# Use the upload functionality in the app
# Check network tab for webhook requests
```

## File Operations
```bash
# Create test files
echo "test content" > test.txt
echo. > empty_test.txt

# View application logs
# Open browser developer tools (F12)
# Check Console tab for application logs
# Check Network tab for API requests
```

## Environment Setup
```bash
# Ensure VS Code extensions are installed:
# - Live Server (for local development)
# - Prettier (for code formatting)
# - JavaScript ES6 snippets

# Browser testing
# Test in Chrome/Edge (primary)
# Test in Firefox (secondary)
# Check mobile responsiveness (DevTools device emulation)
```

## Debugging Commands
```bash
# Check file permissions
icacls <file>          # Windows file permissions

# Network debugging
ping supabase.co       # Test Supabase connectivity
nslookup n8n.gbtradingllc.com  # Test n8n endpoint

# Browser debugging
# F12 -> Console: Check for JavaScript errors
# F12 -> Network: Monitor API calls
# F12 -> Application: Check localStorage/sessionStorage
```
