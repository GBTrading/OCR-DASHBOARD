# Schema Label Update Plan

## Problem Statement
The user wants to allow editing of display labels in the `schema_definition` JSONB column of the `user_tables` table without affecting the underlying data structure or migrating any data in `user_table_data`.

## Current Schema Structure
```json
schema_definition: [
  {"name": "product_name", "type": "text", "label": "Product"},
  {"name": "price", "type": "number", "label": "Price"},
  {"name": "description", "type": "text", "label": "Description"}
]
```

## Requirements
- Update only the `label` field for a specific object in the schema array
- Find the object by its stable `name` key
- No data migration needed in `user_table_data`
- Maintain security with user ownership validation

## Solution: PostgreSQL RPC Function

### Function Implementation
```sql
create or replace function update_schema_field_label(
    target_table_id uuid,
    target_field_name text,
    new_label text
)
returns boolean -- Return boolean to indicate if the update was successful
language plpgsql
security definer
as $$
begin
  update public.user_tables
  set
    schema_definition = (
      select
        jsonb_agg(
          case
            -- If the element's 'name' matches our target, update its 'label'
            when (elem->>'name') = target_field_name
            then jsonb_set(elem, '{label}', to_jsonb(new_label))
            -- Otherwise, return the element unchanged
            else elem
          end
        )
      from jsonb_array_elements(schema_definition) as elem
    ),
    updated_at = now()
  where
    id = target_table_id
    and user_id = auth.uid()
    -- Only proceed if an object with the target name actually exists
    and jsonb_path_exists(
        schema_definition,
        '$[*] ? (@.name == $target_name)',
        jsonb_build_object('target_name', target_field_name)
    );

  -- Return true if a field was found and updated, false otherwise
  return FOUND;
end;
$$;
```

### Function Features
1. **Security**: Uses `auth.uid()` to ensure users can only modify their own tables
2. **Efficiency**: Only performs write if the target field exists (prevents no-op updates)
3. **Feedback**: Returns boolean indicating success/failure
4. **Atomicity**: Single UPDATE statement ensures transactional safety
5. **Immutable Data**: Only touches `user_tables`, never `user_table_data`

### Usage Example
```javascript
const { data, error } = await supabase.rpc('update_schema_field_label', {
  target_table_id: 'uuid-of-table',
  target_field_name: 'product_name',
  new_label: 'Product Name'
});

if (data) {
  console.log('Label updated successfully');
} else {
  console.log('Field not found or update failed');
}
```

## Implementation Steps
1. Deploy the PostgreSQL function to Supabase
2. Update frontend to call this RPC function instead of direct updates
3. Add error handling for invalid field names or unauthorized access
4. Test with various scenarios (existing fields, non-existing fields, unauthorized access)

## Recommended Database Constraint
Add a unique constraint to prevent duplicate field names in schema definitions:
```sql
ALTER TABLE user_tables
ADD CONSTRAINT check_unique_field_names
CHECK (
  (
    SELECT COUNT(DISTINCT elem->>'name') = COUNT(*)
    FROM jsonb_array_elements(schema_definition) AS elem
    WHERE elem->>'name' IS NOT NULL
  )
);
```

## Benefits
- **Simple**: Minimal code complexity
- **Safe**: No risk of data corruption
- **Fast**: Single update operation
- **Secure**: Built-in user ownership validation
- **Reliable**: Clear success/failure feedback