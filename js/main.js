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
