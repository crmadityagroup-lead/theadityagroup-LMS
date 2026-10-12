# Google Sheet response sync

This connects the response tab in the spreadsheet shared for this CRM to the **Sheet Responses** page. Google Apps Script sends existing rows and future form submissions to the CRM. Row updates are upserted, so editing a response updates its dashboard row. The sheet's first row supplies the dashboard column headings.

The linked spreadsheet ID is `1WQw9fCYXZyrVoLHw01FsBiLuj4AXd5ecPehVBpSCIhs`; this integration watches tab gid `1774770762`.

## CRM setup

Add these server-side values to `.env` and your deployment secrets:

```text
GOOGLE_SHEET_ID=1WQw9fCYXZyrVoLHw01FsBiLuj4AXd5ecPehVBpSCIhs
SHEETS_SYNC_SECRET=<a long random secret>
```

Use the same secret in the Apps Script project properties. Keep it private; it authorizes writes to the CRM endpoint.

Apply the database change and deploy the app:

```powershell
npx prisma migrate deploy
npm run db:generate
```

Stop the Next.js dev server before regenerating Prisma if Windows reports that the query engine is locked. Restart or redeploy the CRM after setting environment variables.

## Connect Apps Script

1. Open the linked Google Sheet, then choose **Extensions → Apps Script**.
2. Paste the contents of `scripts/google-sheets-sync.gs` into the editor and save.
3. In Apps Script, open **Project Settings → Script Properties** and add:
   - `CRM_WEBHOOK_URL`: `https://YOUR-CRM-DOMAIN/api/sheet-responses`
   - `CRM_SHEETS_SYNC_SECRET`: the exact value used for `SHEETS_SYNC_SECRET`
4. Run `installCrmSyncTriggers` once from the Apps Script editor and approve its permissions. This installs response-submit and row-edit triggers.
5. Select/run `syncAllExistingRows` once to backfill rows already in the response tab. New submissions and edits sync automatically afterward.
6. Sign in to the CRM and open **Sheet Responses**. The page refreshes every 30 seconds; use **Refresh** to load immediately.

The CRM endpoint is public for Apps Script delivery, but rejects requests without the shared bearer secret and only accepts the configured spreadsheet ID. The dashboard read endpoint requires a signed-in CRM account.
