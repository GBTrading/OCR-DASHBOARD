# Settings Page Test Checklist

## 🧪 Testing Checklist

Use this checklist to verify all Settings page functionality is working correctly.

### **Pre-Testing Setup**
- [ ] Apply the database migration: `migrations/001_create_user_settings.sql`
- [ ] Ensure you're logged into the dashboard
- [ ] Clear localStorage to test fresh experience: `localStorage.clear()`

---

### **🎨 Theme Toggle Testing**
- [ ] Navigate to Settings page via sidebar
- [ ] Verify theme toggle shows "Dark" as default
- [ ] Click theme toggle
- [ ] **Expected**: Instant switch to light theme
- [ ] **Expected**: All UI elements change colors smoothly
- [ ] **Expected**: Sidebar, header, cards all switch themes
- [ ] Refresh page
- [ ] **Expected**: Light theme persists after refresh
- [ ] Toggle back to dark theme
- [ ] **Expected**: Dark theme persists after refresh
- [ ] **Expected**: Smooth transitions throughout

### **👤 Profile Management Testing**
- [ ] Verify email field shows your logged-in email (read-only)
- [ ] Verify account creation date is displayed
- [ ] Enter a new display name
- [ ] Click "Update Profile"
- [ ] **Expected**: Success notification appears
- [ ] **Expected**: Name is saved (refresh to verify)

#### **Password Change Testing**
- [ ] Enter current password
- [ ] Enter new password (min 6 characters)
- [ ] Click "Change Password"
- [ ] **Expected**: Success notification
- [ ] **Expected**: Password fields clear automatically
- [ ] Test with wrong current password
- [ ] **Expected**: Error message about incorrect password

### **⚙️ Preferences Testing**
- [ ] Select a default document type
- [ ] **Expected**: Setting saves automatically (debounced)
- [ ] Toggle email notifications checkbox
- [ ] **Expected**: Auto-save notification appears
- [ ] Toggle auto-save enabled checkbox
- [ ] **Expected**: Setting persists
- [ ] Refresh page
- [ ] **Expected**: All preferences are retained

### **💾 Storage Usage Testing**
- [ ] Verify storage bar is displayed
- [ ] **Expected**: Shows "X MB of 10 GB used (Y documents)"
- [ ] **Expected**: Progress bar reflects usage percentage
- [ ] If you have documents, storage should show > 0

### **📤 Data Export Testing**
- [ ] Click "Export Contacts" button
- [ ] **Expected**: CSV file downloads automatically
- [ ] **Expected**: File named `contacts_export_YYYY-MM-DD.csv`
- [ ] Open CSV file
- [ ] **Expected**: Contains all your business card data
- [ ] Click "Export Invoices" button
- [ ] **Expected**: CSV file downloads automatically
- [ ] **Expected**: File named `invoices_export_YYYY-MM-DD.csv`
- [ ] Open CSV file
- [ ] **Expected**: Contains all your invoice data

### **⚠️ Danger Zone Testing**
- [ ] Click "Delete Account" button
- [ ] Type something other than "DELETE"
- [ ] **Expected**: Cancellation message
- [ ] Click "Delete Account" again
- [ ] Type "DELETE" exactly
- [ ] **Expected**: Account deletion request message
- [ ] **Expected**: Automatic logout after 3 seconds

### **📱 Responsive Design Testing**
- [ ] Resize browser window to mobile size
- [ ] **Expected**: Settings cards stack vertically
- [ ] **Expected**: Theme toggle adjusts size
- [ ] **Expected**: All buttons remain clickable
- [ ] **Expected**: Text remains readable

### **🔄 Navigation Testing**
- [ ] Navigate away from Settings page
- [ ] Return to Settings page
- [ ] **Expected**: All settings are preserved
- [ ] **Expected**: Theme choice is maintained
- [ ] **Expected**: Form data is retained

---

## 🐛 Common Issues & Solutions

### **Theme Toggle Not Working**
- **Issue**: Toggle clicks but nothing changes
- **Solution**: Check browser console for JavaScript errors
- **Solution**: Verify CSS variables are loaded

### **Settings Not Saving**
- **Issue**: Preferences reset after refresh
- **Solution**: Verify `user_settings` table exists in Supabase
- **Solution**: Check browser console for database errors
- **Solution**: Ensure user is properly authenticated

### **Export Not Working**
- **Issue**: No download when clicking export buttons
- **Solution**: Check browser's download settings
- **Solution**: Verify you have data to export
- **Solution**: Check browser console for errors

### **Database Errors**
- **Issue**: "Table doesn't exist" errors
- **Solution**: Apply the migration in `migrations/001_create_user_settings.sql`
- **Solution**: Verify Row Level Security policies are active

---

## ✅ Success Criteria

**All tests pass if:**
- ✅ Theme toggle works instantly and persists
- ✅ Profile updates save successfully  
- ✅ Preferences auto-save without manual action
- ✅ Storage usage displays correctly
- ✅ Both export functions download valid CSV files
- ✅ All responsive breakpoints work smoothly
- ✅ No browser console errors appear

**If all tests pass, your Settings page is production-ready! 🎉**
