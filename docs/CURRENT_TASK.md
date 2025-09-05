# OCR Dashboard - QR Upload System Fixes

## Status: Phase 5 Implementation Plan ⚡

**Expert Analysis Complete:** Gemini 2.5 Pro & O3 consensus on QR upload system fixes

---

## PROBLEM ANALYSIS

### Issue 1: Upload Button Inconsistency 🔄
**Symptoms:**
- QR upload works correctly from business cards and custom table pages
- FAILS when initiated from sidebar upload button (`#upload-area-button`) 
- FAILS when initiated from dashboard upload button (`#upload-page-button`)

**Root Cause:**
- Table-specific pages call `openUploadModalForTable(tableKey)` with proper context
- Generic buttons call `openUploadModal()` which requires manual table selection
- QR initialization happens BEFORE table selection, creating disconnect between QR session and destination

### Issue 2: Session File Persistence Bug 🗃️
**Symptoms:**
- Previous QR session files get carried over to new QR sessions
- Happens when user uploads via QR but doesn't complete n8n processing
- User closes modal and starts new QR session → old files appear with new files

**Root Cause Confirmed by Expert Analysis (Gemini 2.5 Pro & O3):**
- `cleanupSession()` method (app.js:7315-7334) only handles client-side cleanup (timers, subscriptions, variables)
- Does NOT handle server-side file removal from Supabase Storage temp-uploads bucket  
- Files uploaded to `temp-uploads/{session-id}/filename` via mobile-upload.html:564
- Files only removed after successful n8n processing (app.js:7177-7178) or scheduled expiration
- No integration between client-side session abandonment and server-side file removal
- Orphaned files remain accessible to subsequent sessions from the same user
- Files persist until successful n8n processing, not on session termination

**Architecture Gap Identified:**
- Existing cleanup infrastructure (Edge Functions, database functions) only handles expired sessions
- Missing client-server integration for immediate cleanup on session abandonment
- Session lifecycle management exists but doesn't enforce file cleanup

---

## IMPLEMENTATION PHASES

### Phase 1: Quick Fix - Modal Consistency 🎯
**Goal:** Fix upload button inconsistency with minimal risk changes
**Priority:** Critical (User experience blocker)

#### **Task 1: Unify Modal Entry Points** ✅ PENDING
**Technical Approach:**
- Replace `openUploadModal()` calls with `openUploadModalForTable(null)`
- Add conditional table selection step when `tableKey` is null
- Defer QR initialization until table is selected

**Implementation Steps:**
1. Modify event handlers for `#upload-area-button` and `#upload-page-button`
2. Add table picker UI with auto-focus for keyboard accessibility  
3. Update QR initialization to wait for table selection
4. Add modal mutex to prevent double-click race conditions

**Files to Modify:**
- `app.js` (lines 3527-3542): Update button event handlers
- `app.js` (lines 2030-2041): Modify `openUploadModal()` function
- `app.js` (lines 6919): Update QR initialization timing

---

#### **Task 2: Implement Conditional QR Initialization** ✅ PENDING  
**Technical Approach:**
```javascript
function openUploadModalForTable(tableKey = null) {
  showModal();
  
  if (tableKey) {
    // Pre-select table and initialize QR immediately
    selectTableInDropdown(tableKey);
    disableTableDropdown();
    initializeCrossDeviceOnModalOpen(tableKey);
  } else {
    // Hide QR area until table selection
    hideQRCode();
    // Add one-time event listener for table selection
    tableDropdown.addEventListener('change', (event) => {
      const selectedTable = event.target.value;
      if (selectedTable) {
        initializeCrossDeviceOnModalOpen(selectedTable);
        showQRCode();
      }
    }, { once: true });
  }
}
```

**Test Results Required:**
- ✅ Sidebar upload button → QR works after table selection
- ✅ Dashboard upload button → QR works after table selection  
- ✅ Table-specific buttons continue working (no regression)
- ✅ Modal prevents double-opening with rapid clicks

---

### Phase 2: Robust Cleanup - Server-Side File Management 🧹
**Goal:** Prevent file carryover between QR sessions with comprehensive cleanup
**Priority:** High (Data integrity issue)

#### **Task 3: Create Supabase Edge Function for File Cleanup** ✅ PENDING
**Technical Approach:**
- Create `cleanup-session-files` Edge Function
- Implement user ownership verification before deletion
- Handle batch file removal from temp-uploads bucket

**Implementation Steps:**
1. Create Edge Function with session ownership verification
2. List and remove all files in `temp-uploads/{session_id}/` path
3. Update `cross_device_sessions` table with cleanup status
4. Add error handling and logging

**Edge Function Structure:**
```javascript
// cleanup-session-files Edge Function
export default async function(req) {
  const { session_id } = await req.json();
  
  // Verify user ownership
  const session = await getSessionWithOwnership(session_id);
  if (!session) return new Response('Unauthorized', { status: 403 });
  
  // List and remove files
  const files = await supabase.storage
    .from('temp-uploads')
    .list(session_id);
    
  if (files.data?.length > 0) {
    await supabase.storage
      .from('temp-uploads')
      .remove(files.data.map(file => `${session_id}/${file.name}`));
  }
  
  // Update session status
  await markSessionCleaned(session_id);
  
  return new Response('OK');
}
```

---

#### **Task 4: Add Scheduled Cleanup Jobs** ✅ PENDING
**Technical Approach:**
- PostgreSQL cron job for expired sessions (every 5 minutes)
- Backup garbage collection job for orphaned files (nightly)

