/**
 * Sends Google Form responses directly to one or more CRM instances.
 * Add this script from the Form editor, set its script properties, then run
 * installCrmFormSubmitTrigger() once and approve the requested permissions.
 */
function installCrmFormSubmitTrigger() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Open this Apps Script project from the Google Form editor.');

  // The CRM cannot display a respondent address unless the Form records it.
  form.setCollectEmail(true);

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'syncCrmFormResponse') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncCrmFormResponse').forForm(form).onFormSubmit().create();
  Logger.log('Installed direct form-submit trigger for form ' + form.getId() + '. Email collection is enabled: ' + form.collectsEmail() + '.');
}

function syncCrmFormResponse(event) {
  if (!event || !event.response) throw new Error('The Form submit event did not include a response.');
  syncCrmFormResponses_([event.response], true);
}

function syncAllExistingFormResponses() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Open this Apps Script project from the Google Form editor.');
  Logger.log('Google Form collects email addresses: ' + form.collectsEmail());
  const formResponses = form.getResponses();
  if (!formResponses.length) {
    Logger.log('This Google Form has no responses to sync.');
    return;
  }

  const batchSize = 50;
  let synced = 0;
  let responsesWithEmail = 0;
  for (let start = 0; start < formResponses.length; start += batchSize) {
    const batch = formResponses.slice(start, start + batchSize);
    responsesWithEmail += batch.filter((response) => Boolean(getCrmRespondentEmail_(response))).length;
    synced += syncCrmFormResponses_(batch, false);
  }
  Logger.log('Backfill completed. Form responses synced: ' + synced + '; responses with email: ' + responsesWithEmail + '.');
}

function syncCrmFormResponses_(formResponses, notifySubmitters) {
  const form = FormApp.getActiveForm();
  const properties = PropertiesService.getScriptProperties();
  const endpoints = (properties.getProperty('CRM_WEBHOOK_URLS') || properties.getProperty('CRM_WEBHOOK_URL') || '')
    .split(/[\n,]+/).map((url) => url.trim()).filter(Boolean);
  const secret = properties.getProperty('CRM_FORM_SYNC_SECRET');
  if (!endpoints.length || !secret) {
    throw new Error('Set CRM_WEBHOOK_URLS (or CRM_WEBHOOK_URL) and CRM_FORM_SYNC_SECRET in Script Properties.');
  }

  const responses = formResponses.map((formResponse) => {
    const answers = formResponse.getItemResponses().map((itemResponse) => ({
      question: itemResponse.getItem().getTitle(),
      answer: normalizeCrmFormAnswer_(itemResponse.getResponse())
    }));
    return {
      response_id: formResponse.getId(),
      submitted_at: formResponse.getTimestamp().toISOString(),
      respondent_email: getCrmRespondentEmail_(formResponse, answers),
      answers: answers
    };
  });

  const failures = [];
  const emailFailures = [];
  let shouldNotify = notifySubmitters;
  let emailsSent = 0;
  let missingEmails = 0;
  endpoints.forEach((endpoint) => {
    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + secret },
        payload: JSON.stringify({
          form_id: form.getId(),
          responses: responses,
          notify_submitters: shouldNotify
        }),
        muteHttpExceptions: true
      });
      const status = response.getResponseCode();
      const responseText = response.getContentText();
      if (status < 200 || status >= 300) throw new Error('HTTP ' + status + ': ' + responseText.slice(0, 300));
      const result = JSON.parse(responseText);
      if (!result || result.ok !== true || Number(result.synced) !== responses.length) {
        throw new Error('CRM did not confirm all responses: ' + responseText.slice(0, 300));
      }
      const expectedEmailCount = responses.filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.respondent_email)).length;
      if (!Number.isFinite(Number(result.emails_saved)) || Number(result.emails_saved) !== expectedEmailCount) {
        throw new Error('CRM accepted the responses but did not confirm saving their email addresses. Deploy the latest CRM API before backfilling again.');
      }
      Logger.log('CRM accepted ' + result.synced + ' response(s) and saved ' + result.emails_saved + ' email address(es) at ' + endpoint + '.');
      if (shouldNotify) {
        const sentHere = Number(result.emails_sent || 0);
        const failedHere = Number(result.emails_failed || 0);
        const alreadySentHere = Number(result.emails_already_sent || 0);
        const missingHere = Number(result.email_recipients_missing || 0);
        emailsSent += sentHere;
        missingEmails += missingHere;
        Logger.log('Confirmation emails sent: ' + sentHere + '; already sent: ' + alreadySentHere + '; failed: ' + failedHere + '; missing respondent email: ' + missingHere + '.');
        if (failedHere > 0) {
          emailFailures.push(endpoint + ': mail server rejected the confirmation email.');
        } else if (sentHere > 0 || alreadySentHere > 0 || missingHere > 0) {
          shouldNotify = false;
        }
      }
    } catch (error) {
      failures.push(endpoint + ': ' + error.message);
    }
  });
  if (failures.length) throw new Error('One or more CRM destinations failed: ' + failures.join(' | '));
  if (notifySubmitters && shouldNotify && emailFailures.length) {
    throw new Error('The response synced, but confirmation email failed at every CRM destination: ' + emailFailures.join(' | '));
  }
  if (notifySubmitters && shouldNotify) {
    throw new Error('The response synced, but no CRM endpoint confirmed the email status. Deploy the updated CRM API and check the respondent email address.');
  }
  if (notifySubmitters && missingEmails > 0) {
    Logger.log('No valid respondent email was included in ' + missingEmails + ' submission(s). Add an Email question or enable email collection in the Form.');
  } else if (notifySubmitters && emailsSent === 0 && !emailFailures.length) {
    Logger.log('No new confirmation email was needed; the response may already have been emailed.');
  }
  return responses.length;
}

function getCrmRespondentEmail_(formResponse, answers) {
  const collectedEmail = String(formResponse.getRespondentEmail() || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collectedEmail)) return collectedEmail;

  const responseAnswers = answers || formResponse.getItemResponses().map((itemResponse) => ({
    question: itemResponse.getItem().getTitle(),
    answer: normalizeCrmFormAnswer_(itemResponse.getResponse())
  }));
  const emailAnswer = responseAnswers.find((answer) =>
    /e-?mail|email address/i.test(String(answer.question || '')) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(Array.isArray(answer.answer) ? answer.answer[0] : answer.answer || '').trim())
  );
  return emailAnswer ? String(Array.isArray(emailAnswer.answer) ? emailAnswer.answer[0] : emailAnswer.answer).trim() : '';
}

function normalizeCrmFormAnswer_(answer) {
  if (answer instanceof Date) return answer.toISOString();
  if (Array.isArray(answer)) {
    return answer.map((value) => value instanceof Date ? value.toISOString() : String(value ?? ''));
  }
  return String(answer ?? '');
}
