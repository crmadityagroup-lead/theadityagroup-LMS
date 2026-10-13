/**
 * Sends Google Form responses directly to the CRM without a response Sheet.
 * Add this script from the Form editor, set its script properties, then run
 * installCrmFormSubmitTrigger() once and approve the requested permissions.
 */
function installCrmFormSubmitTrigger() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Open this Apps Script project from the Google Form editor.');

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncCrmFormResponse') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncCrmFormResponse').forForm(form).onFormSubmit().create();
  Logger.log('Installed direct form-submit trigger for form ' + form.getId() + '.');
}

function syncCrmFormResponse(event) {
  if (!event || !event.response) throw new Error('The Form submit event did not include a response.');
  syncCrmFormResponses_([event.response]);
}

function syncAllExistingFormResponses() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Open this Apps Script project from the Google Form editor.');
  const formResponses = form.getResponses();
  if (!formResponses.length) {
    Logger.log('This Google Form has no responses to sync.');
    return;
  }

  const batchSize = 50;
  let synced = 0;
  for (let start = 0; start < formResponses.length; start += batchSize) {
    synced += syncCrmFormResponses_(formResponses.slice(start, start + batchSize));
  }
  Logger.log('Backfill completed. Form responses synced: ' + synced + '.');
}

function syncCrmFormResponses_(formResponses) {
  const form = FormApp.getActiveForm();
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('CRM_WEBHOOK_URL');
  const secret = properties.getProperty('CRM_FORM_SYNC_SECRET');
  if (!endpoint || !secret) {
    throw new Error('Set CRM_WEBHOOK_URL and CRM_FORM_SYNC_SECRET in Script Properties.');
  }

  const responses = formResponses.map((formResponse) => ({
    response_id: formResponse.getId(),
    submitted_at: formResponse.getTimestamp().toISOString(),
    answers: formResponse.getItemResponses().map((itemResponse) => ({
      question: itemResponse.getItem().getTitle(),
      answer: normalizeCrmFormAnswer_(itemResponse.getResponse())
    }))
  }));

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ form_id: form.getId(), responses: responses }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const responseText = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('CRM sync failed (' + status + '): ' + responseText.slice(0, 500));
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (error) {
    throw new Error('CRM endpoint did not return JSON. Check CRM_WEBHOOK_URL. Response: ' + responseText.slice(0, 300));
  }
  if (!result || result.ok !== true || Number(result.synced) !== responses.length) {
    throw new Error('CRM did not confirm all form responses. Expected ' + responses.length + ', response: ' + responseText.slice(0, 300));
  }
  Logger.log('CRM accepted ' + result.synced + ' form response(s).');
  return result.synced;
}

function normalizeCrmFormAnswer_(answer) {
  if (answer instanceof Date) return answer.toISOString();
  if (Array.isArray(answer)) {
    return answer.map((value) => value instanceof Date ? value.toISOString() : String(value ?? ''));
  }
  return String(answer ?? '');
}
