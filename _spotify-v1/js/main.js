// ============ LANGUAGE SWITCHER ============
function setLanguage(lang) {
  const dict = translations[lang];
  if (!dict) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Update active button
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // Update html lang attribute
  document.documentElement.lang = lang;

  // Save preference
  try { localStorage.setItem('preferred_lang', lang); } catch(e) {}
}

let currentLang = 'th';
const _setLanguage = setLanguage;
setLanguage = function (lang) {
  if (translations[lang]) currentLang = lang;
  _setLanguage(lang);
};

// Wire up language buttons
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang'));
  });
});

// Load saved preference (default: th)
let savedLang = 'th';
try { savedLang = localStorage.getItem('preferred_lang') || 'th'; } catch(e) {}
setLanguage(savedLang);

// ============ TOPBAR SCROLL ============
const main = document.getElementById('main');
const topbar = document.getElementById('topbar');
main.addEventListener('scroll', () => {
  if (main.scrollTop > 60) {
    topbar.classList.add('scrolled');
  } else {
    topbar.classList.remove('scrolled');
  }
});

// ============ BUTTON ANIMATIONS ============
document.querySelectorAll('.play-btn, .player-play, .card-play').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => btn.style.transform = '', 150);
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============ FAKE PLAYER ============
// Track 0 is the intro ("Hello, I'm Atom"); 1–4 are the Popular tracks.
const playlist = [
  { key: 'now_title', cover: 'A', length: 272 },
  { key: 'track1_title', cover: '💻', length: 214 },
  { key: 'track2_title', cover: '🚗', length: 198 },
  { key: 'track3_title', cover: '🌏', length: 236 },
  { key: 'track4_title', cover: '🎨', length: 187 }
];

const nowTitle = document.getElementById('now-title');
const nowCover = document.getElementById('now-cover');
const progressFill = document.getElementById('progress-fill');
const progressBar = document.getElementById('progress-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

let current = 0;
let position = 0;
let playing = false;
let timer = null;

const fmt = secs => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

function renderProgress() {
  const length = playlist[current].length;
  progressFill.style.width = `${(position / length) * 100}%`;
  timeCurrent.textContent = fmt(position);
  timeTotal.textContent = fmt(length);
}

function loadTrack(index) {
  current = (index + playlist.length) % playlist.length;
  position = 0;
  const track = playlist[current];
  nowTitle.setAttribute('data-i18n', track.key);
  nowTitle.textContent = translations[currentLang][track.key];
  nowCover.textContent = track.cover;
  document.querySelectorAll('.track').forEach(el => {
    el.classList.toggle('playing', Number(el.dataset.track) === current);
  });
  renderProgress();
}

function setPlaying(state) {
  playing = state;
  document.body.classList.toggle('is-playing', playing);
  clearInterval(timer);
  if (playing) {
    timer = setInterval(() => {
      position += 1;
      if (position >= playlist[current].length) loadTrack(current + 1);
      renderProgress();
    }, 1000);
  }
}

document.querySelectorAll('.js-toggle-play').forEach(btn => {
  btn.addEventListener('click', () => setPlaying(!playing));
});
document.querySelector('.js-next').addEventListener('click', () => loadTrack(current + 1));
document.querySelector('.js-prev').addEventListener('click', () => {
  if (position > 3) { position = 0; renderProgress(); } else { loadTrack(current - 1); }
});

document.querySelectorAll('.track').forEach(el => {
  el.addEventListener('click', () => {
    const index = Number(el.dataset.track);
    if (index === current) { setPlaying(!playing); return; }
    loadTrack(index);
    setPlaying(true);
  });
});

progressBar.addEventListener('click', e => {
  const rect = progressBar.getBoundingClientRect();
  position = Math.floor(((e.clientX - rect.left) / rect.width) * playlist[current].length);
  renderProgress();
});

loadTrack(0);
setPlaying(!reduceMotion);

// ============ SCROLL REVEAL ============
document.querySelectorAll('.reveal').forEach(section => {
  section.querySelectorAll('.card, .skill-card, .exp-card').forEach((el, i) => el.style.setProperty('--i', i));
  section.querySelectorAll('.chip-tag').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12)));
});

if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { root: main, threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// ============ COUNT-UP NUMBERS ============
document.querySelectorAll('.count-up').forEach(el => {
  const target = Number(el.dataset.target);
  if (reduceMotion) return;
  const start = performance.now();
  const duration = 1200;
  const step = now => {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

// ============ CARD TILT ============
if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}
