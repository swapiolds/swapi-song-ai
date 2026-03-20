(function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.z = 85;

    const COUNT = 900;
    const pos = new Float32Array(COUNT * 3);
    const sz = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * 210;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 210;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
        sz[i] = Math.random() * 2.8 + 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uC1: { value: new THREE.Color('#9b6dff') },
            uC2: { value: new THREE.Color('#00d4ff') },
        },
        vertexShader: `
            attribute float size;
            uniform float uTime;
            void main() {
                vec3 p = position;
                p.y += sin(uTime * 0.25 + position.x * 0.04) * 2.5;
                p.x += cos(uTime * 0.18 + position.z * 0.04) * 1.8;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = size * (260.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform vec3 uC1;
            uniform vec3 uC2;
            void main() {
                vec2 uv = gl_PointCoord - 0.5;
                if (length(uv) > 0.5) discard;
                float a = smoothstep(0.5, 0.05, length(uv)) * 0.5;
                gl_FragColor = vec4(mix(uC1, uC2, gl_PointCoord.x), a);
            }
        `,
        transparent: true, depthWrite: false,
    });

    const pts = new THREE.Points(geo, mat);
    scene.add(pts);

    const clock = new THREE.Clock();
    (function animate() {
        requestAnimationFrame(animate);
        mat.uniforms.uTime.value = clock.getElapsedTime();
        pts.rotation.y += 0.0003;
        pts.rotation.x += 0.00008;
        renderer.render(scene, camera);
    })();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();

const GENRE_PALETTES = {
    'Pop':      [['#ff6fd8','#ff9a9e','#ffecd2'], 'radial'],
    'Rock':     [['#1a1a2e','#e94560','#f5a623'], 'linear'],
    'Electronic':[['#0f3460','#00d4ff','#9b6dff'], 'radial'],
    'Hip-Hop':  [['#121212','#ff6b6b','#ffd93d'], 'linear'],
    'R&B/Soul': [['#2d1b69','#c77dff','#e040fb'], 'radial'],
    'Jazz':     [['#1b2838','#f9a825','#e65100'], 'linear'],
    'Ballad':   [['#0d47a1','#90caf9','#e3f2fd'], 'radial'],
    'Latin':    [['#b71c1c','#ff8f00','#f9a825'], 'radial'],
    'Metal':    [['#090909','#37474f','#b0bec5'], 'linear'],
    'Country':  [['#4e342e','#ff8a65','#ffccbc'], 'linear'],
    'Funk':     [['#1a237e','#7c4dff','#18ffff'], 'radial'],
    'Soundtrack':[['#0a0a0a','#6200ea','#00bcd4'], 'radial'],
    'Auto':     [['#9b6dff','#00d4ff','#ff5ee0'], 'radial'],
};

function drawArtwork(canvas, genre) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const entry = GENRE_PALETTES[genre] || GENRE_PALETTES['Auto'];
    const [colors, type] = entry;

    let grad;
    if (type === 'radial') {
        grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W/2);
    } else {
        grad = ctx.createLinearGradient(0, 0, W, H);
    }
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    for (let r = 20; r < W; r += 28) {
        ctx.beginPath();
        ctx.arc(W/2, H/2, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(W/2, H/2, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.restore();
}

let audioCtx = null, analyser = null, sourceNode = null, waveAnimId = null;

function initWebAudio(audioEl) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sourceNode) { try { sourceNode.disconnect(); } catch(e) {} }
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
}

function startWaveform(canvas) {
    if (!analyser) return;
    const ctx = canvas.getContext('2d');
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    if (waveAnimId) cancelAnimationFrame(waveAnimId);

    function draw() {
        waveAnimId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);

        const W = canvas.width = canvas.offsetWidth;
        const H = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, W, H);

        const barW = (W / bufLen) * 2.5;
        let x = 0;
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, '#9b6dff');
        grad.addColorStop(0.5, '#00d4ff');
        grad.addColorStop(1, '#ff5ee0');

        for (let i = 0; i < bufLen; i++) {
            const barH = (data[i] / 255) * H;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, H - barH, barW - 1, barH, 2);
            ctx.fill();
            x += barW + 1;
        }
    }
    draw();
}

function stopWaveform(canvas) {
    if (waveAnimId) cancelAnimationFrame(waveAnimId);
    waveAnimId = null;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

let skTimer = null;
const SK_STEPS = [
    { pct: 8,  label: 'Composing melody...' },
    { pct: 22, label: 'Arranging instruments...' },
    { pct: 40, label: 'Generating vocals...' },
    { pct: 58, label: 'Mixing audio...' },
    { pct: 72, label: 'Applying effects...' },
    { pct: 85, label: 'Finalizing track...' },
    { pct: 94, label: 'Almost there...' },
];

function startSkeleton() {
    const fill = document.getElementById('sk-fill');
    const label = document.getElementById('sk-label');
    if (!fill || !label) return;

    let step = 0;
    fill.style.width = '3%';
    label.textContent = 'Starting generation...';

    skTimer = setInterval(() => {
        if (step < SK_STEPS.length) {
            fill.style.width = SK_STEPS[step].pct + '%';
            label.textContent = SK_STEPS[step].label;
            step++;
        }
    }, 4500);
}

function stopSkeleton() {
    clearInterval(skTimer);
    const fill = document.getElementById('sk-fill');
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
        if (fill) fill.style.width = '0%';
    }, 600);
}

