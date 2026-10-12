/**
 * Pushes Google Form response rows to the CRM. Add this file's contents in
 * Extensions > Apps Script, set the two script properties, then run
 * installCrmSyncTriggers() once and approve the requested permissions.
 */
const TARGET_SHEET_GID = 1774770762;

function installCrmSyncTriggers() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (['syncCrmFormSubmit', 'syncCrmEditedRow'].includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncCrmFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  ScriptApp.newTrigger('syncCrmEditedRow').forSpreadsheet(spreadsheet).onEdit().create();
  Logger.log('Installed form-submit and edit triggers for spreadsheet ' + spreadsheet.getId() + '.');
}

function syncCrmFormSubmit(event) {
  if (event && event.range) {
    syncCrmRow_(event.range.getSheet(), event.range.getRow());
  } else {
    Logger.log('Form-submit trigger did not include a row range; no row was sent.');
  }
}

function syncCrmEditedRow(event) {
  if (event && event.range) {
    syncCrmRow_(event.range.getSheet(), event.range.getRow());
  } else {
    Logger.log('Edit trigger did not include a row range; no row was sent.');
  }
}

function syncCrmRow_(sheet, rowNumber) {
  if (sheet.getSheetId() !== TARGET_SHEET_GID) {
    Logger.log('Skipped sheet tab ' + sheet.getName() + ' (gid ' + sheet.getSheetId() + '); target gid is ' + TARGET_SHEET_GID + '.');
    return;
  }
  if (rowNumber < 2) {
    Logger.log('Skipped header row ' + rowNumber + '.');
    return;
  }
  syncCrmRows_(sheet, [rowNumber]);
}

function syncAllExistingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets().find((tab) => tab.getSheetId() === TARGET_SHEET_GID);
  if (!sheet) throw new Error('Could not find the configured response sheet tab.');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Target tab was found, but it has no response rows to sync.');
    return;
  }
  const batchSize = 50;
  let synced = 0;
  for (let start = 2; start <= lastRow; start += batchSize) {
    const rowNumbers = [];
    for (let row = start; row < Math.min(start + batchSize, lastRow + 1); row++) rowNumbers.push(row);
    synced += syncCrmRows_(sheet, rowNumbers);
  }
  Logger.log('Backfill completed. Rows synced: ' + synced + '.');
}

function syncCrmRows_(sheet, rowNumbers) {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('CRM_WEBHOOK_URL');
  const secret = properties.getProperty('CRM_SHEETS_SYNC_SECRET');
  if (!endpoint || !secret) throw new Error('Set CRM_WEBHOOK_URL and CRM_SHEETS_SYNC_SECRET in Script Properties.');

  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) {
    Logger.log('Target tab has no columns; no rows were sent.');
    return 0;
  }
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rows = rowNumbers.map((rowNumber) => ({
    sheet_name: sheet.getName(),
    row_number: rowNumber,
    headers: headers,
    values: sheet.getRange(rowNumber, 1, 1, lastColumn).getDisplayValues()[0]
  }));
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ sheet_id: sheet.getParent().getId(), rows: rows }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('CRM sync failed (' + status + '): ' + response.getContentText());
  }
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('The URL in CRM_WEBHOOK_URL did not return the CRM JSON response. Set it to your Next.js URL ending in /api/sheet-responses, not an Apps Script URL. Response: ' + response.getContentText().slice(0, 300));
  }
  if (!result || result.ok !== true || Number(result.synced) !== rows.length) {
    throw new Error('CRM did not confirm all rows. Expected ' + rows.length + ', response: ' + response.getContentText().slice(0, 300));
  }
  Logger.log('CRM accepted ' + result.synced + ' row(s).');
  return rows.length;
}