**Implementation Steps:**
1. Create scheduled function to find expired sessions
2. Call cleanup Edge Function for expired sessions
3. Add backup job for files older than 24 hours
4. Implement logging and monitoring

**PostgreSQL Scheduled Function:**
```sql
-- Scheduled function runs every 5 minutes
CREATE OR REPLACE FUNCTION handle_expired_sessions()
RETURNS void AS $$
DECLARE
    session_record RECORD;
BEGIN
    FOR session_record IN
        SELECT id FROM cross_device_sessions
        WHERE expires_at < NOW() AND status != 'cleaned'
    LOOP
        -- Call Edge Function for cleanup
        PERFORM net.http_post(
            url := 'https://fhpbwrltftkiwuhupacl.supabase.co/functions/v1/cleanup-session-files',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('session_id', session_record.id)
        );
        
        UPDATE cross_device_sessions SET status = 'expired' WHERE id = session_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule it to run every 5 minutes
SELECT cron.schedule('cleanup-expired-sessions', '*/5 * * * *', 'SELECT handle_expired_sessions()');
```

---

#### **Task 5: Enhanced Client-Side Cleanup Integration** ✅ PENDING
**Technical Approach:**
- Call Edge Function on session cancel/close
- Add cleanup to browser unload events
- Integrate with n8n error handling

**Implementation Steps:**
1. Update `cleanupSession()` method to call Edge Function
2. Add `window.beforeunload` event handler
3. Wrap n8n processing with cleanup on failure
4. Add cleanup to modal close events

**Enhanced Cleanup Method:**
```javascript
async cleanupSession() {
  // Existing client-side cleanup
  if (this.pollingInterval) {
    clearInterval(this.pollingInterval);
    this.pollingInterval = null;
  }
  
  if (this.realtimeSubscription) {
    this.realtimeSubscription.unsubscribe();
    this.realtimeSubscription = null;
  }
  
  // NEW: Server-side file cleanup
  if (this.currentSession?.id) {
    try {
      await fetch('/api/cleanup-session-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.currentSession.id })
      });
    } catch (error) {
      console.warn('Cleanup failed:', error);
      // Non-blocking - scheduled job will handle it
    }
  }
  
  this.currentSession = null;
}
```

---

### Phase 3: Edge Case Handling & Testing 🛡️  
**Goal:** Ensure robust operation under all conditions
**Priority:** Medium (Quality assurance)

#### **Task 6: Multi-Tab and Race Condition Prevention** ✅ PENDING
**Technical Approach:**
- Session-scoped file paths: `temp-uploads/{userId}/{sessionId}/`
- Cleanup mutex to prevent concurrent operations
- Idempotent upload handling

**Implementation Steps:**
1. Update file path structure to include userId
2. Add cleanup operation locking
3. Implement file hash-based deduplication
4. Add parallel session detection

#### **Task 7: Security and Permission Hardening** ✅ PENDING
**Technical Approach:**
- Row Level Security (RLS) policies on storage bucket
- User ownership verification in all operations
- Audit logging for cleanup operations

**Implementation Steps:**
1. Create RLS policies for temp-uploads bucket
2. Add audit logging table for cleanup operations
3. Implement permission checks in Edge Function
4. Add rate limiting for cleanup requests

---

## SUCCESS METRICS

### **Phase 1 Success:**
- ✅ QR upload works consistently from all upload buttons (sidebar, dashboard, table-specific)
- ✅ No modal initialization race conditions
- ✅ Table selection properly configures QR destination  
- ✅ Zero regression in existing table-specific upload flows

### **Phase 2 Success:**
- ✅ No file carryover between QR sessions
- ✅ Automatic cleanup of orphaned files within 5 minutes
- ✅ Zero unauthorized file deletions
- ✅ Cleanup operations handle network failures gracefully

### **Phase 3 Success:**
- ✅ Multi-tab sessions work independently 
- ✅ Race conditions prevented with proper locking
- ✅ Security policies prevent data leakage
- ✅ Comprehensive automated test coverage

---

## TECHNICAL ARCHITECTURE DECISIONS

### **Modal System Architecture:**
- **Pattern:** Unified entry point with conditional initialization
- **Benefits:** Eliminates dual code paths, consistent UX
- **Implementation:** Single `openUploadModalForTable()` function with null handling

### **Cleanup System Architecture:**  
- **Pattern:** Defense-in-depth with multiple cleanup triggers
- **Components:** Client cleanup + Edge Function + Scheduled jobs
- **Benefits:** Handles all failure modes (network, browser crash, processing errors)

### **File Organization:**
- **Structure:** `temp-uploads/{userId}/{sessionId}/{filename}`  
- **Benefits:** User isolation, session scoping, easy batch cleanup
- **Cleanup:** Entire session folder removed atomically

---

## RISK MITIGATION

### **Implementation Risks:**
- **Modal Changes:** Low risk - isolated to initialization, extensive testing required
- **Storage Cleanup:** Medium risk - data deletion operations, ownership verification critical
- **Scheduled Jobs:** Low risk - operates on expired data only, logging for monitoring

### **Rollback Strategy:**
- Phase 1: Simple revert of modal changes, no data impact
- Phase 2: Disable scheduled jobs, manual cleanup if needed  
- Phase 3: Feature flags for new functionality

**Combined Impact:** Enterprise-grade QR upload reliability with bulletproof session management and zero data persistence issues.