// ---- Config -----------------------------------------------------------
// Paste the Web App URL you get after deploying apps-script/Code.gs
// (Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone).
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx-vwGPsXe33EMg4T_UwBOWXnZI9csr3ByI2a3vZcSL5L8hEz1owZR_Q8aLnNkLdvSEvQ/exec';

var BRANCHES = ['BTRD', 'BTB', 'BTK', 'BTP', 'BTRP', 'BTR', 'BTN', 'BTY', 'BTH', 'BTRY', 'BTKR', 'BTCM', 'BTSR', 'BTUD'];

// Max characters allowed in a single Google Sheets cell (hard platform limit).
// We leave headroom below it since the photo is stored as a base64 text string.
var MAX_PHOTO_CELL_CHARS = 45000;

/**
 * Resize + re-encode an image file into a JPEG data URL, shrinking dimensions
 * and quality step by step until it fits under MAX_PHOTO_CELL_CHARS (since it
 * will be stored as plain text in a single Sheets cell).
 * Resolves to null if the file isn't an image.
 * Rejects with an Error if it can't be brought under the size limit.
 */
function compressImageForSheetCell(file) {
  return new Promise(function (resolve, reject) {
    if (!file || file.type.indexOf('image/') !== 0) {
      resolve(null);
      return;
    }

    var img = new Image();
    var objectUrl = URL.createObjectURL(file);

    img.onload = function () {
      URL.revokeObjectURL(objectUrl);

      var dimensionSteps = [800, 640, 480, 360];
      var qualitySteps = [0.7, 0.55, 0.4, 0.28];

      function attempt(dimIndex, qualIndex) {
        if (dimIndex >= dimensionSteps.length) {
          reject(new Error('Photo is too large even after compression. Please retake it at a lower resolution or remove it.'));
          return;
        }

        var maxDim = dimensionSteps[dimIndex];
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        var quality = qualitySteps[qualIndex];
        var dataUrl = canvas.toDataURL('image/jpeg', quality);

        if (dataUrl.length <= MAX_PHOTO_CELL_CHARS) {
          resolve(dataUrl);
          return;
        }

        if (qualIndex + 1 < qualitySteps.length) {
          attempt(dimIndex, qualIndex + 1);
        } else {
          attempt(dimIndex + 1, 0);
        }
      }

      attempt(0, 0);
    };

    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image file.'));
    };

    img.src = objectUrl;
  });
}

/**
 * POST a plain-text JSON body to the Apps Script web app.
 * text/plain avoids a CORS preflight, which Apps Script web apps don't handle.
 */
function submitEntry(payload) {
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function (res) {
    return res.json();
  }).then(function (json) {
    if (json.result !== 'success') {
      throw new Error(json.message || 'Submission failed.');
    }
    return json;
  });
}
