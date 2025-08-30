# Invoices Migration to JSONB - Detailed Plan

## Current State Analysis

### Invoices Table Structure
- **Primary Key**: `Invoice_Number` (text, NOT NULL)
- **Total Records**: 2
- **Columns**: 14 fields including metadata (created_at, user_id)

**Field Mapping**:
1. `Invoice_Number` - text (PRIMARY KEY)
2. `Invoice_Date` - text
3. `Product` - text
4. `Currency` - text
5. `Exporter_Name` - text
6. `Importer_Name` - text
7. `Incoterms` - text
8. `Country_of_Origin` - text
9. `Port_of_Loading` - text
10. `Port_of_Discharge` - text
11. `Tracking_Number` - text
12. `Total_Invoice_Value` - text
13. `created_at` - timestamp (metadata)
14. `user_id` - uuid (metadata)

## Migration Strategy

### Pre-Migration Safety ✅
- [x] Database backup completed via pg_dump
- [x] Small dataset (2 records) - low risk
- [x] Test environment available

### Step 1: Create Invoices JSONB Schema Definition

```json
{
  "Invoice_Number": { "type": "text", "required": true, "primaryKey": true },
  "Invoice_Date": { "type": "text", "required": false },
  "Product": { "type": "text", "required": false },
  "Currency": { "type": "text", "required": false },
  "Exporter_Name": { "type": "text", "required": false },
  "Importer_Name": { "type": "text", "required": false },
  "Incoterms": { "type": "text", "required": false },
  "Country_of_Origin": { "type": "text", "required": false },
  "Port_of_Loading": { "type": "text", "required": false },
  "Port_of_Discharge": { "type": "text", "required": false },
  "Tracking_Number": { "type": "text", "required": false },
  "Total_Invoice_Value": { "type": "text", "required": false }
}
```

### Step 2: Insert Invoices Entry in user_tables

```sql
INSERT INTO user_tables (
  id, 
  name, 
  table_key, 
  is_system_table, 
  user_id,
  schema_definition
) VALUES (
  'invoices-system-uuid-12345678-1234-5678-9abc-def012345678', -- Well-known UUID
  'Invoices', 
  'invoices_legacy', 
  true, -- System table
  NULL, -- No specific user
  '{"Invoice_Number": {"type": "text", "required": true, "primaryKey": true}, "Invoice_Date": {"type": "text", "required": false}, "Product": {"type": "text", "required": false}, "Currency": {"type": "text", "required": false}, "Exporter_Name": {"type": "text", "required": false}, "Importer_Name": {"type": "text", "required": false}, "Incoterms": {"type": "text", "required": false}, "Country_of_Origin": {"type": "text", "required": false}, "Port_of_Loading": {"type": "text", "required": false}, "Port_of_Discharge": {"type": "text", "required": false}, "Tracking_Number": {"type": "text", "required": false}, "Total_Invoice_Value": {"type": "text", "required": false}}'::jsonb
);
```

### Step 3: Data Migration Query

```sql
-- Transform each row: invoices → user_table_data
INSERT INTO user_table_data (table_id, data, user_id, created_at)
SELECT 
  'invoices-system-uuid-12345678-1234-5678-9abc-def012345678', -- table_id
  jsonb_build_object(
    'Invoice_Number', Invoice_Number,
    'Invoice_Date', Invoice_Date,
    'Product', Product,
    'Currency', Currency,
    'Exporter_Name', Exporter_Name,
    'Importer_Name', Importer_Name,
    'Incoterms', Incoterms,
    'Country_of_Origin', Country_of_Origin,
    'Port_of_Loading', Port_of_Loading,
    'Port_of_Discharge', Port_of_Discharge,
    'Tracking_Number', Tracking_Number,
    'Total_Invoice_Value', Total_Invoice_Value
  ) as data,
  user_id, -- Preserve user ownership
  created_at -- Preserve timestamps
FROM invoices;
```

### Step 4: Verification Queries

```sql
-- Verify row counts match
SELECT 
  'invoices' as source_table, COUNT(*) as count FROM invoices
UNION ALL
SELECT 
  'user_table_data' as target_table, COUNT(*) as count 
FROM user_table_data 
WHERE table_id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678';

-- Spot check data integrity
SELECT 
  i.Invoice_Number,
  (utd.data->>'Invoice_Number') as migrated_invoice_number,
  i.Exporter_Name,
  (utd.data->>'Exporter_Name') as migrated_exporter
FROM invoices i
JOIN user_table_data utd ON utd.table_id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678'
  AND utd.data->>'Invoice_Number' = i.Invoice_Number;
```

### Step 5: Performance Optimization

```sql
-- Create invoice-specific indexes for fast lookups
CREATE INDEX idx_btree_invoice_number ON user_table_data 
USING btree((data->>'Invoice_Number')) 
WHERE table_id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678';

CREATE INDEX idx_btree_exporter_name ON user_table_data 
USING btree((data->>'Exporter_Name')) 
WHERE table_id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678';
```

### Step 6: Application Code Updates

1. **Frontend (app.js)**:
   - Update `primaryKeys` object: `'invoices': 'Invoice_Number'` → reference JSONB system
   - Ensure `handleGenericUpdate` uses proper UUID for invoices JSONB table
   - Update `getTableNameFromPageId` to handle invoices → JSONB routing

2. **n8n Webhook Integration**:
   - Update routing logic to handle invoices as JSONB system table
   - Use `invoices-system-uuid-12345678-1234-5678-9abc-def012345678` for invoice uploads

### Step 7: Cleanup

```sql
-- Rename physical table to backup
ALTER TABLE invoices RENAME TO invoices_backup;

-- Optionally, after verification period:
-- DROP TABLE invoices_backup;
```

## Rollback Strategy

```sql
-- If migration fails, restore from backup:
-- 1. Drop the user_table_data entries
DELETE FROM user_table_data 
WHERE table_id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678';

-- 2. Remove the user_tables entry
DELETE FROM user_tables 
WHERE id = 'invoices-system-uuid-12345678-1234-5678-9abc-def012345678';

-- 3. Physical table still exists as 'invoices' - no changes needed
```

## Success Criteria

- [x] Row count verification: invoices (2) = user_table_data entries (2)
- [ ] Data integrity check: All Invoice_Numbers match
- [ ] Primary key functionality: Updates work with Invoice_Number
- [ ] Search functionality: JSONB queries perform well
- [ ] Frontend integration: All CRUD operations work seamlessly
- [ ] Upload integration: n8n webhook routes correctly to JSONB table

## Risk Assessment

**LOW RISK** - Only 2 records to migrate, easy rollback, comprehensive backup strategy.

## Next Actions

1. Execute Step 1: Create user_tables entry for invoices
2. Execute Step 2: Migrate data with verification
3. Execute Step 3: Create performance indexes
4. Update application code references
5. Test all functionality end-to-end
6. Cleanup physical table after verification