function showPanel(id) {
    ['state-idle','state-loading','result-ready'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
}

document.addEventListener('DOMContentLoaded', () => {

    const toastContainer = document.getElementById('toast-container');

    function showToast({ icon, iconClass, title, desc, duration = 3500 }) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `
            <div class="toast-icon ${iconClass}"><i class='bx ${icon}'></i></div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${desc}</div>
            </div>`;
        toastContainer.appendChild(t);
        requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
        setTimeout(() => {
            t.classList.remove('show');
            t.classList.add('hide');
            setTimeout(() => t.remove(), 400);
        }, duration);
    }

    window._toastDownload = () => showToast({
        icon: 'bx-download',
        iconClass: 'download',
        title: '⬇️ Downloaded!',
        desc: 'Your song was saved as a FLAC file.',
    });

    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    function goTo(id) {
        pages.forEach(p => p.classList.remove('active-page'));
        navLinks.forEach(l => l.classList.remove('active'));
        const p = document.getElementById('page-' + id);
        const l = document.querySelector(`.nav-link[data-page="${id}"]`);
        if (p) p.classList.add('active-page');
        if (l) l.classList.add('active');
    }

    navLinks.forEach(l => l.addEventListener('click', e => { e.preventDefault(); goTo(l.dataset.page); }));
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.goto)));

    document.querySelectorAll('.card-3d').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `perspective(800px) rotateY(${x * 20}deg) rotateX(${-y * 14}deg) translateY(-6px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    function isEnglish(text) {
        const nonLatin = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
        return !nonLatin.test(text);
    }

    const generateBtn = document.getElementById('generate-btn');
    const btnLabel = document.getElementById('btn-label');
    const spinner = document.getElementById('spinner');
    const errorBox = document.getElementById('error-box');
    const lyricsEl = document.getElementById('lyrics');
    const genreEl = document.getElementById('genre');
    const descEl = document.getElementById('description');

    const resultTitle = document.getElementById('result-title');
    const resultGenreEl = document.getElementById('result-genre');
    const resultDownload = document.getElementById('result-download');
    const resultPlayBtn = document.getElementById('result-play-btn');
    const resultPlayIcon = resultPlayBtn.querySelector('i');
    const artworkCanvas = document.getElementById('artwork-canvas');
    const waveformCanvas = document.getElementById('waveform-canvas');

    const library = [];
    let currentAudioUrl = null;
    let audioInitialized = false;

    let genTimer = null;
    function setGenerating(on) {
        generateBtn.disabled = on;
        spinner.classList.toggle('hidden', !on);
        if (on) {
            let s = 0;
            btnLabel.textContent = 'Generating... 0s';
            genTimer = setInterval(() => { s++; btnLabel.textContent = `Generating... ${s}s`; }, 1000);
            showPanel('state-loading');
            startSkeleton();
        } else {
            clearInterval(genTimer);
            btnLabel.textContent = 'Generate Song';
            stopSkeleton();
        }
    }

    function showError(msg) {
        let friendly = msg;
        if (/timed out|timeout|handshake/i.test(msg)) {
            friendly = '⏱ The AI server took too long. HuggingFace free tier can be busy — please try again in a moment.';
        }
        errorBox.textContent = friendly;
        errorBox.classList.remove('hidden');
        showPanel('state-idle');
    }

    generateBtn.addEventListener('click', async () => {
        const lyrics = lyricsEl.value.trim();
        if (!lyrics) return showError('Please enter your lyrics first.');
        if (!isEnglish(lyrics)) {
            return showError('🌍 Only English lyrics are supported. Please write your lyrics in English.');
        }
        if (!/\[(verse|chorus|bridge)\]/i.test(lyrics)) {
            return showError('Your lyrics need at least one vocal tag like [verse] or [chorus].');
        }

        setGenerating(true);
        errorBox.classList.add('hidden');

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lyrics,
                    description: descEl.value.trim(),
                    genre: genreEl.value,
                    cfg_coef: 1.8,
                    temperature: 0.8,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Generation failed.');
            if (!data.success) throw new Error('Generation failed.');

            const url = data.audio_url;
            const title = descEl.value.trim() || (genreEl.value !== 'Auto' ? genreEl.value + ' Track' : 'AI Generated Track');
            const genre = genreEl.value;

            showResult(url, title, genre);

            showToast({
                icon: 'bx-music',
                iconClass: 'success',
                title: '🎵 Song Ready!',
                desc: `"${title}" generated. Hit play to listen!`,
                duration: 4000,
            });

            loadPlayer(url, title, genre);
            library.push({ title, url, genre, time: new Date().toLocaleTimeString() });
            renderLibrary();

        } catch (err) {
            showError(err.message);
        } finally {
            setGenerating(false);
        }
    });

    function showResult(url, title, genre) {
        currentAudioUrl = url;
        resultTitle.textContent = title;
        resultGenreEl.textContent = genre + ' · Swapi AI';
        resultDownload.href = url;
        resultDownload.download = title.replace(/\s+/g, '_') + '.flac';
        drawArtwork(artworkCanvas, genre);
        showPanel('result-ready');
    }

    resultPlayBtn.addEventListener('click', () => {
        if (!currentAudioUrl) return;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audio.paused ? audio.play() : audio.pause();
    });

    const audio = document.getElementById('audio');
    const playBtn = document.getElementById('btn-play');
    const playIcon = document.getElementById('play-icon');
    const progressTrack = document.getElementById('progress-track');
    const progressFill = document.getElementById('progress-fill');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const playerTitle = document.getElementById('player-title');
    const playerThumb = document.getElementById('player-thumb');
    const downloadBtn = document.getElementById('download-btn');

    function loadPlayer(url, title, genre) {
        if (!audioInitialized) {
            try {
                initWebAudio(audio);
                audioInitialized = true;
            } catch(e) { console.warn('Web Audio init failed:', e); }
        }
        audio.src = url;
        playerTitle.textContent = title;
        downloadBtn.href = url;
        downloadBtn.download = title.replace(/\s+/g, '_') + '.flac';
        downloadBtn.classList.remove('hidden');
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 46; thumbCanvas.height = 46;
        drawArtwork(thumbCanvas, genre || 'Auto');
        playerThumb.innerHTML = '';
        playerThumb.style.background = 'none';
        thumbCanvas.style.width = '100%';
        thumbCanvas.style.height = '100%';
        thumbCanvas.style.borderRadius = '10px';
        playerThumb.appendChild(thumbCanvas);
        audio.play();
    }

    audio.addEventListener('play', () => {
        playIcon.className = 'bx bx-pause-circle';
        resultPlayIcon.className = 'bx bx-pause';
        artworkCanvas.classList.add('spinning');
        if (audioInitialized && waveformCanvas) startWaveform(waveformCanvas);
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    });

    audio.addEventListener('pause', () => {
        playIcon.className = 'bx bx-play-circle';
        resultPlayIcon.className = 'bx bx-play';
        artworkCanvas.classList.remove('spinning');
        stopWaveform(waveformCanvas);
    });

    audio.addEventListener('ended', () => {
        playIcon.className = 'bx bx-play-circle';
        resultPlayIcon.className = 'bx bx-play';
        artworkCanvas.classList.remove('spinning');
        stopWaveform(waveformCanvas);
    });

    audio.addEventListener('timeupdate', () => {
        if (!isNaN(audio.duration)) {
            const pct = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = pct + '%';
            timeCurrent.textContent = fmt(audio.currentTime);
            timeTotal.textContent = fmt(audio.duration);
        }
    });

    playBtn.addEventListener('click', () => {
        if (!audio.src) return;
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audio.paused ? audio.play() : audio.pause();
    });

    progressTrack.addEventListener('click', e => {
        if (!audio.src || isNaN(audio.duration)) return;
        const r = progressTrack.getBoundingClientRect();
        audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });

    function fmt(s) {
        const m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }

    function renderLibrary() {
        const list = document.getElementById('library-list');
        if (!library.length) {
            list.innerHTML = `<div class="empty-state"><i class='bx bx-music'></i><p>No tracks yet. Go create your first song!</p><button class="btn-ghost" data-goto="create"><i class='bx bx-magic-wand'></i> Create Now</button></div>`;
            list.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.goto)));
            return;
        }
        list.innerHTML = [...library].reverse().map((item, ri) => {
            const i = library.length - 1 - ri;
            const c = document.createElement('canvas');
            c.width = 44; c.height = 44;
            drawArtwork(c, item.genre);
            const dataUrl = c.toDataURL();
            return `
            <div class="library-item" data-i="${i}">
                <img src="${dataUrl}" class="lib-icon-img" alt="art">
                <div class="lib-info">
                    <div class="lib-title">${item.title}</div>
                    <div class="lib-meta">${item.genre} · ${item.time}</div>
                </div>
                <div class="lib-actions">
                    <button class="lib-btn play-lib" data-i="${i}" title="Play"><i class='bx bx-play-circle'></i></button>
                    <a href="${item.url}" download="${item.title.replace(/\s+/g,'_')}.flac" class="lib-btn lib-dl" title="Download" onclick="window._toastDownload()"><i class='bx bx-download'></i></a>
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.play-lib').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const item = library[btn.dataset.i];
                showResult(item.url, item.title, item.genre);
                loadPlayer(item.url, item.title, item.genre);
            });
        });

        list.querySelectorAll('.library-item').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.closest('.lib-actions')) return;
                const item = library[el.dataset.i];
                showResult(item.url, item.title, item.genre);
                loadPlayer(item.url, item.title, item.genre);
            });
        });
    }

    renderLibrary();
    showPanel('state-idle');
});

