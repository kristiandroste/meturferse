# Google Sheets Setup for Meturferse Feedback Form

This guide will help you set up Google Sheets to receive feedback form submissions from your Meturferse website.

## Overview

The feedback form will submit data to a Google Sheet with two tabs:
- **Meturferse Email List**: Logs all email submissions
- **Meturferse Feedback**: Logs all feature requests with optional email

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named **"Meturferse"**
3. Create two tabs (sheets) within the spreadsheet:

### Tab 1: "Meturferse Email List"
Create the following columns in row 1:
- **Column A**: `Timestamp`
- **Column B**: `Email Address`

### Tab 2: "Meturferse Feedback"
Create the following columns in row 1:
- **Column A**: `Timestamp`
- **Column B**: `Feature Request`
- **Column C**: `Email Address`

---

## Step 2: Create Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code in the script editor
3. Copy and paste the following code:

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

    // Return success (no CORS headers needed with FormData + no-cors)
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }));

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: String(error) }));
  }
}

// Optional: Test function to verify setup
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

4. Click **File** → **Save** (or Ctrl/Cmd + S)
5. Name your project something like "Meturferse Feedback Handler"

---

## Step 3: Deploy the Web App

1. In the Apps Script editor, click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure the deployment:
   - **Description**: "Meturferse Feedback Form v1" (or any description)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (this allows your website to submit data)
5. Click **Deploy**
6. You may need to authorize the script:
   - Click **Authorize access**
   - Choose your Google account
   - Click **Advanced** → **Go to [Project Name] (unsafe)**
   - Click **Allow**
7. **IMPORTANT**: Copy the **Web app URL** - you'll need this for your website
   - It will look like: `https://script.google.com/macros/s/[SCRIPT_ID]/exec`
   - Save this URL somewhere safe

---

## Step 4: Test the Setup (Optional)

### Option A: Test from Apps Script
1. In Apps Script editor, select `testSubmission` from the function dropdown
2. Click **Run** (▶️ button)
3. Check your Google Sheet - you should see a test entry in both tabs

### Option B: Test with cURL (command line)
Use form fields (no custom headers):
```bash
curl -X POST \
  -F "email=test@example.com" \
  -F "feedback=Test feature request" \
  https://script.google.com/macros/s/[YOUR_SCRIPT_ID]/exec
```

Replace `[YOUR_SCRIPT_ID]` with your actual script ID from the Web app URL.

---

## Step 5: Wire up the Website (Direct FormData)

Post your `<form id="feedbackForm">` directly to the Apps Script URL using `FormData` with no custom headers:

```javascript
const feedbackForm = document.getElementById('feedbackForm');
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/[YOUR_SCRIPT_ID]/exec';

feedbackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(feedbackForm);
  const resp = await fetch(GOOGLE_SHEETS_URL, { method: 'POST', body: formData });
  const json = await resp.json();
  if (json.result !== 'success') throw new Error(json.message || 'Submission failed');
});
```

---

## Submission Logic Summary

The form will behave as follows:

| User Input | Email List Updated | Feedback List Updated |
|------------|-------------------|----------------------|
| Email only | ✅ Yes | ❌ No |
| Feedback only | ❌ No | ✅ Yes (no email) |
| Email + Feedback | ✅ Yes | ✅ Yes (with email) |
| Nothing | ❌ Form won't submit (validation) |

---

## Troubleshooting

### Issue: "Authorization required" error
- Make sure you authorized the script in Step 3
- Ensure "Execute as" is set to **Me**
- Ensure "Who has access" is set to **Anyone**

### Issue: Data not appearing in sheets
- Verify sheet names are exactly: "Meturferse Email List" and "Meturferse Feedback"
- Check Apps Script logs: **View** → **Logs** (or **Executions**)
- Make sure column headers are in row 1

### Issue: CORS errors in browser
- Ensure you post `FormData` with no custom headers. Do not set `Content-Type` manually.
- Avoid JSON payloads (they trigger preflight and can fail without CORS headers).

### Optional: Server Proxy Alternative
- You can proxy the request through your server if desired (e.g., Express forwards to the Apps Script URL). This is optional and not required for the working setup above.

### Issue: "Script function not found: doPost"
- Make sure the function is named exactly `doPost` (case-sensitive)
- Ensure the script is saved before deploying

---

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to prevent spam
2. **Data Validation**: The script validates that at least some data exists
3. **Public Access**: The web app is publicly accessible but only accepts POST requests
4. **Email Privacy**: Email addresses are stored in your private Google Sheet

### Optional: Add Simple Rate Limiting

Add this to the beginning of your `doPost` function:

```javascript
// Simple rate limiting by IP (stores last 100 submissions)
const cache = CacheService.getScriptCache();
const userIP = e.parameter.userIP || 'unknown';
const cacheKey = 'submission_' + userIP;
const lastSubmission = cache.get(cacheKey);

if (lastSubmission) {
  const timeSince = Date.now() - parseInt(lastSubmission);
  if (timeSince < 60000) { // 1 minute cooldown
    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'error',
        message: 'Please wait before submitting again'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

cache.put(cacheKey, Date.now().toString(), 600); // Cache for 10 minutes
```

---

## Updating the Deployment

If you need to modify the script later:

1. Make your changes in the Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Click the edit icon ✏️ next to your deployment
4. Change the version to **New version**
5. Click **Deploy**
6. The Web app URL remains the same - no need to update your website

---

## Data Management

### Viewing Submissions
- Simply open your Google Sheet to view all submissions
- Data is appended in chronological order

### Exporting Data
- **File** → **Download** → Choose format (CSV, Excel, etc.)

### Creating Charts/Analytics
- Use Google Sheets built-in charts to visualize trends
- Example: Email collection over time, most requested features

---

## Support

If you encounter issues:
1. Check the [Apps Script documentation](https://developers.google.com/apps-script)
2. Review execution logs in Apps Script: **View** → **Executions**
3. Verify your sheet structure matches exactly as specified

---

## Next Steps

After completing this setup:
1. Copy your Web app URL
2. Save it securely
3. Provide it to implement in the website code
4. Test the form once it's deployed

Your Google Sheet is now ready to receive feedback form submissions! 🎉
