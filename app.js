// AutoUPI Application Interactivity logic

// Exchange Rates Data
const EXCHANGE_RATES = {
  INR: { USD: 0.012, AED: 0.044, SGD: 0.016, GBR: 0.0094, GBP: 0.0094 },
  USD: { USD: 1.000, AED: 3.670, SGD: 1.340, GBR: 0.7800, GBP: 0.7800 },
  EUR: { USD: 1.080, AED: 3.970, SGD: 1.450, GBR: 0.8500, GBP: 0.8500 }
};

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  AED: 'د.إ',
  SGD: 'S$',
  GBP: '£'
};

const CORRIDOR_FLAGS = {
  USA: '🇺🇸',
  UAE: '🇦🇪',
  SGP: '🇸🇬',
  GBR: '🇬🇧'
};

// Initial state
let currentCalculatorSourceAmount = 100000;
let currentCalculatorSourceCurrency = 'INR';
let currentCalculatorTargetCurrency = 'USD';

let currentTransferSourceAmount = 50000;
let currentTransferCorridor = { code: 'USA', currency: 'USD', rate: 0.012, flag: '🇺🇸' };
let currentTransferRecipientName = 'Aarav Sharma';
let currentTransferStatus = 'idle'; // idle, processing, success
let currentTransactionId = '';

// Default corridors list for the sandbox transfer
const CORRIDORS = [
  { code: 'USA', currency: 'USD', rate: 0.012, flag: '🇺🇸' },
  { code: 'UAE', currency: 'AED', rate: 0.044, flag: '🇦🇪' },
  { code: 'SGP', currency: 'SGD', rate: 0.016, flag: '🇸🇬' },
  { code: 'GBR', currency: 'GBP', rate: 0.0094, flag: '🇬🇧' }
];

// Document elements
let calcSourceInput, calcSourceSelect, calcTargetSelect, calcTargetDisplay;
let calcFxRateText, calcFeesText, calcSavingsText, calcSwapBtn;

let transferSourceInput, transferRecipientInput, transferSubmitBtn;
let transferContainer, transferFormView, transferStepperView, transferSuccessView;

let historyListContainer, totalSavingsAccumulatorDisplay;

// Safe DOM Initializer to prevent race conditions on deferred scripts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  initializeDOMElements();
  setupFXCalculator();
  setupTransferSandbox();
  setupHistoryLog();
  setupHelpChatbox();
  setupAICopilot();
}

// Link DOM elements
function initializeDOMElements() {
  // Calculator elements
  calcSourceInput = document.getElementById('calc-source-amount');
  calcSourceSelect = document.getElementById('calc-source-currency');
  calcTargetSelect = document.getElementById('calc-target-currency');
  calcTargetDisplay = document.getElementById('calc-target-amount');
  calcFxRateText = document.getElementById('calc-fx-rate');
  calcFeesText = document.getElementById('calc-fees');
  calcSavingsText = document.getElementById('calc-savings');
  calcSwapBtn = document.getElementById('calc-swap-btn');

  // Sandbox elements
  transferSourceInput = document.getElementById('transfer-source-amount');
  transferRecipientInput = document.getElementById('transfer-recipient-name');
  transferSubmitBtn = document.getElementById('transfer-submit-btn');

  transferFormView = document.getElementById('transfer-form-view');
  transferStepperView = document.getElementById('transfer-stepper-view');
  transferSuccessView = document.getElementById('transfer-success-view');

  // History elements
  historyListContainer = document.getElementById('history-list');
  totalSavingsAccumulatorDisplay = document.getElementById('total-savings-accumulator');
}

// ----------------------------------------------------
// FX Calculator Functionality
// ----------------------------------------------------
function setupFXCalculator() {
  if (!calcSourceInput) return;

  const updateCalculator = () => {
    const amount = parseFloat(calcSourceInput.value) || 0;
    const source = calcSourceSelect.value;
    const target = calcTargetSelect.value;

    const rate = EXCHANGE_RATES[source]?.[target] || 1.0;
    const finalAmount = amount * rate;

    // Fees are 0
    const feeSymbol = CURRENCY_SYMBOLS[source] || source;

    // Savings vs SWIFT is calculated as 4.2% of the source amount
    const savingsAmount = amount * 0.042;

    // Update displays
    calcTargetDisplay.textContent = finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    calcFxRateText.textContent = `1 ${source} = ${rate} ${target}`;
    calcFeesText.textContent = `${feeSymbol}0.00`;
    calcSavingsText.textContent = `${feeSymbol}${Math.round(savingsAmount).toLocaleString()}`;
  };

  calcSourceInput.addEventListener('input', updateCalculator);
  calcSourceSelect.addEventListener('change', updateCalculator);
  calcTargetSelect.addEventListener('change', updateCalculator);

  if (calcSwapBtn) {
    calcSwapBtn.addEventListener('click', () => {
      const source = calcSourceSelect.value;
      const target = calcTargetSelect.value;

      // Swap currencies if possible
      // (our source list is INR, USD, EUR; target is USD, AED, SGD, GBP)
      // We check if target is valid source and source is valid target
      const validSources = ['INR', 'USD', 'EUR'];
      const validTargets = ['USD', 'AED', 'SGD', 'GBP'];

      if (validSources.includes(target) && validTargets.includes(source)) {
        calcSourceSelect.value = target;
        calcTargetSelect.value = source;
        updateCalculator();
      } else {
        // Fallback Swap: swap values if possible, otherwise just switch selections
        const temp = calcSourceSelect.value;
        if (validSources.includes(target)) {
          calcSourceSelect.value = target;
        }
        if (validTargets.includes(temp)) {
          calcTargetSelect.value = temp;
        }
        updateCalculator();
      }
    });
  }

  updateCalculator();
}

