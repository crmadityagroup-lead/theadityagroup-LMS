# Direct Google Form to CRM sync

This integration sends submissions from the Google Form directly to the CRM. It does not use a response spreadsheet. A Form-bound Apps Script installable submit trigger posts answers to `/api/google-form-responses`; the CRM stores them and shows them under **Google Form Responses**.

The public form URL supplied for setup is:

`https://docs.google.com/forms/d/e/1FAIpQLSePZVSsNSeIFXNKSiCyofUEoxbo_RmsKf71wIV-c6ehW9LGjQ/viewform`

## CRM configuration

Set these server-side variables in local `.env` and the live deployment environment:

```text
GOOGLE_FORM_ID=<the ID in the Form editor URL, between /forms/d/ and /edit>
FORM_SYNC_SECRET=<a long random secret>
```

The ID in a respondent `/forms/d/e/.../viewform` URL can differ from the editor Form ID. Open the Form in edit mode and use the ID from its `/forms/d/<ID>/edit` address. Keep the sync secret private.

Apply the new table migration to the same database used by the live CRM. This project currently has older pending migrations, so apply only this additive migration and record it:

```powershell
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261013100000_add_google_form_responses/migration.sql
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20261013100000_add_google_form_responses
npm run db:generate
```

Run these commands with `DATABASE_URL` targeting the live CRM database. Stop the local Next.js server before `db:generate` if Windows reports that the Prisma query engine is locked. Then deploy the app with both environment values. The new responses page is visible to super admins, admins, and data operators.

## Configure the Form Apps Script

1. Open the Google Form in edit mode using an account with editor access.
2. Click **More (⋮) → Script editor** to create/open its bound Apps Script project. Paste all of `scripts/google-form-sync.gs` and save. Google documents this menu path for bound Form scripts: [Container-bound Scripts](https://developers.google.com/apps-script/guides/bound).
3. In Apps Script **Project Settings → Script Properties**, set:
   - `CRM_WEBHOOK_URL`: `https://YOUR-LIVE-CRM-DOMAIN/api/google-form-responses`
   - `CRM_FORM_SYNC_SECRET`: the exact same value configured as `FORM_SYNC_SECRET` in the live CRM.
4. Select and run `installCrmFormSubmitTrigger` once. Approve the requested Forms and external-request permissions.
5. Run `syncAllExistingFormResponses` once to backfill responses already stored in the Form. New submissions sync automatically after the trigger is installed.
6. Sign in to the live CRM and open **Google Form Responses**.

`CRM_WEBHOOK_URL` must be the Next.js API URL, not a Google Apps Script `/macros/.../exec` URL. The API endpoint requires the matching bearer secret. Apps Script must be able to reach the live CRM over HTTPS.
