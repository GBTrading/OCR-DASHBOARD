# n8n Webhook Routing Updates for Unified Table System

## Overview

The frontend now sends a unified `tableId` (UUID) for all uploads instead of hardcoded table names. The n8n webhook needs to be updated to handle this new routing logic.

## Current vs New Upload Payload

### Before (Table-Specific):
```javascript
formData.append('tableId', 'business_cards'); // or 'invoices'
```

### After (Unified UUID):
```javascript
formData.append('tableId', 'b7e8c9d0-1234-5678-9abc-def012345678'); // Business Cards
formData.append('tableId', 'a1b2c3d4-1234-5678-9abc-def012345678'); // Invoices  
formData.append('tableId', 'custom-table-uuid'); // Custom Tables
```

## Required n8n Webhook Updates

### 1. Add Table Metadata Query

First, query the `user_tables` to get routing information:

```javascript
// Get table metadata to determine routing
const { data: tableMeta, error } = await supabase
  .from('user_tables')
  .select('table_key, is_system_table, schema_definition, name')
  .eq('id', tableId)
  .single();

if (error || !tableMeta) {
  throw new Error(`Invalid table ID: ${tableId}`);
}
```

### 2. Update Routing Logic

Replace hardcoded table routing with dynamic routing:

```javascript
if (tableMeta.is_system_table) {
  // Route to physical table
  if (tableMeta.table_key === 'business_cards') {
    // INSERT INTO business_cards (...) VALUES (...)
    await insertIntoBusinessCards(processedData);
  } else if (tableMeta.table_key === 'invoices_legacy') {
    // Route to JSONB system for invoices (now migrated)
    await insertIntoUserTableData(tableId, processedData);
  }
} else {
  // Route to JSONB system for custom tables
  await insertIntoUserTableData(tableId, processedData);
}
```

### 3. Helper Function for JSONB Insertion

```javascript
async function insertIntoUserTableData(tableId, processedData) {
  const { data, error } = await supabase
    .from('user_table_data')
    .insert({
      table_id: tableId,
      data: processedData,
      created_at: new Date().toISOString()
    });
    
  if (error) throw error;
  return data;
}
```

## Table UUID Reference

### System Tables:
- **Business Cards**: `b7e8c9d0-1234-5678-9abc-def012345678`
  - Physical table: `business_cards`
  - Route: Direct insertion to physical table
  
- **Invoices**: `a1b2c3d4-1234-5678-9abc-def012345678`  
  - Legacy table: `invoices_backup` (renamed)
  - Route: JSONB insertion to `user_table_data`

### Custom Tables:
- All custom tables use JSONB system
- Route: JSONB insertion to `user_table_data`
- Schema available in `tableMeta.schema_definition`

## Migration Benefits

### ✅ Unified Interface
- Single webhook endpoint handles all table types
- No more hardcoded table routing
- Consistent upload UX across all tables

### ✅ Scalable Architecture  
- Adding new tables = data change, not code change
- Dynamic routing based on database configuration
- Future-proof for system expansion

### ✅ Backward Compatibility
- Existing business cards functionality preserved
- VCF export still works with physical table
- All existing data intact

## Testing Checklist

- [ ] Business Cards upload works (routes to physical table)
- [ ] Invoices upload works (routes to JSONB system)
- [ ] Custom table upload works (routes to JSONB system)
- [ ] Invalid table ID returns proper error
- [ ] All table types appear in upload dropdown
- [ ] Per-table upload buttons work correctly
- [ ] Upload modal pre-selects correct table

## Implementation Notes

1. **Error Handling**: Always validate table ID exists before processing
2. **Performance**: Consider caching table metadata for frequently used tables  
3. **Security**: Ensure user permissions are checked for table access
4. **Logging**: Add logging for table routing decisions for debugging

## Current Webhook URL
```
https://n8n.gbtradingllc.com/webhook/upload-files
```

**⚠️ IMPORTANT**: Use the **production** webhook URL (`/webhook/`) not the test URL (`/webhook-test/`).

- **Test URL**: Only works when n8n editor is open and listening
- **Production URL**: Always active when workflow is enabled

This webhook needs to be updated with the new routing logic above.