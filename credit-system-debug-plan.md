# Credit System Debug & Fix Plan

## Issue Summary
Payments are processing successfully through Stripe, but credits are not being added to users' `credits_remaining` column. The webhook handler appears comprehensive but credits aren't reaching the database.

## Phase 1: Immediate Diagnostics (Do First)

### 1. Check Stripe Webhook Delivery Logs
- Go to Stripe Dashboard → Developers → Webhooks
- Find recent successful payment events (200 OK status)
- Verify `client_reference_id` is present and matches valid user UUID
- Confirm `metadata.plan_type` exists with expected values

### 2. Add Enhanced Logging to Webhook
- Modify `api/stripe-webhook.js` to log exact parameters before `supabase.rpc()` call
- Log the complete response including `data` and `error` fields
- Add validation checks for `userId` and `creditsToAdd` before RPC call

### 3. Test RPC Function Directly
- Run in Supabase SQL Editor:
```sql
SELECT * FROM add_credits(
  p_user_id := 'YOUR_USER_UUID_HERE'::uuid,
  p_credits_to_add := 100,
  p_plan_type := 'basic'
);
```

## Phase 2: Database Function Verification

### 4. Verify Function Permissions
- Check if `add_credits` function exists and has `SECURITY DEFINER`
```sql
SELECT proname, prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE proname = 'add_credits';
```

### 5. Check for Datatype Issues
- Ensure UUID casting from string to UUID is handled properly
- Verify column names match (`credits_remaining`)
- Check for case sensitivity issues

### 6. Review RLS Policies
- Check Row Level Security policies on user/credits tables
- Ensure service role key bypasses RLS or function runs with `SECURITY DEFINER`

### 7. Add Row Count Verification
- Modify function to return affected row count
- Log when 0 rows are updated (silent failures)

## Phase 3: Webhook Improvements

### 8. Implement Idempotency Protection
- Create `processing_events` table check using `event.id`
- Prevent duplicate credit additions from webhook retries

### 9. Add Comprehensive Error Handling
- Check for `data` content and row counts, not just `error` field
- Add timeout protection for Supabase calls
- Implement proper HTTP status responses

### 10. Create Webhook Replay Endpoint
- Add authenticated endpoint to replay failed webhook events
- Fetch events from Stripe API for debugging

## Phase 4: Client-Side Verification

### 11. Verify client_reference_id Setting
- Check `app.js` checkout session creation
- Ensure `client_reference_id` is set to current user ID
- Add logging to confirm user ID is passed correctly

### 12. Add Client-Side Logging
- Log checkout session creation parameters
- Verify user authentication state before payment

## Key Files to Modify
- `api/stripe-webhook.js` - Enhanced logging and error handling
- Supabase RPC function `add_credits` - Permissions and logic verification
- `app.js` - Client-side checkout session creation verification

## Expected Outcomes
This systematic approach will identify whether the issue is:
- Webhook handling (missing parameters, environment issues)
- Database function (permissions, RLS, datatype mismatches)
- Client-side setup (missing client_reference_id)

## Priority Order
1. Stripe webhook logs verification (immediate)
2. Direct RPC function test (critical)
3. Enhanced webhook logging (implementation)
4. Database permissions audit (fix)