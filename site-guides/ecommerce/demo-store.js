/**
 * Site Guide: Demo E-Commerce Stores
 * Per-site guide for test/demo checkout flows used in CONTEXT-05 validation.
 * Targets stores with multi-step checkout, zip-based tax calculation, no auth required.
 */

registerSiteGuide({
  site: 'Demo E-Commerce Store',
  category: 'E-Commerce & Shopping',
  patterns: [
    /demo\.opencart\.com/i,
    /automationexercise\.com/i,
    /automationteststore\.com/i,
    /saucedemo\.com/i,
    /practicesoftwaretesting\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-05):
- [context] Use clear_input BEFORE type_text when correcting form fields
- [context] Capture order summary at BOTH checkpoints: pre-correction and post-correction
- [context] Store compact {step, zip, subtotal, tax, total} records per checkpoint
- [context] Tax may only appear on review/summary step, not on the form step
- [context] Handle form reset on back navigation -- re-fill ALL required fields

DEMO E-COMMERCE STORE INTELLIGENCE:

TARGET SELECTION (CONTEXT-05):
- Primary target: automationexercise.com -- free, no auth required for checkout, multi-step checkout with address fields
- Fallback 1: automationteststore.com (AbanteCart demo) -- open-source demo store with full checkout flow
- Fallback 2: demo.opencart.com -- OpenCart demo with guest checkout option
- Fallback 3: practicesoftwaretesting.com -- Practice Software Testing demo with checkout flow
- Fallback 4: saucedemo.com -- Sauce Labs demo store (requires demo login: standard_user / secret_sauce)
- All targets have multi-step checkout with shipping address form including zip/postal code field
- SKIP-AUTH: if all targets require login with no guest checkout, document as skip-auth outcome

MULTI-STEP CHECKOUT WITH CORRECTION (CONTEXT-05):
- This workflow tests FORM STATE MANAGEMENT: fill checkout form, make a deliberate mistake (wrong zip), detect the mistake, correct it, and verify downstream effects (tax recalculation)
- The challenge is CONTEXT RETENTION across checkout steps: remember the initial tax amount, then compare after correction
- Strategy: capture order summary numbers (subtotal, tax, shipping, total) BEFORE correction and AFTER correction, compare tax values

ZIP CODE CORRECTION MECHANICS:
- Step 1: Type the WRONG zip code (e.g., "00000" or "99999" or a zip from a different state)
- Step 2: Submit/continue to trigger tax calculation with wrong zip
- Step 3: Read the tax amount and total -- store as "pre-correction" values
- Step 4: Navigate back to shipping form (click "Edit" or "Change" or back button)
- Step 5: Use clear_input on the zip field to remove the wrong value
- Step 6: Use type_text to enter the CORRECT zip code (e.g., "10001" for New York or "90210" for California)
- Step 7: Submit/continue to trigger tax recalculation
- Step 8: Read the NEW tax amount and total -- store as "post-correction" values
- Step 9: Compare: tax should differ between wrong zip and correct zip (different states have different tax rates)

VERIFICATION CRITERIA:
- PASS = checkout form navigated, wrong zip entered, tax observed, zip corrected, NEW tax observed, tax values differ
- PARTIAL = checkout reached but correction or tax comparison incomplete
- FAIL = could not reach checkout or could not enter zip
- SKIP-AUTH = all targets require authentication with no guest checkout available

WRONG ZIP STRATEGY:
- Use zip "00000" (invalid) as the intentionally wrong zip -- some stores may reject it with validation error
- Alternative wrong zip: "99501" (Alaska) -- valid but has no state sales tax, so tax should be $0.00 or very low
- Correct zip: "10001" (New York, NY) -- has state + city tax (~8.875%), or "90210" (Beverly Hills, CA) -- has state + county tax (~9.5%)
- The key is that WRONG and CORRECT zips are in DIFFERENT tax jurisdictions, producing different tax amounts
- If a demo store has flat tax regardless of zip: document this as "no zip-based tax variation" and classify as PARTIAL

CONTEXT BLOAT MITIGATION FOR CHECKOUT:
- Checkout pages have extensive forms, promotions, and footer content
- Do NOT read full page DOM at each step -- use targeted read_page with order summary selectors only
- Key data to extract per step: subtotal, tax amount, shipping cost, order total (4 numbers, under 200 characters)
- Store compact: {step: "pre-correction", zip: "00000", subtotal: "$X", tax: "$Y", total: "$Z"}
- After correction: {step: "post-correction", zip: "10001", subtotal: "$X", tax: "$Y2", total: "$Z2"}
- Total context for comparison: under 500 characters`,
  selectors: {
    // automationexercise.com selectors
    addToCart: '.btn.btn-default.add-to-cart, .add-to-cart, [data-product-id]',
    viewCart: 'a[href="/view_cart"], .cart_nav_link, a:has-text("Cart")',
    proceedToCheckout: '.btn.btn-default.check_out, a:has-text("Proceed To Checkout"), .checkout-btn',
    addressForm: '#address_delivery, .shipping-address, form[action*="checkout"]',
    zipInput: 'input[name="zipcode"], input[name="zip"], input[name="postcode"], input[name="postal_code"], #zip, #postcode',
    cityInput: 'input[name="city"], #city',
    stateInput: 'input[name="state"], select[name="state"], #state, select[name="zone_id"]',
    countrySelect: 'select[name="country"], select[name="country_id"], #country',
    continueButton: '.btn.btn-default, input[type="submit"], button[type="submit"], .continue-btn, a:has-text("Continue")',
    orderSummary: '.cart_total_price, .order-summary, .cart-total, #order-summary',
    taxAmount: '.tax-amount, td:has-text("Tax"), .order-tax, span:has-text("Tax")',
    totalAmount: '.total-amount, td:has-text("Total"), .order-total, span:has-text("Total")',
    subtotalAmount: '.subtotal, td:has-text("Sub Total"), span:has-text("Subtotal")',
    editAddress: 'a:has-text("Edit"), a:has-text("Change"), button:has-text("Edit")',
    placeOrder: '.btn.btn-default.check_out, button:has-text("Place Order"), input[value="Place Order"]',
    // automationteststore.com (AbanteCart) selectors
    abcAddToCart: '.productcart, .cart, a.btn.call-to-action',
    abcCheckoutBtn: '#cart_checkout, a[href*="checkout"], .btn-orange',
    abcGuestCheckout: '#accountFrm_accountguest, input[value="guest"]',
    abcZipInput: '#guestFrm_postcode, #Address1Frm_postcode, input[name="postcode"]',
    abcContinueBtn: 'button[title="Continue"], input[title="Continue"], .btn-orange',
    // opencart demo selectors
    ocAddToCart: '#button-cart, button:has-text("Add to Cart")',
    ocCheckout: '#content a:has-text("Checkout"), a[href*="checkout"]',
    ocGuestRadio: 'input[name="account"][value="guest"]',
    ocZipInput: '#input-payment-postcode, #input-shipping-postcode, input[name="postcode"]',
    ocTaxLine: '.table-bordered tr:has(td:has-text("Tax"))',
    ocTotalLine: '.table-bordered tr:has(td:has-text("Total"))'
  },
  workflows: {
    multiStepCheckoutWithCorrection: [
      'SETUP: Navigate to the demo store homepage. Primary target: automationexercise.com. If inaccessible, try fallbacks in order.',
      'PRODUCT SELECTION: Find any product on the homepage or product listing page. Click "Add to Cart" or equivalent button.',
      'VIEW CART: Navigate to the shopping cart page. Verify at least 1 item is in the cart with a visible price.',
      'PROCEED TO CHECKOUT: Click "Proceed to Checkout" or equivalent. If login required, try guest checkout option first. If no guest option, try saucedemo.com with standard_user/secret_sauce credentials.',
      'FILL SHIPPING -- WRONG ZIP: Fill the shipping/billing address form with test data: Name="Test User", Address="123 Test St", City="Anchorage", State="Alaska" (or AK), Country="United States", Zip="99501" (Alaska -- no state sales tax). This is the INTENTIONALLY WRONG zip for the correction scenario.',
      'SUBMIT SHIPPING: Click Continue/Submit to advance past shipping form. Wait for order summary or next checkout step to load.',
      'CAPTURE PRE-CORRECTION TAX: Use read_page with order summary selectors to extract: subtotal, tax amount, shipping cost, total. Store as pre_correction = {zip: "99501", subtotal: "$X", tax: "$Y", total: "$Z"}. If tax is not shown yet, advance to review/payment step where totals are displayed.',
      'NAVIGATE BACK TO EDIT ZIP: Click "Edit" address link, browser back button, or navigate to the shipping form step to re-edit the zip code.',
      'CORRECT THE ZIP: Use clear_input on the zip code field to remove "99501". Then use type_text to enter "10001" (New York, NY -- has ~8.875% sales tax). Update city to "New York" and state to "New York" (or NY) to match.',
      'RESUBMIT SHIPPING: Click Continue/Submit again to advance with corrected zip. Wait for order summary to reload.',
      'CAPTURE POST-CORRECTION TAX: Use read_page with same order summary selectors. Store as post_correction = {zip: "10001", subtotal: "$X", tax: "$Y2", total: "$Z2"}.',
      'COMPARE TAX VALUES: Compare pre_correction.tax vs post_correction.tax. They should differ because Alaska (99501) has 0% state tax and New York (10001) has ~8.875% state+city tax.',
      'STOP BEFORE PAYMENT: Do NOT enter payment details or place the order. The test is complete at tax comparison.',
      'REPORT: State outcome (PASS/PARTIAL/FAIL/SKIP-AUTH) with pre-correction and post-correction tax values.'
    ],
    addToCartAndCheckout: [
      'Navigate to the store homepage',
      'Find a product and click Add to Cart',
      'Navigate to cart page',
      'Click Proceed to Checkout or equivalent',
      'Choose guest checkout if available',
      'Fill shipping address form',
      'Submit and review order summary'
    ]
  },
  warnings: [
    'Demo stores may be slow or temporarily down -- try fallback targets if primary is unavailable',
    'Some demo stores reset data periodically -- cart contents may not persist across sessions',
    'Guest checkout may not be available on all demo stores -- saucedemo.com requires demo login (standard_user / secret_sauce)',
    'Tax calculation varies: some demo stores have flat tax regardless of zip, some have no tax at all -- document the behavior',
    'For CONTEXT-05: do NOT enter real payment information. Stop after tax comparison step.',
    'For CONTEXT-05 (checkout correction): use clear_input to remove wrong zip before typing correct zip. Do NOT just append -- the field must be fully cleared first.',
    'Zip correction may require re-filling other address fields if the form resets on back navigation -- re-enter all required fields if needed'
  ],
  toolPreferences: ['click', 'type_text', 'clear_input', 'read_page', 'get_attribute', 'navigate', 'wait_for_stable', 'scroll']
});
