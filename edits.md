# Usecase Page Improvements (`edits.md`)

This document outlines the planned edits for the `usecase.html` page. Tasks are prioritized to deliver value incrementally, starting with the quickest fixes.

---

## P1: Content & High-Impact Fixes (Implement First)

These tasks are straightforward and have a direct impact on content accuracy and user experience.

### Task 1: Update Accuracy Statistics ✅ COMPLETED

- [x] **File:** `usecase.html`
- [x] **Goal:** Change all instances of "99.2% accuracy" to "99.8% accuracy".

#### Implementation Details:

1.  **Hero Section:**
    - **Location:** `usecase.html` (within the main hero section).
    - **Find:** Text node containing `99.2% accuracy`.
    - **Change From:** `99.2%`
    - **Change To:** `99.8%`

2.  **Receipt Scanner Card:**
    - **Location:** `usecase.html` (inside the "Receipt Scanner" card's feature list).
    - **Find:** The feature item mentioning accuracy.
    - **Change From:**
      ```html
      <span>99.2% accuracy rate</span>
      ```
    - **Change To:**
      ```html
      <span>99.8% accuracy rate</span>
      ```

3.  **Benefits Overview Section:**
    - **Location:** `usecase.html` (within the benefits grid).
    - **Find:** Any remaining "99.2%" references in benefit descriptions.
    - **Change From:** `99.2%`
    - **Change To:** `99.8%`

### Task 2: Fix UI Alignment Issues ✅ COMPLETED

- [x] **File:** `usecase.html`
- [x] **Goal:** Correct vertical alignment for feature items using Tailwind's flexbox utilities. This ensures consistency and scalability.

#### Implementation Details:

1.  **Receipt Scanner Card Alignment:**
    - **Location:** `usecase.html` (inside the "Receipt Scanner" card).
    - **Issue:** The "99.8% accuracy rate" text and its icon are misaligned.
    - **Proposed Fix:** Ensure the parent `div` is a flex container with centered alignment and consistent spacing.
    - **Find (example):**
      ```html
      <div class="feature-item">
        <span class="material-icons">accuracy</span>
        <span>99.8% accuracy rate</span>
      </div>
      ```
    - **Replace/Ensure:**
      ```html
      <div class="feature-item flex items-center gap-2">
        <span class="material-icons">accuracy</span>
        <span>99.8% accuracy rate</span>
      </div>
      ```
    - **Note:** Using `gap-2` on the parent is cleaner than adding a margin to the icon. It provides consistent spacing and simplifies the markup.

2.  **Invoice Processing Card Alignment:**
    - **Location:** `usecase.html` (inside the "Invoice Processing" card).
    - **Issue:** The "Smart data extraction" feature item is misaligned.
    - **Proposed Fix:** Apply the same `flex items-center gap-2` pattern.
    - **Find (example):**
      ```html
      <div class="feature-item">
        <span class="material-icons">data_extraction</span>
        <span>Smart data extraction</span>
      </div>
      ```
    - **Replace/Ensure:**
      ```html
      <div class="feature-item flex items-center gap-2">
        <span class="material-icons">data_extraction</span>
        <span>Smart data extraction</span>
      </div>
      ```

3.  **Apply Consistent Pattern to All Feature Items:**
    - **Location:** All use case cards in `usecase.html`
    - **Goal:** Ensure all feature-item divs follow the same alignment pattern
    - **Pattern to Apply:**
      ```html
      <div class="feature-item flex items-center gap-2">
        <span class="material-icons">[icon-name]</span>
        <span>[feature-text]</span>
      </div>
      ```

### ✅ P1 Testing Checkpoint

- [x] **Content:** Scan the page to confirm all "99.2%" instances are updated to "99.8%".
- [x] **Alignment:** View the "Receipt Scanner" and "Invoice Processing" cards on both desktop and mobile viewports. Confirm the icons and text in the specified feature items are perfectly centered vertically.
- [x] **Regression:** Briefly check other feature items to ensure the changes haven't introduced any unintended layout shifts.

---

## P2: Feature Enhancement

This task introduces new functionality and should be tackled after the P1 fixes are complete.

### Task 3: Implement Mini-Directory Navigation ✅ COMPLETED

- [x] **File:** `usecase.html`
- [x] **Goal:** Add a navigation list that allows users to jump to each use case card, with a smooth scrolling animation.

#### Implementation Steps:

1.  **Add `id` attributes and scroll-margin to each use case card.**
    - **Location:** On the container `div` for each of the 5 use case cards.
    - **Code to Add:**
      - `id="receipt-scanner"`
      - `id="business-card-scanner"`
      - `id="invoice-processing"`
      - `id="form-extraction"`
      - `id="resume-parser"`
    - **Example for Receipt Scanner:**
      ```html
      <article class="use-case-card scroll-mt-20" id="receipt-scanner">
        <!-- Card content -->
      </article>
      ```
    - **Note:** The `scroll-mt-20` class adds a top margin of `5rem` during scrolling to account for the sticky header.

2.  **Insert the mini-directory HTML.**
    - **Location:** `usecase.html`, inside the "Explore Our Use Cases" section, just below the section header.
    - **Insert After:** `<p>Choose the use case that matches your needs and discover how OCR can transform your workflow</p>`
    - **Proposed Code:**
      ```html
      <!-- Use Case Directory Navigation -->
      <nav class="use-case-directory" aria-label="Jump to Use Case">
        <ul class="flex flex-wrap justify-center gap-3 md:gap-4 my-8">
          <li>
            <a href="#receipt-scanner" class="directory-link px-4 py-2 bg-gray-100 hover:bg-[#FEE715] hover:text-[#101820] rounded-full transition-all duration-300 text-sm font-medium border border-gray-200 hover:border-[#FEE715]">
              📄 Receipt Scanner
            </a>
          </li>
          <li>
            <a href="#business-card-scanner" class="directory-link px-4 py-2 bg-gray-100 hover:bg-[#FEE715] hover:text-[#101820] rounded-full transition-all duration-300 text-sm font-medium border border-gray-200 hover:border-[#FEE715]">
              💼 Business Cards
            </a>
          </li>
          <li>
            <a href="#invoice-processing" class="directory-link px-4 py-2 bg-gray-100 hover:bg-[#FEE715] hover:text-[#101820] rounded-full transition-all duration-300 text-sm font-medium border border-gray-200 hover:border-[#FEE715]">
              📊 Invoice Processing
            </a>
          </li>
          <li>
            <a href="#form-extraction" class="directory-link px-4 py-2 bg-gray-100 hover:bg-[#FEE715] hover:text-[#101820] rounded-full transition-all duration-300 text-sm font-medium border border-gray-200 hover:border-[#FEE715]">
              📋 Form Extraction
            </a>
          </li>
          <li>
            <a href="#resume-parser" class="directory-link px-4 py-2 bg-gray-100 hover:bg-[#FEE715] hover:text-[#101820] rounded-full transition-all duration-300 text-sm font-medium border border-gray-200 hover:border-[#FEE715]">
              👤 Resume Parser
            </a>
          </li>
        </ul>
      </nav>
      ```

3.  **Enable Smooth Scrolling (CSS-only).**
    - **Location:** Already exists in `usecase.html` - verify it's present in existing JavaScript scroll behavior.
    - **Fallback:** If not present, add to the existing `<script>` section at bottom of page:
      ```javascript
      // Ensure smooth scrolling for anchor links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
          anchor.addEventListener('click', function (e) {
              e.preventDefault();
              const target = document.querySelector(this.getAttribute('href'));
              if (target) {
                  target.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start'
                  });
              }
          });
      });
      ```

4.  **Add Active State Highlighting (Optional Enhancement):**
    - **Location:** Add to existing JavaScript section in `usecase.html`.
    - **Code to Add:**
      ```javascript
      // Active state highlighting for use case directory
      const useCaseSections = document.querySelectorAll('.use-case-card');
      const directoryLinks = document.querySelectorAll('.directory-link');

      const observerOptions = {
          root: null,
          rootMargin: '-20% 0px -60% 0px', // Trigger when section is 20% visible from top
          threshold: 0.1
      };

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const id = entry.target.getAttribute('id');
                  const activeLink = document.querySelector(`.directory-link[href="#${id}"]`);
                  
                  // Remove active class from all links
                  directoryLinks.forEach(link => {
                      link.classList.remove('bg-[#FEE715]', 'text-[#101820]', 'border-[#FEE715]');
                      link.classList.add('bg-gray-100', 'border-gray-200');
                  });
                  
                  // Add active class to current link
                  if (activeLink) {
                      activeLink.classList.remove('bg-gray-100', 'border-gray-200');
                      activeLink.classList.add('bg-[#FEE715]', 'text-[#101820]', 'border-[#FEE715]');
                  }
              }
          });
      }, observerOptions);

      useCaseSections.forEach(section => {
          observer.observe(section);
      });
      ```

### ✅ P2 Testing Checkpoint

- [x] **Functionality:** Click each link in the new directory. Confirm it scrolls smoothly to the top of the corresponding use case card.
- [x] **Offset:** Verify that the `scroll-mt-20` value correctly accounts for the sticky header - no content should be hidden.
- [x] **Responsiveness:** Resize browser to mobile width. Directory links should wrap gracefully and remain clickable.
- [x] **Active State:** As you scroll through the page, the corresponding directory link should highlight automatically.
- [x] **Accessibility:** Confirm the `nav` element and its `aria-label` work with screen readers.

---

## P3: Polish & Final Testing

### Task 4: Visual Refinements

- [ ] **Spacing:** Ensure consistent spacing around the new directory navigation.
- [ ] **Color Consistency:** Verify all hover states match the site's design system colors.
- [ ] **Typography:** Check that font weights and sizes are consistent with the rest of the page.

### Task 5: Cross-Browser Testing

- [ ] **Chrome:** Test all functionality and visual alignment.
- [ ] **Firefox:** Test smooth scrolling and active states.
- [ ] **Safari:** Verify Tailwind classes render correctly.
- [ ] **Mobile Safari/Chrome:** Test touch scrolling behavior.

### Task 6: Performance Check

- [ ] **Scroll Performance:** Ensure smooth scrolling doesn't cause frame drops.
- [ ] **JavaScript Efficiency:** Verify IntersectionObserver doesn't impact page performance.
- [ ] **CSS Optimization:** Check that new classes don't cause layout thrashing.

---

## Implementation Priority Order

1. **First:** Task 1 (Update accuracy statistics) - Quick content fix
2. **Second:** Task 2 (Fix alignment issues) - UI consistency 
3. **Third:** Task 3 (Mini-directory navigation) - New feature
4. **Fourth:** Task 4-6 (Polish and testing) - Quality assurance

---

## Files Modified

- [x] `edits.md` - This planning document
- [ ] `usecase.html` - Main implementation file
- [ ] Testing on multiple browsers and devices

---

**Total Estimated Time:** 2-3 hours
**Complexity:** Medium (mostly Tailwind CSS classes and simple JavaScript)
**Risk Level:** Low (non-breaking changes, progressive enhancements)