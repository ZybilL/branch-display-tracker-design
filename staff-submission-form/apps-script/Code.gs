// Apps Script backend for the Product Display Update staff submission form.
//
// Setup:
// 1. Create a Google Sheet. Open Extensions > Apps Script and paste this file
//    in as Code.gs (replace the default content).
// 2. Deploy > New deployment > select type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 3. Copy the resulting web app URL into APPS_SCRIPT_URL in ../script.js.
// 4. Re-deploy (Manage deployments > pencil icon > New version) any time you
//    edit this file — editing alone does not update a live deployment.

var SHEET_NAME = 'Submissions';
var HEADERS = [
  'Timestamp', 'Branch', 'Location',
  'Existing Item Code', 'Existing Item Name',
  'New Item Code', 'New Item Name',
  'Notes', 'Photo (Base64)'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (!data.branch || !data.location || !data.itemCode || !data.itemName) {
      return jsonOutput({ result: 'error', message: 'Missing required fields.' });
    }

    var sheet = getOrCreateSheet();

    sheet.appendRow([
      new Date(),
      data.branch,
      data.location,
      data.existingItemCode || '',
      data.existingItemName || '',
      data.itemCode,
      data.itemName,
      data.notes || '',
      data.photo || ''
    ]);

    return jsonOutput({ result: 'success' });
  } catch (err) {
    return jsonOutput({ result: 'error', message: err.message });
  }
}

function doGet(e) {
  return jsonOutput({ status: 'Branch Display Tracker submission endpoint is running.' });
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
