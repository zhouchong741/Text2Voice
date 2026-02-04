/**
 * Voice Loop - Logic Script
 */

// --- DOM Elements ---
const els = {
    input: document.getElementById('textInput'),
    interval: document.getElementById('interval'),
    repetitions: document.getElementById('repetitions'),
    rate: document.getElementById('rate'),
    voiceSelect: document.getElementById('voiceSelect'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    currentWord: document.getElementById('currentWord'),
    queueList: document.getElementById('queueList'),
    statusText: document.getElementById('statusText'),
    // timerPie: document.getElementById('timerPie'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    themeToggle: document.getElementById('themeToggle')
};

// --- State ---
const state = {
    isPlaying: false,
    isPaused: false,
    words: [],
    currentIndex: 0,
    mainTimer: null,     // Timer for the 30s interval
    subTimers: [],       // Timers for the repetition within the interval
    animationFrame: null,
    startTime: 0,        // For calculating progress per word
    wordDuration: 0,     // Total duration assigned per word (e.g., 30s)
    voices: []
};

// --- Initialization ---
function init() {
    loadVoices();
    // Mobile browsers often load voices asynchronously with a delay
    // Retry a few times if empty
    let retryCount = 0;
    const retryLoad = () => {
        if (state.voices.length === 0 && retryCount < 5) {
            retryCount++;
            loadVoices();
            setTimeout(retryLoad, 1000);
        }
    };
    setTimeout(retryLoad, 500);

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    bindEvents();

    // Theme Init
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    updateUI();
}

function loadVoices() {
    const allVoices = speechSynthesis.getVoices();
    if (!allVoices || allVoices.length === 0) return;

    state.voices = allVoices;

    // Sort: Preferred lang first (zh-CN > zh* > en > others)
    state.voices.sort((a, b) => {
        const getScore = (voice) => {
            const lang = (voice.lang || '').toLowerCase().replace('_', '-');
            if (lang === 'zh-cn') return 10;
            if (lang.startsWith('zh')) return 5;
            if (lang.startsWith('en')) return 1;
            return 0;
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
    });

    els.voiceSelect.innerHTML = state.voices
        .map((voice, index) => `<option value="${index}">${voice.name} (${voice.lang})</option>`)
        .join('');

    // Default select the first one (highest priority)
    els.voiceSelect.selectedIndex = 0;
}

function bindEvents() {
    els.startBtn.addEventListener('click', startSequence);
    els.pauseBtn.addEventListener('click', togglePause);
    els.resetBtn.addEventListener('click', resetSequence);
    els.themeToggle.addEventListener('click', toggleTheme);

    // Auto-update queue visual on input change
    els.input.addEventListener('input', () => {
        if (!state.isPlaying) parseInput();
    });
}

// --- Core Logic ---

function parseInput() {
    const text = els.input.value.trim();
    if (!text) {
        state.words = [];
    } else {
        // Split by newlines, filtering empty lines
        state.words = text.split(/\r?\n/).map(w => w.trim()).filter(w => w);
    }
    renderQueue();
    updateProgressText();
}

function startSequence() {
    if (state.words.length === 0) parseInput();
    if (state.words.length === 0) {
        alert("请先输入需要朗读的词语！");
        return;
    }

    if (state.isPaused) {
        // Resume logic could be complex with timers. 
        // For simplicity in this version, "Resume" effectively continues from current index state
        // creating new timers.
        state.isPaused = false;
        state.isPlaying = true;
        playWordCycle(); // Restart cycle for current word
    } else {
        // Fresh Start
        state.isPlaying = true;
        state.isPaused = false;
        state.currentIndex = 0;

        // Lock inputs
        els.input.disabled = true;
        els.interval.disabled = true;
        els.repetitions.disabled = true;
        els.rate.disabled = true;

        playWordCycle();
    }
    updateUI();
}

function togglePause() {
    if (!state.isPlaying && !state.isPaused) return;

    if (state.isPlaying) {
        // Pause
        state.isPlaying = false;
        state.isPaused = true;
        clearTimers();
        speechSynthesis.cancel(); // Stop speaking immediately
        els.statusText.textContent = "已暂停";
    }
    updateUI();
}

function resetSequence() {
    state.isPlaying = false;
    state.isPaused = false;
    state.currentIndex = 0;
    clearTimers();
    speechSynthesis.cancel();

    els.input.disabled = false;
    els.interval.disabled = false;
    els.repetitions.disabled = false;
    els.rate.disabled = false;

    els.currentWord.textContent = "...";
    els.statusText.textContent = "准备就绪";
    // els.timerPie.style.setProperty('--percent', '0%');

    renderQueue();
    updateUI();
}

/**
 * Handle the cycle for ONE word (e.g. the 30s window)
 */
function playWordCycle() {
    if (state.currentIndex >= state.words.length) {
        finishSequence();
        return;
    }

    const word = state.words[state.currentIndex];
    const totalDuration = parseInt(els.interval.value, 10) * 1000; // ms
    const reps = parseInt(els.repetitions.value, 10);

    state.startTime = Date.now();
    state.wordDuration = totalDuration;

    // Visual Updates
    updateActiveWord(word);
    scrollToActiveQueue();
    startProgressAnimation();

    // Schedule Repetitions
    // We want to speak 'reps' times evenly distributed within 'totalDuration'
    const intervalSize = totalDuration / reps;

    for (let i = 0; i < reps; i++) {
        const delay = i * intervalSize;
        const timerId = setTimeout(() => {
            speak(word);
            els.statusText.textContent = `第 ${i + 1} / ${reps} 次`;
        }, delay);
        state.subTimers.push(timerId);
    }

    // Schedule Next Word
    const nextTimer = setTimeout(() => {
        state.currentIndex++;
        playWordCycle();
    }, totalDuration);

    state.mainTimer = nextTimer;
}

function speak(text) {
    if (!state.isPlaying && !state.isPaused) return;

    // Cancel current if overlapping (though design prevents overlap if interval is large enough)
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply settings
    const voiceIdx = els.voiceSelect.value;
    if (voiceIdx && state.voices[voiceIdx]) {
        utterance.voice = state.voices[voiceIdx];
    }

    // Rate/Pitch defaults
    const rateVal = parseFloat(els.rate.value) || 1;
    utterance.rate = rateVal;
    utterance.pitch = 1;

    // Visual flare
    els.currentWord.classList.remove('word-animate');
    void els.currentWord.offsetWidth; // trigger reflow
    els.currentWord.classList.add('word-animate');

    speechSynthesis.speak(utterance);
}

function finishSequence() {
    resetSequence();
    els.statusText.textContent = "播放完成";
    els.progressBar.style.width = '100%';
    setTimeout(() => {
        alert("所有内容朗读完毕！");
    }, 100);
}

function clearTimers() {
    if (state.mainTimer) clearTimeout(state.mainTimer);
    state.subTimers.forEach(t => clearTimeout(t));
    state.subTimers = [];
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
}

// --- Visual Logic ---

function startProgressAnimation() {
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);

    function tick() {
        if (!state.isPlaying) return;

        const now = Date.now();
        const elapsed = now - state.startTime;
        let percent = (elapsed / state.wordDuration) * 100;

        if (percent > 100) percent = 100;

        // Update Pie
        // els.timerPie.style.setProperty('--percent', `${percent}%`);

        // Update Bar (Global Progress)
        const totalWords = state.words.length;
        // Base progress on completed words
        const basePercent = (state.currentIndex / totalWords) * 100;
        // Add current word fraction
        const additional = (percent / 100) * (1 / totalWords) * 100;

        els.progressBar.style.width = `${basePercent + additional}%`;

        if (percent < 100) {
            state.animationFrame = requestAnimationFrame(tick);
        }
    }
    tick();
}

function renderQueue() {
    els.queueList.innerHTML = '';

    if (state.words.length === 0) {
        els.queueList.innerHTML = '<li class="empty-state">等待输入...</li>';
        return;
    }

    state.words.forEach((w, i) => {
        const li = document.createElement('li');
        li.className = 'queue-item';
        li.textContent = w;
        if (i === state.currentIndex && (state.isPlaying || state.isPaused)) {
            li.classList.add('active');
        }
        els.queueList.appendChild(li);
    });
}

function updateActiveWord(word) {
    els.currentWord.textContent = word;
    // statusText will be updated by the loop in playWordCycle
    renderQueue(); // To update active class
    updateProgressText();
}

function updateProgressText() {
    const total = state.words.length;
    const current = state.isPlaying || state.isPaused ? state.currentIndex + 1 : 0;
    els.progressText.textContent = `${Math.min(current, total)} / ${total}`;
}

function scrollToActiveQueue() {
    const active = document.querySelector('.queue-item.active');
    if (active) {
        active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateUI() {
    if (state.isPlaying) {
        els.startBtn.style.display = 'none';
        els.pauseBtn.style.display = 'inline-block';
        els.pauseBtn.disabled = false;
        els.pauseBtn.textContent = '暂停 ⏸';
        els.resetBtn.disabled = true; // Avoid reset while playing to prevent bugs
    } else if (state.isPaused) {
        els.startBtn.style.display = 'inline-block';
        els.startBtn.textContent = '继续 ▶';
        els.pauseBtn.style.display = 'none';
        els.resetBtn.disabled = false;
    } else {
        els.startBtn.style.display = 'inline-block';
        els.startBtn.textContent = '开始播放 ▶';
        els.pauseBtn.style.display = 'none';
        els.resetBtn.disabled = false;
    }
}

// Start
init();
