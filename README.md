# OCR Pro Landing Page

This is the landing page for OCR Pro - a smart document scanner application.

## Dashboard Image Setup

✅ **Current Setup:**
The dashboard screenshot is already configured and located at:
- **Path:** `./images/Screenshot 2025-09-02 004903.png`
- **Status:** Ready to display in the laptop mockup

## For Vercel Deployment

When deploying to Vercel, you have two options:

**Option 1: Keep in images folder (Current)**
- No changes needed - will work as-is on Vercel
- Path: `./images/Screenshot 2025-09-02 004903.png`

**Option 2: Move to public folder (Recommended)**
- Create a `public` folder in your project root
- Move the image from `images/` to `public/`
- Update path in `landing.html` to `/Screenshot 2025-09-02 004903.png`
- This follows Vercel's static file conventions

3. **Fallback behavior:**
   - If the image is not found, a beautiful placeholder will show instead
   - The placeholder includes dashboard-style statistics and branding

## File Structure
```
OCR DASHBOARD/
├── landing.html          # Main landing page
├── index.html           # Your actual dashboard app
├── images/              # Image assets
│   └── Screenshot 2025-09-02 004903.png  # Dashboard screenshot
├── app.js              # Main application logic
├── supabaseClient.js   # Database connection
└── README.md           # This file
```

## Features

- ✨ Particle text animation with THREE.js
- 💻 Realistic laptop mockup with 3D effects
- 📱 Fully responsive design
- 🎨 Modern glass-morphism header
- 🚀 Ready for Vercel deployment

## Navigation

The header includes:
- **Use Cases** - Features dropdown (ready for expansion)
- **Pricing** - Links to pricing section
- **Sign In** - Links to your dashboard (`index.html`)