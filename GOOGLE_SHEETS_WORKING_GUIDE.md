# Google Sheets Integration - The Method That Actually Works

This guide documents the **proven, working method** for sending form data from a website to Google Sheets without CORS errors.

## Why Previous Methods Failed

### ❌ JSON + CORS Headers Approach
```javascript
// THIS DOESN'T WORK RELIABLY
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

**Problems:**
- `Content-Type: application/json` triggers browser **preflight request**
- Preflight requires perfect CORS headers on Apps Script
- Even with `doOptions()` function, still unreliable
- 403 errors on localhost and sometimes production

### ✅ FormData + no-cors Approach
```javascript
// THIS WORKS PERFECTLY
const formData = new FormData();
formData.append('email', email);

fetch(url, {
  method: 'POST',
  mode: 'no-cors',
  body: formData
})
```

**Why it works:**
- `FormData` = simple POST, **no preflight required**
- `mode: 'no-cors'` = browser doesn't check CORS headers
- Direct data submission, no JSON parsing needed
- Works on localhost AND production

---

## The Working Solution (Step-by-Step)

### Step 1: Create Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Create new sheet: **"Meturferse"**
3. Create two tabs:

**Tab 1: "Meturferse Email List"**
```
A1: Timestamp
B1: Email Address
```

**Tab 2: "Meturferse Feedback"**
```
A1: Timestamp
B1: Feature Request
C1: Email Address
```

---

### Step 2: Create Apps Script (The Working Version)

1. In your sheet: **Extensions** → **Apps Script**
2. Delete existing code
3. Paste this **exact code**:

```javascript
function doPost(e) {
  try {
    // Get timestamp
    const timestamp = new Date();

    // e.parameter comes from FormData (NOT e.postData.contents)
    const email = e.parameter.email || '';
    const feedback = e.parameter.feedback || '';

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Log email to Email List tab (if email provided)
    if (email) {
      const emailSheet = ss.getSheetByName('Meturferse Email List');
      if (emailSheet) {
        emailSheet.appendRow([timestamp, email]);
      }
    }

    // Log feedback to Feedback tab (if feedback provided)
    if (feedback) {
      const feedbackSheet = ss.getSheetByName('Meturferse Feedback');
      if (feedbackSheet) {
        feedbackSheet.appendRow([timestamp, feedback, email]);
      }
    }

    // Return success
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }));

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: String(error) }));
  }
}
```

**Key Points:**
- ✅ Uses `e.parameter` (for FormData)
- ✅ NO CORS headers needed
- ✅ Simple, reliable `appendRow()`
- ✅ Works with `mode: 'no-cors'`

4. **Save**: File → Save
5. Name it: "Meturferse Feedback Handler"

---

### Step 3: Deploy Apps Script

1. Click **Deploy** → **New deployment**
2. Click gear ⚙️ → Select **Web app**
3. Configure:
   - **Description**: "Meturferse Feedback v1"
   - **Execute as**: **Me**
   - **Who has access**: **Anyone**
4. Click **Deploy**
5. Authorize if prompted
6. **Copy the Web app URL**
   - Example: `https://script.google.com/macros/s/[SCRIPT_ID]/exec`

---

### Step 4: Update Website Code

In `main.js`, find the feedback form submission handler and replace the fetch implementation:

```javascript
// ❌ OLD WAY (doesn't work)
const data = {
  email: emailValue,
  feedback: feedbackValue
};

const response = await fetch(GOOGLE_SHEETS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

```javascript
// ✅ NEW WAY (works perfectly)
// Prepare FormData
const formData = new FormData();
formData.append('email', emailValue);
formData.append('feedback', feedbackValue);

// Submit with no-cors
const response = await fetch(GOOGLE_SHEETS_URL, {
  method: 'POST',
  mode: 'no-cors',
  body: formData
});

