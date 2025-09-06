# Current Tasks: Mobile Navbar Redesign

## Objective
Redesign the mobile-view bottom navbar to add "Billing" and fix text positioning issues.

## Requirements
1. **Add Billing Element**: Add "Billing" to the rightmost position
2. **Reorder Elements**: Tables > Create Table > Digitize > Billing (left to right)
3. **Fix Digitize Text**: Raise the "Digitize" text to sit directly under the icon (currently appears outside yellow circle)

## Implementation Plan

### Task 1: Update HTML Structure ✅ COMPLETED
- [x] Locate the mobile navbar container element
- [x] Reorder child elements to match new sequence: Tables, Create Table, Digitize, Billing
- [x] Remove Settings button to maintain 4-item layout (Billing already existed)
- [x] Ensure consistent internal structure across all nav items

### Task 2: Adjust CSS for Four-Item Layout ✅ COMPLETED
- [x] Main navbar container already uses proper flexbox with `justify-content: space-around`
- [x] Layout automatically distributes 4 items evenly
- [x] Responsive behavior maintained across mobile viewports

### Task 3: Fix Digitize Text Positioning ✅ COMPLETED
- [x] Enhanced `.nav-center .nav-btn` styling for proper centering
- [x] Added specific `.nav-center .nav-btn .nav-label` styling with improved positioning
- [x] Fixed digitize icon centering with flexbox properties
- [x] Text now positioned directly under yellow circle icon

### Task 4: Accessibility & Final Polish ✅ COMPLETED
- [x] Semantic HTML structure maintained (nav element, button tags)
- [x] All buttons have proper `aria-label` attributes
- [x] Enhanced focus states with visible outline for keyboard navigation
- [x] Touch targets are properly sized (56px for center button, adequate spacing for others)

## Technical Notes
- Use flexbox for layout reliability
- Maintain consistent vertical stacking (icon over text)
- Ensure the yellow circle container doesn't push text down
- Consider creating a git branch: `feature/mobile-nav-redesign`