// ----------------------------------------------------
// Sandbox Transfer Simulator & Stepper Animation
// ----------------------------------------------------
function setupTransferSandbox() {
  const sandboxForm = document.getElementById('sandbox-transfer-form');
  if (!sandboxForm) return;

  // Setup Corridor selector buttons
  const corridorButtons = document.querySelectorAll('.corridor-btn');
  corridorButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      // Deactivate all
      corridorButtons.forEach(b => {
        b.classList.remove('border-secondary', 'bg-secondary/10');
        b.classList.add('border-border', 'bg-surface');
      });

      // Activate clicked
      btn.classList.add('border-secondary', 'bg-secondary/10');
      btn.classList.remove('border-border', 'bg-surface');

      // Update corridor selection state
      currentTransferCorridor = CORRIDORS[index];
      updateTransferSummary();
    });
  });

  // Setup inputs
  transferSourceInput.addEventListener('input', updateTransferSummary);

  // Form submission
  sandboxForm.addEventListener('submit', (e) => {
    e.preventDefault();
    startTransferAnimation();
  });

  // Send Another button reset
  const resetBtn = document.getElementById('transfer-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentTransferStatus = 'idle';
      transferSuccessView.classList.add('hidden');
      transferFormView.classList.remove('hidden');
      sandboxForm.reset();
      
      // Reset defaults
      transferSourceInput.value = 50000;
      transferRecipientInput.value = 'Aarav Sharma';
      
      // Highlight USA button
      corridorButtons.forEach((b, idx) => {
        if (idx === 0) {
          b.classList.add('border-secondary', 'bg-secondary/10');
          b.classList.remove('border-border', 'bg-surface');
        } else {
          b.classList.remove('border-secondary', 'bg-secondary/10');
          b.classList.add('border-border', 'bg-surface');
        }
      });
      currentTransferCorridor = CORRIDORS[0];
      updateTransferSummary();
    });
  });

  updateTransferSummary();
}

