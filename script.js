/**
 * Voice Loop - Logic Script
 */

// --- DOM Elements ---
// --- DOM Elements ---
const els = {
    input: document.getElementById('textInput'),
    interval: document.getElementById('interval'),
    repetitions: document.getElementById('repetitions'),
    rate: document.getElementById('rate'),
    voiceBtnCN: document.getElementById('voiceBtnCN'),
    voiceBtnEN: document.getElementById('voiceBtnEN'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    currentWord: document.getElementById('currentWord'),
    queueList: document.getElementById('queueList'),
    statusText: document.getElementById('statusText'),
    // progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    themeToggle: document.getElementById('themeToggle')
};

// --- State ---
const state = {
    isPlaying: false,
    isPaused: false,
    words: [],
    currentIndex: 0,
    mainTimer: null,
    subTimers: [],
    animationFrame: null,
    startTime: 0,
    wordDuration: 0,
    voices: [],
    currentLang: 'CN', // 'CN' or 'EN'
    voiceCN: null,
    voiceEN: null,
    currentAudio: null,
    ttsConfig: Text2VoiceTTS.getTtsConfig(window.TEXT2VOICE_TTS)
};

// --- Initialization ---
function init() {
    loadVoices();
    let retryCount = 0;
    const retryLoad = () => {
        if ((!state.voiceCN || !state.voiceEN) && retryCount < 5) {
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

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const forceLoadOnInteraction = () => {
        if (!state.voiceCN || !state.voiceEN) {
            loadVoices();
            if (speechSynthesis.paused) speechSynthesis.resume();
        }
    };
    document.addEventListener('touchstart', forceLoadOnInteraction, { passive: true });
    document.addEventListener('click', forceLoadOnInteraction, { passive: true });

    updateUI();
}

function loadVoices() {
    const allVoices = speechSynthesis.getVoices();
    if (!allVoices || allVoices.length === 0) return;

    state.voices = allVoices;

    // 1. Google 普通话 (zh-CN)
    // 2. Microsoft Zira (en-US)
    state.voiceCN = allVoices.find(v => v.name.includes('Google') && (v.lang === 'zh-CN' || v.name.includes('ZH-CN'))) ||
        allVoices.find(v => v.lang === 'zh-CN') ||
        allVoices.find(v => v.lang.startsWith('zh'));

    state.voiceEN = allVoices.find(v => v.name.includes('Microsoft Zira') && v.lang === 'en-US') ||
        allVoices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
        allVoices.find(v => v.lang === 'en-US');

    console.log("Loaded Voices:", { CN: state.voiceCN?.name, EN: state.voiceEN?.name });
}

function bindEvents() {
    els.startBtn.addEventListener('click', startSequence);
    els.pauseBtn.addEventListener('click', togglePause);
    els.resetBtn.addEventListener('click', resetSequence);
    els.themeToggle.addEventListener('click', toggleTheme);

    // Voice Toggles
    els.voiceBtnCN.addEventListener('click', () => setVoice('CN'));
    els.voiceBtnEN.addEventListener('click', () => setVoice('EN'));

    // Auto-update queue visual on input change
    els.input.addEventListener('input', () => {
        if (!state.isPlaying) parseInput();
    });
}

function setVoice(lang) {
    state.currentLang = lang;
    if (lang === 'CN') {
        els.voiceBtnCN.classList.add('active');
        els.voiceBtnEN.classList.remove('active');
    } else {
        els.voiceBtnEN.classList.add('active');
        els.voiceBtnCN.classList.remove('active');
    }
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
        stopCurrentSpeech();
        els.statusText.textContent = "已暂停";
    }
    updateUI();
}

function resetSequence() {
    state.isPlaying = false;
    state.isPaused = false;
    state.currentIndex = 0;
    clearTimers();
    stopCurrentSpeech();

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

    stopCurrentSpeech();
    animateCurrentWord();

    if (Text2VoiceTTS.shouldUseCloudTts(state.ttsConfig)) {
        speakWithCloud(text).catch((err) => {
            console.warn('Cloud TTS failed, falling back to browser voice:', err);
            if (state.isPlaying || state.isPaused) {
                els.statusText.textContent = '云端语音失败，已使用本机语音';
                speakWithBrowser(text);
            }
        });
        return;
    }

    speakWithBrowser(text);
}

async function speakWithCloud(text) {
    const payload = Text2VoiceTTS.buildTtsPayload(text, state.currentLang, els.rate.value);
    if (!payload.text) return;
    if (payload.text.length > state.ttsConfig.maxTextLength) {
        throw new Error(`Text is longer than ${state.ttsConfig.maxTextLength} characters`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.ttsConfig.timeoutMs);

    try {
        const response = await fetch(state.ttsConfig.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        state.currentAudio = audio;
        audio.playbackRate = Math.min(Math.max(payload.rate, 0.5), 2);
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl), { once: true });
        audio.addEventListener('error', () => URL.revokeObjectURL(audioUrl), { once: true });
        await audio.play();
    } finally {
        clearTimeout(timeoutId);
    }
}

function speakWithBrowser(text) {
    const utterance = new SpeechSynthesisUtterance(text);

    const targetVoice = state.currentLang === 'CN' ? state.voiceCN : state.voiceEN;
    if (targetVoice) {
        utterance.voice = targetVoice;
    }

    const rateVal = parseFloat(els.rate.value) || 1;
    utterance.rate = rateVal;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
}

function stopCurrentSpeech() {
    speechSynthesis.cancel();

    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio = null;
    }
}

function animateCurrentWord() {
    els.currentWord.classList.remove('word-animate');
    void els.currentWord.offsetWidth;
    els.currentWord.classList.add('word-animate');
}

function finishSequence() {
    resetSequence();
    els.statusText.textContent = "播放完成";
    // els.progressBar.style.width = '100%';
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

        // els.progressBar.style.width = `${basePercent + additional}%`;

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
