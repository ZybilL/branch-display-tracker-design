(function () {
  var params = new URLSearchParams(window.location.search);
  var branch = (params.get('branch') || '').toUpperCase();

  if (BRANCHES.indexOf(branch) === -1) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('branchDisplay').textContent = branch;

  var photoDrop = document.getElementById('photoDrop');
  var photoInput = document.getElementById('photoInput');
  var photoLabel = document.getElementById('photoLabel');
  var photoHint = document.getElementById('photoHint');
  var errorBanner = document.getElementById('errorBanner');
  var submitBtn = document.getElementById('submitBtn');
  var form = document.getElementById('entryForm');

  var photoDataUrl = null;
  var photoPreviewImg = null;

  function showError(message) {
    errorBanner.innerHTML = '<div class="banner banner-error">' + message + '</div>';
  }

  function clearError() {
    errorBanner.innerHTML = '';
  }

  photoInput.addEventListener('change', function () {
    var file = photoInput.files[0];
    if (!file) return;

    clearError();
    photoLabel.textContent = 'Processing photo…';
    photoHint.textContent = '';

    compressImageForSheetCell(file).then(function (dataUrl) {
      photoDataUrl = dataUrl;

      if (!photoPreviewImg) {
        photoPreviewImg = document.createElement('img');
        photoDrop.insertBefore(photoPreviewImg, photoDrop.firstChild);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'photo-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          photoDataUrl = null;
          photoInput.value = '';
          photoDrop.classList.remove('has-image');
          photoLabel.textContent = 'Tap to add display photo';
          photoHint.textContent = '';
          if (photoPreviewImg) { photoPreviewImg.remove(); photoPreviewImg = null; }
          if (removeBtn.parentNode) removeBtn.remove();
        });
        photoDrop.appendChild(removeBtn);
      }

      photoPreviewImg.src = dataUrl;
      photoDrop.classList.add('has-image');
      photoLabel.textContent = '';
      var kb = Math.round(dataUrl.length / 1024);
      photoHint.textContent = 'Photo ready (~' + kb + ' KB).';
    }).catch(function (err) {
      photoDataUrl = null;
      photoInput.value = '';
      photoLabel.textContent = 'Tap to add display photo';
      showError(err.message);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var location = document.getElementById('location').value.trim();
    var existingItemCode = document.getElementById('existingItemCode').value.trim();
    var existingItemName = document.getElementById('existingItemName').value.trim();
    var itemCode = document.getElementById('itemCode').value.trim();
    var itemName = document.getElementById('itemName').value.trim();
    var notes = document.getElementById('notes').value.trim();

    if (!location) { showError('Please enter the display location.'); return; }
    if (!itemCode || !itemName) { showError('Please enter both the code and product name for the new item.'); return; }

    if (APPS_SCRIPT_URL.indexOf('PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') !== -1) {
      showError('This form isn\'t connected to a Google Sheet yet — set APPS_SCRIPT_URL in script.js (see README).');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    submitEntry({
      branch: branch,
      location: location,
      existingItemCode: existingItemCode,
      existingItemName: existingItemName,
      itemCode: itemCode,
      itemName: itemName,
      notes: notes,
      photo: photoDataUrl || ''
    }).then(function () {
      document.getElementById('successBranch').textContent = branch;
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
    }).catch(function (err) {
      showError(err.message || 'Something went wrong submitting this entry. Please try again.');
    }).finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Entry';
    });
  });

  document.getElementById('addAnotherBtn').addEventListener('click', function () {
    form.reset();
    photoDataUrl = null;
    if (photoPreviewImg) { photoPreviewImg.remove(); photoPreviewImg = null; }
    photoDrop.classList.remove('has-image');
    photoLabel.textContent = 'Tap to add display photo';
    photoHint.textContent = '';
    clearError();
    document.getElementById('successView').style.display = 'none';
    document.getElementById('formView').style.display = 'block';
  });
})();