// Update the fees and summary display on the sandbox form
function updateTransferSummary() {
  const amount = parseFloat(transferSourceInput.value) || 0;
  const rate = currentTransferCorridor.rate;
  const currency = currentTransferCorridor.currency;

  const fee = amount * 0.02; // 2% fee
  const recipientGets = amount * rate;

  // Update DOM labels
  document.getElementById('transfer-fx-rate').textContent = `1 INR = ${rate} ${currency}`;
  document.getElementById('transfer-fee').textContent = `₹${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('transfer-gets').textContent = `${currency} ${recipientGets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('transfer-btn-text').textContent = `Send ${currency} ${recipientGets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (typeof syncAICopilotHUD === 'function') {
    syncAICopilotHUD();
  }
}

// Stepper stages visualizer trigger
function startTransferAnimation() {
  currentTransferStatus = 'processing';

  // Toggle views
  transferFormView.classList.add('hidden');
  transferStepperView.classList.remove('hidden');

  // Animation timeline controls
  const steps = document.querySelectorAll('.step-node');
  const progressBar = document.getElementById('stepper-progress-bar');
  
  // Reset steps classes
  steps.forEach(step => step.classList.remove('active', 'completed'));
  if (progressBar) progressBar.style.height = '0%';

  const totalSteps = steps.length;
  let currentStepIndex = 0;

  // Update step status
  const runNextStep = () => {
    if (currentStepIndex >= totalSteps) {
      // Complete!
      setTimeout(completeTransfer, 800);
      return;
    }

    // Mark previous as completed
    if (currentStepIndex > 0) {
      steps[currentStepIndex - 1].classList.remove('active');
      steps[currentStepIndex - 1].classList.add('completed');
    }

    // Set current active
    steps[currentStepIndex].classList.add('active');

    // Update line height percentage
    if (progressBar) {
      const percentage = (currentStepIndex / (totalSteps - 1)) * 100;
      progressBar.style.height = `${percentage}%`;
    }

    currentStepIndex++;
    // Trigger next step in 1.4s
    setTimeout(runNextStep, 1400);
  };

  runNextStep();
}

// Transfer execution completion
function completeTransfer() {
  currentTransferStatus = 'success';
  
  // Generate random transaction ID
  currentTransactionId = 'AUP-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  const sourceAmount = parseFloat(transferSourceInput.value) || 0;
  const recipientName = transferRecipientInput.value;
  const destCurrency = currentTransferCorridor.currency;
  const recipientGets = (sourceAmount * currentTransferCorridor.rate).toFixed(2);
  const savings = Math.round(sourceAmount * 0.042); // 4.2% saved

  // Populate success elements
  document.getElementById('success-headline').textContent = `${destCurrency} ${parseFloat(recipientGets).toLocaleString(undefined, { minimumFractionDigits: 2 })} delivered to ${recipientName}`;
  document.getElementById('success-tx-id').textContent = currentTransactionId;
  document.getElementById('success-corridor').textContent = `IN → ${currentTransferCorridor.code}`;
  document.getElementById('success-savings-banner').textContent = `Saved ₹${savings.toLocaleString()} vs traditional SWIFT!`;

  // Swap screens
  transferStepperView.classList.add('hidden');
  transferSuccessView.classList.remove('hidden');

  // Save transaction to history
  addTransactionToHistory({
    id: currentTransactionId,
    name: recipientName,
    amount: sourceAmount,
    gets: parseFloat(recipientGets),
    currency: destCurrency,
    corridor: `IN → ${currentTransferCorridor.code}`,
    flag: currentTransferCorridor.flag,
    savings: savings,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  });
}

// ----------------------------------------------------
// Transaction History & Savings Log
// ----------------------------------------------------
function setupHistoryLog() {
  let history = getHistory();
  
  // Initialize with dummy data if history is empty
  if (history.length === 0) {
    history = [
      {
        id: 'AUP-R5T9P2Q6',
        name: 'Sarah Jenkins',
        amount: 80000,
        gets: 960.00,
        currency: 'USD',
        corridor: 'IN → USA',
        flag: '🇺🇸',
        savings: 3360,
        date: 'Jun 12, 10:14 AM'
      },
      {
        id: 'AUP-M7X4Y8W3',
        name: 'Devon Carter',
        amount: 35000,
        gets: 1540.00,
        currency: 'AED',
        corridor: 'IN → UAE',
        flag: '🇦🇪',
        savings: 1470,
        date: 'Jun 10, 04:32 PM'
      }
    ];
    saveHistory(history);
  }

  renderHistory();
}

function getHistory() {
  try {
    const data = localStorage.getItem('autoupi_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem('autoupi_history', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to write transaction history', e);
  }
}

function addTransactionToHistory(tx) {
  const history = getHistory();
  history.unshift(tx); // Add to top of list
  saveHistory(history);
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  if (!historyListContainer) return;

  historyListContainer.innerHTML = '';
  let totalSavings = 0;

  if (history.length === 0) {
    historyListContainer.innerHTML = `<div class="text-center py-8 text-sm text-muted-foreground">No recent transfers. Send some money to see history!</div>`;
  } else {
    history.forEach(tx => {
      totalSavings += tx.savings;

      const txItem = document.createElement('div');
      txItem.className = 'flex items-center justify-between p-3.5 rounded-xl border border-outline-variant bg-surface/60 transition hover:border-secondary/20';
      txItem.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="text-xl flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-outline-variant">${tx.flag}</div>
          <div class="text-left">
            <p class="text-sm font-semibold text-foreground">${tx.name}</p>
            <p class="text-[10px] text-muted-foreground font-mono">${tx.date} · ${tx.corridor}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-mono font-bold text-foreground">-${CURRENCY_SYMBOLS.INR}${tx.amount.toLocaleString()}</p>
          <p class="text-[10px] text-secondary font-semibold font-mono">Saved ₹${tx.savings.toLocaleString()}</p>
        </div>
      `;
      historyListContainer.appendChild(txItem);
    });
  }

  // Update total savings count in header
  if (totalSavingsAccumulatorDisplay) {
    totalSavingsAccumulatorDisplay.textContent = `₹${totalSavings.toLocaleString()}`;
  }
}

// Add history clearing trigger for tests/user convenience
window.clearTransactionHistory = function() {
  saveHistory([]);
  renderHistory();
};

