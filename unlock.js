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
    // Try to decrypt with the provided password
    const testKey = await chrome.storage.local.get('apiKey');
    
    if (testKey.apiKey) {
      // Import secure config
      const { secureConfig } = await import('./secure-config.js');
      
      // Try to decrypt a test value
      await secureConfig.decrypt(testKey.apiKey, password);
      
      // Success - initialize secure config
      await secureConfig.initialize(password);
      
      // Store in session if requested
      if (rememberCheckbox.checked) {
        await chrome.storage.session.set({ 
          masterPassword: password,
          unlockTime: Date.now()
        });
      }
      
      // Send unlock message to background
      chrome.runtime.sendMessage({ 
        action: 'unlock',
        password: password,
        remember: rememberCheckbox.checked
      });
      
      // Close the unlock window
      window.close();
      
    } else {
      throw new Error('No encrypted configuration found. Please run setup first.');
    }
    
  } catch (error) {
    // Show error
    errorMsg.textContent = error.message.includes('decrypt') 
      ? 'Incorrect password' 
      : error.message;
    errorMsg.style.display = 'block';
    
    // Re-enable form
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
    
    // Clear password
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
chrome.storage.session.get('masterPassword', (data) => {
  if (data.masterPassword) {
    // Already unlocked in this session
    window.close();
  }
});

// Focus password input
passwordInput.focus();