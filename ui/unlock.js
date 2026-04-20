// Unlock script for secure configuration

const passwordInput = document.getElementById('password');
const rememberCheckbox = document.getElementById('remember');
const unlockBtn = document.getElementById('unlockBtn');
const errorMsg = document.getElementById('errorMsg');
const unlockForm = document.getElementById('unlockForm');
const setupLink = document.getElementById('setupLink');

// Handle form submission
unlockForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = passwordInput.value;
  if (!password) return;

  // Disable form while processing
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Unlocking...';
  errorMsg.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'unlockCredentialVault',
      passphrase: password
    });

    if (response && response.success) {
      // Vault unlocked successfully in background -- close popup
      window.close();
    } else {
      // Show error from background
      const msg = (response && response.error) || 'Unlock failed';
      errorMsg.textContent = msg.includes('not configured')
        ? 'No vault configured. Please run setup first.'
        : msg.includes('passphrase') ? 'Incorrect password' : msg;
      errorMsg.style.display = 'block';
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock';
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    errorMsg.textContent = 'Communication error. Please try again.';
    errorMsg.style.display = 'block';
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
    passwordInput.value = '';
    passwordInput.focus();
  }
});

// Handle setup link
setupLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Check if already unlocked
chrome.runtime.sendMessage({ action: 'getCredentialVaultStatus' }).then(response => {
  if (response && response.unlocked) {
    window.close();
  }
});

// Focus password input
passwordInput.focus();