// Help Chatbot functionality
function setupHelpChatbox() {
  const triggerBtn = document.getElementById('help-chat-trigger');
  const chatWindow = document.getElementById('help-chat-window');
  const closeBtn = document.getElementById('help-chat-close');
  const chatForm = document.getElementById('help-chat-form');
  const chatInput = document.getElementById('help-chat-input');
  const chatMessages = document.getElementById('help-chat-messages');

  if (!triggerBtn || !chatWindow) return;

  // Toggle chat window
  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden') && chatInput) {
      chatInput.focus();
      // Hide standard notification dot if open
      const pulseDot = triggerBtn.querySelector('.animate-ping');
      const staticDot = triggerBtn.querySelector('.relative.inline-flex');
      if (pulseDot) pulseDot.style.display = 'none';
      if (staticDot) staticDot.style.display = 'none';
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chatWindow.classList.add('hidden');
    });
  }

  // Prevent closing when clicking inside chat window
  chatWindow.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close when clicking outside
  document.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (!message) return;

      // Add user message
      appendMessage('user', message);
      chatInput.value = '';

      // Scroll to bottom
      scrollToBottom();

      // Show typing indicator
      const typingId = showTypingIndicator();

      // Simulate bot reply
      setTimeout(() => {
        removeTypingIndicator(typingId);
        const reply = getBotReply(message);
        appendMessage('bot', reply);
        scrollToBottom();
      }, 1200);
    });
  }

  function appendMessage(sender, text) {
    if (!chatMessages) return;
    const msgElement = document.createElement('div');
    msgElement.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} fade-up w-full`;
    
    const bubbleClass = sender === 'user' 
      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] text-left break-words' 
      : 'bg-surface border border-border text-foreground rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] text-left break-words';

    msgElement.innerHTML = `
      <div class="${bubbleClass}">
        <p class="m-0">${text}</p>
      </div>
      <span class="text-[9px] text-muted-foreground mt-1 px-1 font-mono">${sender === 'user' ? 'You' : 'AutoUPI Support'}</span>
    `;
    chatMessages.appendChild(msgElement);
  }

  function showTypingIndicator() {
    if (!chatMessages) return null;
    const typingId = 'typing-' + Math.random().toString(36).slice(2, 9);
    const indicator = document.createElement('div');
    indicator.id = typingId;
    indicator.className = 'flex items-center gap-1 bg-surface border border-border rounded-2xl rounded-tl-none px-4 py-3 max-w-[40%] fade-up';
    indicator.innerHTML = `
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.3s"></div>
    `;
    chatMessages.appendChild(indicator);
    return typingId;
  }

  function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function getBotReply(userMsg) {
    const msg = userMsg.toLowerCase();
    
    if (msg.includes('limit') || msg.includes('lrs') || msg.includes('how much') || msg.includes('maximum')) {
      return "AutoUPI automates all LRS/FEMA compliance details in the background. The standard Liberalised Remittance Scheme limit set by the RBI is $250,000 USD per individual per financial year.";
    }
    if (msg.includes('speed') || msg.includes('time') || msg.includes('fast') || msg.includes('seconds') || msg.includes('slow')) {
      return "By moving funds through atomic GIFT City corridors, we skip correspondent legacy networks, settling transactions in under 60 seconds (with an average settlement time of 42 seconds).";
    }
    if (msg.includes('fee') || msg.includes('cost') || msg.includes('charge') || msg.includes('rate') || msg.includes('percent')) {
      return "We charge a transparent flat fee of 2.0% on sandbox transactions. There are no correspondent banking charges, processing penalties, or hidden currency conversion margins.";
    }
    if (msg.includes('tbd') || msg.includes('token') || msg.includes('crypto') || msg.includes('stablecoin')) {
      return "A Tokenized Bank Deposit (TBD) is a digital representation of a standard bank deposit held in our partner commercial banks (like HDFC or ICICI). It is fully backed 1:1 by fiat and GIFT City regulated, avoiding any crypto volatility.";
    }
    if (msg.includes('corridor') || msg.includes('country') || msg.includes('india') || msg.includes('usa') || msg.includes('uae')) {
      return "We currently support direct real-time corridors from India to the United States (USD), United Arab Emirates (AED), and Singapore (SGD). The UK (GBP) corridor is active in our testing phase.";
    }
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('help')) {
      return "Hello! I am the AutoUPI support assistant. Ask me anything about our LRS limits, transaction speed, 2.0% fee model, or corridors!";
    }
    
    return "Thank you for asking! AutoUPI resolves traditional cross-border friction using GIFT City atomic nodes. Feel free to ask about our speed, flat fees, corridors, or Tokenized Bank Deposit (TBD) technology!";
  }
}

// ----------------------------------------------------
// Flagship AutoUPI AI Copilot Workspace
// ----------------------------------------------------

// Synchronize Right HUD Context Panel with active Sandbox state
function syncAICopilotHUD() {
  const amountInput = document.getElementById('transfer-source-amount');
  if (!amountInput) return;

  const amount = parseFloat(amountInput.value) || 0;
  const corridor = currentTransferCorridor || { code: 'USA', currency: 'USD', rate: 0.012, flag: '🇺🇸' };
  const rate = corridor.rate;
  const currency = corridor.currency;
  const gets = amount * rate;

  // 1. Update transfer HUD amount text
  const hudTransfer = document.getElementById('hud-transfer-amount');
  if (hudTransfer) {
    hudTransfer.textContent = `₹${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} → ${currency} ${gets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 2. Update corridor badge
  const hudCorridor = document.getElementById('hud-transfer-corridor');
  if (hudCorridor) {
    hudCorridor.textContent = `${corridor.flag} ${corridor.code} Node (IN → ${corridor.code})`;
  }

  // 3. Update FX Rate HUD
  const hudFx = document.getElementById('hud-fx-rate');
  if (hudFx) {
    hudFx.textContent = `1 INR = ${rate} ${currency}`;
  }

  // 4. Update LRS limit status bar (limit is $250,000 USD)
  const getsInUSD = currency === 'USD' ? gets : gets * (0.012 / rate);
  const lrsPercentage = (getsInUSD / 250000) * 100;
  
  const hudLrsPct = document.getElementById('hud-lrs-percentage');
  const hudLrsBar = document.getElementById('hud-lrs-bar');
  const hudLrsUsed = document.getElementById('hud-lrs-used');

  if (hudLrsPct) hudLrsPct.textContent = `${lrsPercentage.toFixed(2)}%`;
  if (hudLrsBar) hudLrsBar.style.width = `${Math.min(100, Math.max(0.1, lrsPercentage))}%`;
  if (hudLrsUsed) hudLrsUsed.textContent = `$${Math.round(getsInUSD).toLocaleString()} USED`;

  // 5. Update Risk Assessment & Compliance badges based on size
  const hudRiskText = document.getElementById('hud-risk-text');
  const hudRiskBadge = document.getElementById('hud-risk-badge');
  const hudCompText = document.getElementById('hud-compliance-text');
  const hudCompIcon = document.getElementById('hud-compliance-icon');

  if (amount < 100000) {
    if (hudRiskText) hudRiskText.textContent = 'LOW RISK';
    if (hudRiskBadge) {
      hudRiskBadge.textContent = 'LOW';
      hudRiskBadge.className = 'risk-badge px-2.5 py-1 text-[10px] font-bold rounded-full uppercase';
    }
    if (hudCompText) hudCompText.textContent = 'FEMA COMPLIANT';
    if (hudCompIcon) {
      hudCompIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-secondary"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
    }
  } else if (amount < 800000) {
    if (hudRiskText) hudRiskText.textContent = 'MEDIUM RISK';
    if (hudRiskBadge) {
      hudRiskBadge.textContent = 'MEDIUM';
      hudRiskBadge.className = 'px-2.5 py-1 text-[10px] font-bold rounded-full uppercase bg-yellow-500/10 border border-yellow-500/20 text-yellow-500';
    }
    if (hudCompText) hudCompText.textContent = 'PAN / A2 FORM REQUIRED';
    if (hudCompIcon) {
      hudCompIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-yellow-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;
    }
  } else {
    if (hudRiskText) hudRiskText.textContent = 'HIGH RISK';
    if (hudRiskBadge) {
      hudRiskBadge.textContent = 'HIGH';
      hudRiskBadge.className = 'risk-badge high px-2.5 py-1 text-[10px] font-bold rounded-full uppercase';
    }
    if (hudCompText) hudCompText.textContent = 'RBI AUDIT REVIEW REQUIRED';
    if (hudCompIcon) {
      hudCompIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-red-500"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>`;
    }
  }
}

