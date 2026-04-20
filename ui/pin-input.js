// Reusable numeric PIN input component
// Usage: const pin = createPinInput(container, 6, { onComplete: (val) => ... })

function createPinInput(container, digitCount, options = {}) {
  const { onComplete, masked = true } = options;
  let inputs = [];

  function render(count) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'pin-input-container';
    inputs = [];

    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'tel';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.pattern = '[0-9]';
      input.className = 'pin-digit';
      input.autocomplete = 'off';
      input.dataset.index = i;

      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val.slice(0, 1);
        if (val) {
          e.target.classList.add('filled');
          if (i < inputs.length - 1) {
            inputs[i + 1].focus();
          }
          checkComplete();
        } else {
          e.target.classList.remove('filled');
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!e.target.value && i > 0) {
            e.preventDefault();
            inputs[i - 1].value = '';
            inputs[i - 1].classList.remove('filled');
            inputs[i - 1].focus();
          } else {
            e.target.classList.remove('filled');
          }
        }
        // Block non-numeric (allow Tab, Backspace, Arrow keys)
        if (e.key.length === 1 && !/\d/.test(e.key)) {
          e.preventDefault();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
        for (let j = 0; j < Math.min(pasted.length, inputs.length - i); j++) {
          inputs[i + j].value = pasted[j];
          inputs[i + j].classList.add('filled');
        }
        const nextEmpty = Math.min(i + pasted.length, inputs.length - 1);
        inputs[nextEmpty].focus();
        checkComplete();
      });

      input.addEventListener('focus', () => {
        input.select();
      });

      inputs.push(input);
      wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
  }

  function checkComplete() {
    const value = inputs.map(i => i.value).join('');
    if (value.length === inputs.length && /^\d+$/.test(value) && onComplete) {
      onComplete(value);
    }
  }

  function getValue() {
    return inputs.map(i => i.value).join('');
  }

  function clear() {
    inputs.forEach(i => {
      i.value = '';
      i.classList.remove('filled');
    });
    if (inputs.length > 0) inputs[0].focus();
  }

  function focus() {
    if (inputs.length > 0) {
      const firstEmpty = inputs.find(i => !i.value) || inputs[0];
      firstEmpty.focus();
    }
  }

  function setDigitCount(n) {
    render(n);
  }

  render(digitCount);

  return { getValue, clear, focus, setDigitCount };
}