// Note: With no-cors, we can't read response
// Assume success if no error thrown
console.log('Feedback submitted successfully');
showFeedbackMessage('success', 'Thank you for your feedback!');
```

---

## Complete Working Example

Here's the full form submission handler:

```javascript
feedbackForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailValue = feedbackEmail.value.trim();
  const feedbackValue = feedbackText.value.trim();

  // Validate at least one field is filled
  if (!emailValue && !feedbackValue) {
    showFeedbackMessage('error', 'Please fill in at least one field');
    return;
  }

  // Validate email format if provided
  if (emailValue && !isValidEmail(emailValue)) {
    showFeedbackMessage('error', 'Please enter a valid email address');
    return;
  }

  // Disable submit button during submission
  feedbackSubmitBtn.disabled = true;
  feedbackSubmitBtn.textContent = 'Submitting...';

  try {
    // Prepare FormData (NOT JSON!)
    const formData = new FormData();
    formData.append('email', emailValue);
    formData.append('feedback', feedbackValue);

    // Submit to Google Sheets
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',  // Critical: bypasses CORS
      body: formData    // Critical: no JSON
    });

    // Show success message
    showFeedbackMessage('success', 'Thank you for your feedback!');

    // Check if "Don't show again" is checked
    if (dontShowAgain.checked) {
      localStorage.setItem('feedbackPopupDismissed', 'true');
    }

    // Close popup after 2 seconds
    setTimeout(() => {
      closeFeedbackPopup();
    }, 2000);

  } catch (error) {
    console.error('Error submitting feedback:', error);
    showFeedbackMessage('error', 'Failed to submit. Please try again.');
    feedbackSubmitBtn.disabled = false;
    feedbackSubmitBtn.textContent = 'Submit';
  }
});
```

---

## Why This Method Works

### Technical Explanation

1. **FormData = Simple Request**
   - Browser treats it as a simple form POST
   - No preflight OPTIONS request sent
   - No CORS validation needed

2. **mode: 'no-cors' = No CORS Checking**
   - Browser doesn't read response
   - Doesn't validate CORS headers
   - Request goes through regardless

3. **e.parameter in Apps Script**
   - Automatically parses FormData fields
   - No need for `JSON.parse()`
   - Direct access: `e.parameter.email`

4. **Universal Compatibility**
   - Works on localhost
   - Works on production
   - Works on Netlify, Vercel, etc.
   - No environment-specific issues

---

## Testing Your Setup

### Option 1: Test from Apps Script
```javascript
function testSubmission() {
  const mockEvent = {
    parameter: {
      email: 'test@example.com',
      feedback: 'Test feature request'
    }
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
```
1. Select `testSubmission` from dropdown
2. Click Run ▶️
3. Check your sheet for test data

### Option 2: Test from Website
1. Open your website
2. Open browser console
3. Submit the feedback form
4. Check Google Sheet for new rows

---

## Troubleshooting

### Data not appearing in sheets?
✅ Check sheet names are exact: "Meturferse Email List" and "Meturferse Feedback"
✅ Check column headers are in row 1
✅ Run test function in Apps Script to verify logic

### Form submission not working?
✅ Verify GOOGLE_SHEETS_URL is correct
✅ Check browser console for JavaScript errors
✅ Ensure FormData is being used (not JSON)
✅ Verify `mode: 'no-cors'` is set

### Still seeing CORS errors?
✅ Make sure you're using FormData (not JSON)
✅ Remove any `Content-Type` headers
✅ Ensure `mode: 'no-cors'` is present
✅ Redeploy Apps Script as new version

---

## Comparison: What Changed

| Aspect | Old (Broken) Method | New (Working) Method |
|--------|-------------------|---------------------|
| Data Format | JSON | FormData |
| Content-Type | `application/json` | (none) |
| Fetch Mode | default | `no-cors` |
| Apps Script | `e.postData.contents` | `e.parameter` |
| CORS Headers | Required | Not needed |
| Preflight | Yes (fails) | No |
| Localhost | ❌ Fails | ✅ Works |
| Production | ⚠️ Unreliable | ✅ Works |

---

## Key Takeaways

1. **Always use FormData** for Google Sheets integration
2. **Always use `mode: 'no-cors'`** to bypass CORS
3. **Never use JSON** for simple data submission
4. **Use `e.parameter`** in Apps Script (not `e.postData`)
5. **No CORS headers needed** in Apps Script

This is the **definitive, production-ready method** that works across all environments.

---

## Additional Resources

- [MDN: Using FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Apps Script: Web Apps](https://developers.google.com/apps-script/guides/web)

---

**Last Updated**: Based on proven YuYu Coffee implementation (2024-2025)