// Initialise workspace logic
function setupAICopilot() {
  const triggerBtn = document.getElementById('ai-workspace-trigger');
  const workspace = document.getElementById('ai-workspace');
  const closeBtn = document.getElementById('ai-workspace-close');
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  const chatMessages = document.getElementById('ai-chat-messages');

  if (!triggerBtn || !workspace) return;

  // Toggle Overlay opening
  triggerBtn.addEventListener('click', () => {
    workspace.classList.add('active');
    document.body.style.overflow = 'hidden'; // block outer scroll
    syncAICopilotHUD();
    if (chatInput) chatInput.focus();
  });

  const closeWorkspace = () => {
    workspace.classList.remove('active');
    document.body.style.overflow = ''; // restore outer scroll
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWorkspace);
  }

  // Escape key closes overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && workspace.classList.contains('active')) {
      closeWorkspace();
    }
  });

  // Attach Sidebar buttons
  const sidebarItems = document.querySelectorAll('.ai-sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const topic = item.getAttribute('data-topic');
      let promptText = '';
      switch (topic) {
        case 'explain': promptText = 'Explain my transfer details'; break;
        case 'fema': promptText = 'Check if this payment is FEMA compliant'; break;
        case 'fx': promptText = 'Why did the USD rate increase today?'; break;
        case 'savings': promptText = 'How much do I save compared to a bank?'; break;
        case 'flagged': promptText = 'Why was my transfer flagged?'; break;
        case 'investor': promptText = 'Explain AutoUPI like I am an investor'; break;
      }
      if (promptText) runAIPrompt(promptText);
    });
  });

  // Attach suggested starter prompts tags
  document.addEventListener('click', (e) => {
    const promptTag = e.target.closest('.prompt-tag');
    if (promptTag && workspace.classList.contains('active')) {
      const promptText = promptTag.getAttribute('data-prompt');
      if (promptText) runAIPrompt(promptText);
    }
  });

  // Input form submits message
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = chatInput.value.trim();
      if (!query) return;

      runAIPrompt(query);
      chatInput.value = '';
    });
  }

  // Core prompt execution logic
  function runAIPrompt(query) {
    // Hide starter prompts if they are visible
    const starters = document.getElementById('ai-starter-prompts');
    if (starters) starters.style.display = 'none';

    // 1. Add User Message
    appendAIMessage('user', query);
    scrollToBottom();

    // 2. Show Typing Indicator
    const typingId = showTypingIndicator();

    // 3. Process reply after delay
    setTimeout(() => {
      removeTypingIndicator(typingId);
      const htmlReply = generateAICopilotReply(query);
      appendAIMessage('bot', htmlReply, true);
      scrollToBottom();
    }, 1400);
  }

  function appendAIMessage(sender, content, isHtml = false) {
    if (!chatMessages) return;

    const msgElement = document.createElement('div');
    msgElement.className = `flex items-start gap-3 w-full fade-up ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

    if (sender === 'user') {
      msgElement.innerHTML = `
        <div class="flex flex-col items-end text-right">
          <div class="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] break-words text-sm">
            <p class="m-0">${content}</p>
          </div>
          <span class="text-[9px] text-muted-foreground mt-1 px-1 font-mono">You</span>
        </div>
      `;
    } else {
      const bubbleClass = isHtml 
        ? 'w-full'
        : 'bg-surface border border-border text-foreground rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-left text-sm';
      
      const contentHtml = isHtml 
        ? content 
        : `<p class="m-0 leading-relaxed">${content}</p>`;

      msgElement.innerHTML = `
        <div class="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <div class="flex flex-col items-start text-left w-full max-w-[90%]">
          <div class="${bubbleClass}">
            ${contentHtml}
          </div>
          <span class="text-[9px] text-muted-foreground mt-1.5 px-1 font-mono">AutoUPI AI Copilot</span>
        </div>
      `;
    }

    chatMessages.appendChild(msgElement);
  }

  function showTypingIndicator() {
    if (!chatMessages) return null;
    const typingId = 'ai-typing-' + Math.random().toString(36).slice(2, 9);
    const indicator = document.createElement('div');
    indicator.id = typingId;
    indicator.className = 'flex items-center gap-1.5 bg-surface border border-border rounded-2xl rounded-tl-none px-4.5 py-3.5 max-w-[30%] fade-up';
    indicator.innerHTML = `
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
      <div class="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.3s"></div>
    `;
    chatMessages.appendChild(indicator);
    return typingId;
  }

  function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // Rich template generation for Copilot answers
  function generateAICopilotReply(query) {
    const q = query.toLowerCase();
    
    // Get current values from sandbox inputs
    const amountInput = document.getElementById('transfer-source-amount');
    const amount = amountInput ? parseFloat(amountInput.value) || 0 : 50000;
    const corridor = currentTransferCorridor || { code: 'USA', currency: 'USD', rate: 0.012, flag: '🇺🇸' };
    const rate = corridor.rate;
    const currency = corridor.currency;
    const gets = amount * rate;
    const fee = amount * 0.02; // 2%
    const swiftSavings = Math.round(amount * 0.042);

    // 1. Explain Transfer
    if (q.includes('explain') && (q.includes('transfer') || q.includes('payment') || q.includes('detail') || q.includes('this'))) {
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-secondary"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>Active Transaction Breakdown</h4>
          <p class="text-xs text-muted-foreground">Here is the simple-language analysis for your current transaction:</p>
          <div class="grid grid-cols-2 gap-3 text-xs border-t border-b border-border/40 py-3">
            <div><p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">You Remit</p><p class="font-mono font-bold text-white mt-0.5">₹${amount.toLocaleString(undefined, {maximumFractionDigits:2})}</p></div>
            <div><p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Recipient Gets</p><p class="font-mono font-bold text-secondary mt-0.5">${currency} ${gets.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></div>
            <div><p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Exchange Rate</p><p class="font-mono font-bold text-white mt-0.5">1 INR = ${rate} ${currency}</p></div>
            <div><p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Transacting Fee (2.0%)</p><p class="font-mono font-bold text-destructive mt-0.5">₹${fee.toLocaleString(undefined, {maximumFractionDigits:2})}</p></div>
          </div>
          <div class="space-y-1.5 text-xs">
            <p class="text-white font-bold flex items-center gap-1">✨ Settlement Speed: <span class="text-secondary font-mono">Under 60 seconds (Avg. 42s)</span></p>
            <p class="text-white font-bold flex items-center gap-1">✨ SWIFT Savings: <span class="text-secondary font-mono">₹${swiftSavings.toLocaleString()} Saved</span></p>
          </div>
          <p class="text-[10px] text-muted-foreground italic leading-normal">Relationship Manager Note: This transaction settles atomically between central bank-backed local accounts. Zero correspondent bank fees will apply.</p>
        </div>
      `;
    }

    // 2. Compliance Advisor
    if (q.includes('fema') || q.includes('compliance') || q.includes('send') || q.includes('lakh') || q.includes('daughter')) {
      const thresholdAlert = amount >= 800000;
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-yellow-500"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>FEMA & LRS Compliance Status</h4>
          <div class="p-3 bg-secondary/10 border border-secondary/20 rounded-xl flex items-center justify-between">
            <span class="text-xs font-bold text-secondary uppercase">Compliance Status</span>
            <span class="text-[10px] bg-secondary/20 text-secondary border border-secondary/35 px-2 py-0.5 rounded-full font-mono font-bold">${thresholdAlert ? 'RBI AUDIT REVIEW' : 'COMPLIANT'}</span>
          </div>
          <div class="space-y-2 text-xs">
            <p class="text-white font-bold">Regulatory Rules Applied:</p>
            <ul class="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>LRS Threshold: Individual limits are capped at $250,000 USD per financial year (approx ₹2.08 Crore).</li>
              <li>Tax (TCS): Remittances exceeding ₹7 Lakh attract 20% Tax Collected at Source (TCS), refundable via ITR.</li>
              <li>Document Requirements:</li>
            </ul>
            <div class="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 mt-2">
              <label class="flex items-center gap-2 text-[11px] text-white"><input type="checkbox" checked disabled class="rounded border-white/20 bg-background text-primary" /> Active PAN Card Linked (Verified)</label>
              <label class="flex items-center gap-2 text-[11px] text-white"><input type="checkbox" ${amount >= 100000 ? 'checked' : ''} disabled class="rounded border-white/20 bg-background text-primary" /> LRS Declaration A2 Form (FEMA Compliant)</label>
              <label class="flex items-center gap-2 text-[11px] text-white"><input type="checkbox" ${amount >= 500000 ? 'checked' : ''} disabled class="rounded border-white/20 bg-background text-primary" /> Bank Statement Audit Log (Source of Funds)</label>
            </div>
          </div>
        </div>
      `;
    }

    // 3. FX Intelligence
    if (q.includes('fx') || q.includes('rate') || q.includes('usd') || q.includes('increase') || q.includes('today') || q.includes('trend')) {
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-secondary"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>USD/INR 30-Day FX Trend Analysis</h4>
          <p class="text-xs text-muted-foreground leading-normal">The USD rate gained strength recently due to central bank interest rate shifts and trade volumes. Our Gift City nodes settle at pure spot mid-market rate with 0% margin spreads.</p>
          
          <!-- Inline SVG Line Chart -->
          <div class="p-3 bg-white/5 border border-white/10 rounded-2xl">
            <svg viewBox="0 0 300 120" class="w-full h-auto">
              <!-- Grid Lines -->
              <line x1="20" y1="20" x2="290" y2="20" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
              <line x1="20" y1="50" x2="290" y2="50" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
              <line x1="20" y1="80" x2="290" y2="80" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
              <line x1="20" y1="100" x2="290" y2="100" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
              
              <!-- Axis Labels -->
              <text x="5" y="24" fill="#64748b" font-size="8" font-family="monospace">83.8</text>
              <text x="5" y="54" fill="#64748b" font-size="8" font-family="monospace">83.5</text>
              <text x="5" y="84" fill="#64748b" font-size="8" font-family="monospace">83.2</text>
              
              <!-- Chart Path (draw animation) -->
              <path d="M 20 95 Q 60 90 90 70 T 160 55 T 220 30 T 290 22" fill="none" stroke="oklch(0.7 0.18 145)" stroke-width="2" class="chart-path" />
              
              <!-- Dots on peaks -->
              <circle cx="290" cy="22" r="3" fill="#10b981" />
              <text x="250" y="16" fill="#10b981" font-size="8" font-weight="bold" font-family="monospace">83.94 (Spot)</text>
              
              <!-- X-axis days labels -->
              <text x="20" y="115" fill="#64748b" font-size="7" font-family="monospace">30d ago</text>
              <text x="150" y="115" fill="#64748b" font-size="7" font-family="monospace">15d ago</text>
              <text x="260" y="115" fill="#64748b" font-size="7" font-family="monospace">Today</text>
            </svg>
          </div>
          <p class="text-[10px] text-muted-foreground italic leading-normal font-sans">Smart Advice: Spot spreads are currently tight. AutoUPI locks rates for 60 seconds during settlement, avoiding volatility slips.</p>
        </div>
      `;
    }

    // 4. Savings Calculator
    if (q.includes('saving') || q.includes('calculator') || q.includes('swift') || q.includes('expensive') || q.includes('compare')) {
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-secondary"><path d="M11 15h2a2 2 0 1 0 0-4h-3a2 2 0 1 1 0-4h2"/><path d="M12 5v14"/></svg>Fee Analysis: traditional SWIFT vs AutoUPI</h4>
          <p class="text-xs text-muted-foreground leading-normal">SWIFT transfers incur multiple layers of intermediary agent markups, flat charges, and inflated FX spreads. AutoUPI settles directly on institutional node rails with fixed flat fees.</p>
          
          <!-- Comparison Table -->
          <div class="overflow-hidden rounded-xl border border-border/50">
            <table class="w-full text-xs text-left">
              <thead class="bg-white/5 border-b border-border/40 text-muted-foreground">
                <tr>
                  <th class="p-2.5 font-bold">Parameter</th>
                  <th class="p-2.5 font-bold">SWIFT Banking</th>
                  <th class="p-2.5 font-bold text-secondary">AutoUPI Node</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/20 text-white">
                <tr>
                  <td class="p-2.5 text-muted-foreground">FX Spread Markup</td>
                  <td class="p-2.5">2.5% – 4.0% (Opaque)</td>
                  <td class="p-2.5 text-secondary font-bold">0% (spot rate)</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-muted-foreground">Intermediary Fees</td>
                  <td class="p-2.5">$15 – $45 / bank</td>
                  <td class="p-2.5 text-secondary font-bold">₹0.00</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-muted-foreground">Fixed Platform Fee</td>
                  <td class="p-2.5">Varies by tier</td>
                  <td class="p-2.5 text-secondary font-bold">2.0% Flat</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-muted-foreground">Settlement Time</td>
                  <td class="p-2.5">5 – 7 Business Days</td>
                  <td class="p-2.5 text-secondary font-bold font-mono">&lt; 60 seconds</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-secondary font-bold">For a ₹${amount.toLocaleString()} transfer, you save approximately ₹${swiftSavings.toLocaleString()} in hidden spreads and correspondent agent charges by using our network.</p>
        </div>
      `;
    }

    // 5. Fraud Analyzer
    if (q.includes('flagged') || q.includes('flag') || q.includes('fraud') || q.includes('risk') || q.includes('restricted')) {
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 text-red-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>Understanding Transaction Flagging</h4>
          <p class="text-xs text-muted-foreground leading-normal">As a regulated remittance gateway, AutoUPI runs real-time Anti-Money Laundering (AML) and Politically Exposed Person (PEP) scans under RBI compliance. Transactions may be flagged for structured payments, mismatching recipient profiles, or out-of-profile volumes.</p>
          <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1.5 text-xs text-red-400">
            <p class="font-bold flex items-center gap-1">⚠️ Flagged Indicators:</p>
            <ul class="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>Structuring Check: Breaking large transfers into smaller amounts.</li>
              <li>Verification Mismatch: Recipient bank account name mismatch.</li>
            </ul>
          </div>
          <div class="space-y-2 text-xs">
            <p class="text-white font-bold">To Resolve Flagged States:</p>
            <ol class="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>Confirm recipient identity papers (Passport / Tax ID).</li>
              <li>Attach source of funds document (IT Return / Salary Slip).</li>
              <li>Submit details via your RM chat; compliance reviews settle in 20 minutes.</li>
            </ol>
          </div>
        </div>
      `;
    }

    // 6. Investor Mode
    if (q.includes('investor') || q.includes('deck') || q.includes('moat') || q.includes('tam') || q.includes('competit')) {
      return `
        <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-4 max-w-[95%]">
          <h4 class="text-sm font-bold text-white flex items-center gap-1.5">📈 Investor Deck: AutoUPI Moat & Market</h4>
          <p class="text-xs text-muted-foreground leading-normal">AutoUPI resolves massive cross-border payments friction by linking regional UPI rails to global tokenized banking corridors. Below is our market size and competitive moat analysis.</p>
          
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-white/5 border border-white/10 rounded-xl">
              <p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Total Addressable Market (TAM)</p>
              <p class="text-lg font-bold text-white mt-1">$100B+</p>
              <p class="text-[9px] text-muted-foreground mt-0.5">Annual Indian outward remittance flows</p>
            </div>
            <div class="p-3 bg-white/5 border border-white/10 rounded-xl">
              <p class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Revenue Model</p>
              <p class="text-lg font-bold text-secondary mt-1">2.0% Fee</p>
              <p class="text-[9px] text-muted-foreground mt-0.5">Charged per transaction volume</p>
            </div>
          </div>

          <div class="space-y-2 text-xs border-t border-border/40 pt-3">
            <p class="text-white font-bold">Key Competitive Moats:</p>
            <ul class="list-disc pl-4 space-y-1 text-muted-foreground">
              <li><span class="text-white font-semibold">Regulatory License</span>: Regulated under GIFT City sandbox corridors, fully RBI & FEMA compliant.</li>
              <li><span class="text-white font-semibold">Atomic Tokenized Settlement</span>: Fiat-backed Tokenized Bank Deposit (TBD) nodes skip correspondent banks entirely.</li>
              <li><span class="text-white font-semibold">Corridor Network Effect</span>: Linking banks in India directly to receiver bank rails in USA, UAE, and Singapore.</li>
            </ul>
          </div>
        </div>
      `;
    }

    // Default Fallback
    return `
      <div class="ai-bubble-card p-5 rounded-2xl border border-border text-left mt-2 space-y-3 max-w-[95%]">
        <h4 class="text-sm font-bold text-white">Relationship Desk Response</h4>
        <p class="text-xs text-muted-foreground leading-relaxed">Thank you for asking! AutoUPI solves international remittance limitations by converting fiat deposits into tokenized assets via GIFT City corridors under 60 seconds.</p>
        <p class="text-xs text-muted-foreground leading-relaxed">Please ask for: "Explain my transfer", "Check FEMA compliance", "Why did USD rate increase today?", "Compare AutoUPI vs SWIFT", "Why was my transfer flagged?", or "Explain AutoUPI to an investor" to unlock structured widgets.</p>
      </div>
    `;
  }
}

