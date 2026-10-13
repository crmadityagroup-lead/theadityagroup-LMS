# Direct Google Form to CRM sync

This integration sends Google Form submissions directly to one or more CRM instances. It does not use a response spreadsheet. A Form-bound Apps Script installable submit trigger posts answers to `/api/google-form-responses`; the CRM stores them in a table under **Google Form Responses**. Admins can select and delete rows. New submissions can receive a confirmation email if the Form collects their email address and SMTP is configured.

The public form URL supplied for setup is:

`https://docs.google.com/forms/d/e/1FAIpQLSePZVSsNSeIFXNKSiCyofUEoxbo_RmsKf71wIV-c6ehW9LGjQ/viewform`

## CRM configuration

Set these server-side variables in local `.env` and the live deployment environment. Use the Form editor URL ID (not the public `d/e/.../viewform` ID) and the same random sync secret in both places:

```text
GOOGLE_FORM_ID=<the ID in the Form editor URL, between /forms/d/ and /edit>
FORM_SYNC_SECRET=<a long random secret>
```

The ID in a respondent `/forms/d/e/.../viewform` URL can differ from the editor Form ID. Open the Form in edit mode and use the ID from its `/forms/d/<ID>/edit` address. Keep the sync secret private.

Configure SMTP (`SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM`) for any instance that should send confirmation emails. Vercel and the local server need their own environment variables. Email collection must be enabled in Google Forms: **Settings → Responses → Collect email addresses**. If the Form does not collect email addresses, the dashboard still stores responses but cannot email the respondent.

Apply both Google Form SQL migrations to each database the app will use: `20261013100000_add_google_form_responses` and `20261013130000_add_form_respondent_email`. Use the repository's migration workflow for a fresh database; for an existing database where earlier migrations have already been applied, execute each additive SQL file and mark that migration applied. For example, with `DATABASE_URL` set to the target database:

```powershell
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261013100000_add_google_form_responses/migration.sql
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20261013100000_add_google_form_responses
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261013130000_add_form_respondent_email/migration.sql
npx prisma migrate resolve --schema prisma/schema.prisma --applied 20261013130000_add_form_respondent_email
npm run db:generate
```

Run the commands once for the local database and once for the live database, each time setting `DATABASE_URL` to that target. Stop the local Next.js server before `db:generate` if Windows reports that the Prisma query engine is locked. Deploy the app with the matching environment values. The responses page is visible to super admins, admins, and data operators.

## Configure the Form Apps Script

1. Open the Google Form in edit mode using an account with editor access.
2. Click **More (⋮) → Script editor** to create/open its bound Apps Script project. Paste all of `scripts/google-form-sync.gs` and save. Google documents this menu path for bound Form scripts: [Container-bound Scripts](https://developers.google.com/apps-script/guides/bound).
3. In Apps Script **Project Settings → Script Properties**, set:
   - `CRM_WEBHOOK_URLS`: one or more `/api/google-form-responses` URLs, separated by commas or new lines. Example:
     ```text
     https://theadityagroup-lms.vercel.app/api/google-form-responses
     https://YOUR-TEMPORARY-HTTPS-TUNNEL/api/google-form-responses
     ```
   - `CRM_FORM_SYNC_SECRET`: the exact same value configured as `FORM_SYNC_SECRET` in the live CRM.
4. Select and run `installCrmFormSubmitTrigger` once. It enables Google Forms email collection, replaces the old trigger, and asks you to approve Forms and external-request permissions. The Form will collect respondents' email addresses for new submissions.
5. Run `syncAllExistingFormResponses` once to backfill responses already stored in the Form. New submissions sync automatically after the trigger is installed.
6. Sign in to each CRM and open **Google Form Responses**. The script tries to send the confirmation through the first URL; if its SMTP send fails, it tries the next configured CRM URL. After one CRM accepts the email, later endpoints only sync the response, avoiding duplicate confirmations.

Apps Script cannot reach `localhost`. For local sync, run the Next.js app and expose its port through a temporary public HTTPS tunnel, then put that tunnel URL after the live URL. Keep the tunnel running while testing and update the Script Property whenever its URL changes. Set the same `GOOGLE_FORM_ID` and `FORM_SYNC_SECRET` locally and live, and make sure both app instances have their database migration applied. `CRM_WEBHOOK_URLS` must contain Next.js API URLs, not Google Apps Script `/macros/.../exec` URLs. The legacy single `CRM_WEBHOOK_URL` property still works if you only need one destination.

## Email troubleshooting

- The form submit trigger sends confirmation emails for new submissions only. The backfill function does not email old respondents.
- The email is attempted through the first URL in `CRM_WEBHOOK_URLS`. If that instance's SMTP send fails, the script tries the next URL. To test sending from local, ensure the local HTTPS tunnel is listed and SMTP is configured in local `.env`.
- The Form must collect email addresses, or have a valid question titled **Email** or **E-mail**. The script uses either source. Run `syncAllExistingFormResponses` again to update email addresses for older rows; it still will not resend old confirmations.
- Check the Apps Script execution log for `Confirmation emails sent`, `failed`, and `missing respondent email`. If a send failed, check that instance's server logs for `[google-form] confirmation email failed` and verify its `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` settings.
