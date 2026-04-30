/* ═══════════════════════════════════════════════════════
   SafarBot – Frontend Logic
   Chat, Weather (Real-Time), Google Maps, Explore
   ═══════════════════════════════════════════════════════ */

const SESSION_ID = 'sb_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

// ─── DOM Elements ────────────────────────────────────
const chatArea       = document.getElementById('chatArea');
const messagesEl     = document.getElementById('messages');
const welcomeScreen  = document.getElementById('welcomeScreen');
const chatForm       = document.getElementById('chatForm');
const messageInput   = document.getElementById('messageInput');
const sendBtn        = document.getElementById('sendBtn');
const btnExplore     = document.getElementById('btnExplore');
const btnNewChat     = document.getElementById('btnNewChat');
const btnWeather     = document.getElementById('btnWeather');
const btnMap         = document.getElementById('btnMap');
const exploreOverlay = document.getElementById('exploreOverlay');
const exploreClose   = document.getElementById('exploreClose');
const exploreGrid    = document.getElementById('exploreGrid');
const exploreFilters = document.getElementById('exploreFilters');
const exploreSearch  = document.getElementById('exploreSearch');
const detailOverlay  = document.getElementById('detailOverlay');
const detailClose    = document.getElementById('detailClose');
const detailContent  = document.getElementById('detailContent');
const quickActions   = document.getElementById('quickActions');
const floatingEmojis = document.getElementById('floatingEmojis');
const weatherOverlay = document.getElementById('weatherOverlay');
const weatherClose   = document.getElementById('weatherClose');
const mapOverlay     = document.getElementById('mapOverlay');
const mapClose       = document.getElementById('mapClose');

// ─── State ───────────────────────────────────────────
let isProcessing = false;
let chatStarted = false;
let exploreTab = 'india';
let exploreRegion = 'All';
let currentMapQuery = 'India';
let currentMapType = '';

// ═══════════════════════════════════════════════════════
//  MODAL SYSTEM (Weather / Map)
// ═══════════════════════════════════════════════════════
function openModal(overlay) {
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(overlay) {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Header buttons
btnWeather.addEventListener('click', () => openModal(weatherOverlay));
btnMap.addEventListener('click', () => openModal(mapOverlay));
weatherClose.addEventListener('click', () => closeModal(weatherOverlay));
mapClose.addEventListener('click', () => closeModal(mapOverlay));
weatherOverlay.addEventListener('click', (e) => { if (e.target === weatherOverlay) closeModal(weatherOverlay); });
mapOverlay.addEventListener('click', (e) => { if (e.target === mapOverlay) closeModal(mapOverlay); });

// Welcome screen buttons
document.getElementById('welcomeWeatherBtn')?.addEventListener('click', () => openModal(weatherOverlay));
document.getElementById('welcomeMapBtn')?.addEventListener('click', () => openModal(mapOverlay));
document.getElementById('welcomeExploreBtn')?.addEventListener('click', () => openExplore());

// ═══════════════════════════════════════════════════════
//  CHAT SYSTEM
// ═══════════════════════════════════════════════════════
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (!msg || isProcessing) return;
  sendMessage(msg);
});

quickActions.addEventListener('click', (e) => {
  const btn = e.target.closest('.quick-btn');
  if (!btn) return;
  const msg = btn.dataset.msg;
  if (msg) sendMessage(msg);
});

async function sendMessage(text) {
  isProcessing = true;
  sendBtn.disabled = true;
  messageInput.value = '';
  if (!chatStarted) {
    chatStarted = true;
    welcomeScreen.style.display = 'none';
  }
  appendMessage('user', text);
  scrollToBottom();
  const typingEl = showTyping();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
    });
    const data = await res.json();
    typingEl.remove();
    if (data.error) {
      appendMessage('bot', `⚠️ ${data.error}`);
    } else {
      appendMessage('bot', data.reply);
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('bot', '## ❌ Connection Error\n\nCould not reach the server. Make sure server is running.');
  }
  isProcessing = false;
  sendBtn.disabled = false;
  messageInput.focus();
  scrollToBottom();
}

function appendMessage(type, text) {
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = type === 'bot' ? '✈️' : '👤';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = type === 'bot' ? renderMarkdown(text) : escapeHtml(text);

  // Add action cards for bot messages (detect city names)
  if (type === 'bot') {
    const actions = buildChatActions(text);
    if (actions) bubble.appendChild(actions);
  }

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  scrollToBottom();
}

// ─── Chat Action Cards (detect cities → weather/map buttons) ───
function buildChatActions(text) {
  if (typeof DESTINATIONS === 'undefined') return null;
  const lowerText = text.toLowerCase();
  const found = [];
  DESTINATIONS.forEach(d => {
    if (lowerText.includes(d.name.toLowerCase()) && !found.includes(d.name)) found.push(d.name);
  });
  const cities = found.slice(0, 3);
  if (cities.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'chat-actions';
  cities.forEach(city => {
    const wBtn = document.createElement('button');
    wBtn.className = 'chat-action-pill';
    wBtn.textContent = `🌦️ Weather in ${city}`;
    wBtn.addEventListener('click', () => {
      openModal(weatherOverlay);
      document.getElementById('weatherCityInput').value = city;
      document.getElementById('weatherForm').dispatchEvent(new Event('submit'));
    });
    const mBtn = document.createElement('button');
    mBtn.className = 'chat-action-pill';
    mBtn.textContent = `🗺️ ${city} on Map`;
    mBtn.addEventListener('click', () => {
      openModal(mapOverlay);
      document.getElementById('mapSearchInput').value = city;
      updateGoogleMap(city);
    });
    container.appendChild(wBtn);
    container.appendChild(mBtn);
  });
  return container;
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = `<div class="msg-avatar">✈️</div><div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
  });
}

// ═══════════════════════════════════════════════════════
//  MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return '';
  let h = text;
  h = h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/^---+$/gm, '<hr/>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/((?:^[\t ]*[-*] .+$\n?)+)/gm, (m) => {
    const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[\t ]*[-*] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  h = h.replace(/((?:^[\t ]*\d+\. .+$\n?)+)/gm, (m) => {
    const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[\t ]*\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  h = h.split('\n').map(l => {
    const t = l.trim();
    if (!t) return '';
    if (t.startsWith('<h') || t.startsWith('<ul') || t.startsWith('<ol') || t.startsWith('<li') || t.startsWith('<hr') || t.startsWith('</')) return t;
    return `<p>${t}</p>`;
  }).join('\n');
  h = h.replace(/<p><\/p>/g, '');
  h = h.replace(/<\/ul>\s*<ul>/g, '');
  h = h.replace(/<\/ol>\s*<ol>/g, '');
  return h;
}

// ═══════════════════════════════════════════════════════
//  WEATHER SYSTEM (Real-Time)
// ═══════════════════════════════════════════════════════
const weatherForm = document.getElementById('weatherForm');
const weatherCityInput = document.getElementById('weatherCityInput');
const weatherResult = document.getElementById('weatherResult');

weatherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = weatherCityInput.value.trim();
  if (!city) return;
  weatherResult.innerHTML = '<div class="weather-loading-anim"><div class="weather-spinner"></div><span>Fetching weather for <strong>' + escapeHtml(city) + '</strong>...</span></div>';

  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const c = data.current;
    const weatherEmoji = getWeatherEmoji(c.description);
    const travelTip = getTravelTip(c.temp, c.description);

    const fHtml = data.forecast.map(f => `
      <div class="forecast-day">
        <div class="forecast-date">${f.date}</div>
        <div class="forecast-temps">${f.maxTemp}° / ${f.minTemp}°</div>
        <div class="forecast-desc">${f.description}</div>
        <div class="forecast-desc">🌧 ${f.chanceOfRain}%</div>
      </div>
    `).join('');

    weatherResult.innerHTML = `
      <div class="weather-current">
        <div class="weather-emoji-big">${weatherEmoji}</div>
        <div class="weather-temp">${c.temp}°C</div>
        <div class="weather-details">
          <div class="weather-desc">${c.description}</div>
          <div class="weather-stats">
            <span class="weather-stat">🌡 Feels ${c.feelsLike}°C</span>
            <span class="weather-stat">💧 ${c.humidity}%</span>
            <span class="weather-stat">💨 ${c.wind} km/h</span>
            <span class="weather-stat">☀️ UV ${c.uvIndex}</span>
          </div>
        </div>
      </div>
      <div class="weather-travel-tip">${travelTip}</div>
      <div class="weather-forecast">${fHtml}</div>
      <button class="weather-map-btn" id="weatherViewMap">🗺️ View ${escapeHtml(city)} on Google Maps</button>
    `;

    document.getElementById('weatherViewMap')?.addEventListener('click', () => {
      closeModal(weatherOverlay);
      openModal(mapOverlay);
      document.getElementById('mapSearchInput').value = city;
      updateGoogleMap(city);
    });
  } catch (err) {
    weatherResult.innerHTML = `<div class="weather-error">❌ Could not fetch weather for "${escapeHtml(city)}". Try another city.</div>`;
  }
});

// "My Location" button for weather
document.getElementById('weatherLocateBtn')?.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported by your browser.');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || '';
        if (city) {
          weatherCityInput.value = city;
          weatherForm.dispatchEvent(new Event('submit'));
        }
      } catch { alert('Could not detect your city.'); }
    },
    () => alert('Location access denied. Please allow it in your browser.')
  );
});

function getWeatherEmoji(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('sunny') || d.includes('clear')) return '☀️';
  if (d.includes('partly cloudy')) return '⛅';
  if (d.includes('cloud') || d.includes('overcast')) return '☁️';
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
  if (d.includes('thunder') || d.includes('storm')) return '⛈️';
  if (d.includes('snow') || d.includes('blizzard')) return '❄️';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫️';
  if (d.includes('wind')) return '💨';
  return '🌤️';
}

function getTravelTip(temp, desc) {
  const d = (desc || '').toLowerCase();
  const t = parseInt(temp);
  if (d.includes('rain') || d.includes('storm')) return '🌂 <strong>Carry an umbrella!</strong> Rainy weather — indoor attractions recommended today.';
  if (d.includes('snow')) return '🧣 <strong>Bundle up!</strong> Snowy conditions — perfect for winter activities.';
  if (t > 38) return '🥵 <strong>Extreme heat!</strong> Stay hydrated, avoid outdoor activities mid-day.';
  if (t > 30) return '😎 <strong>Hot & sunny!</strong> Great for sightseeing — carry sunscreen & water.';
  if (t < 5) return '🥶 <strong>Very cold!</strong> Layer up and keep warm drinks handy.';
  if (d.includes('sunny') || d.includes('clear')) return '✨ <strong>Perfect weather!</strong> Great day to explore outdoors.';
  return '👍 <strong>Decent weather.</strong> Good conditions for travel and exploration.';
}

// ═══════════════════════════════════════════════════════
//  GOOGLE MAPS SYSTEM
// ═══════════════════════════════════════════════════════
const mapSearchForm = document.getElementById('mapSearchForm');
const mapSearchInput = document.getElementById('mapSearchInput');

function updateGoogleMap(query, zoom) {
  const iframe = document.getElementById('googleMapFrame');
  if (!iframe) return;
  currentMapQuery = query;
  const z = zoom || 12;
  const typeParam = currentMapType ? `&t=${currentMapType}` : '';
  iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${z}&output=embed${typeParam}`;
}

mapSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = mapSearchInput.value.trim();
  if (!query) return;
  updateGoogleMap(query);
});

// Map layer toggle
document.querySelectorAll('.map-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const layer = btn.dataset.layer;
    if (layer === 'satellite') currentMapType = 'k';
    else if (layer === 'terrain') currentMapType = 'p';
    else currentMapType = '';
    updateGoogleMap(currentMapQuery);
  });
});

// Find Me button
document.getElementById('mapFindMe')?.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition(
    (pos) => updateGoogleMap(`${pos.coords.latitude},${pos.coords.longitude}`, 14),
    () => alert('Location access denied.')
  );
});

// Open in Google Maps (new tab)
document.getElementById('mapOpenGoogle')?.addEventListener('click', () => {
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(currentMapQuery)}`, '_blank');
});

// Get Directions
document.getElementById('getDirectionsBtn')?.addEventListener('click', () => {
  const from = document.getElementById('directionsFrom').value.trim();
  const to = document.getElementById('directionsTo').value.trim();
  if (!from || !to) return alert('Please enter both From and To locations.');
  window.open(`https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`, '_blank');
});

// ═══════════════════════════════════════════════════════
//  NEW CHAT
// ═══════════════════════════════════════════════════════
btnNewChat.addEventListener('click', async () => {
  try {
    await fetch('/api/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    });
  } catch (e) { /* ignore */ }
  messagesEl.innerHTML = '';
  chatStarted = false;
  welcomeScreen.style.display = '';
  welcomeScreen.style.animation = 'fadeInUp 0.5s ease';
  messageInput.value = '';
  messageInput.focus();
});

// ═══════════════════════════════════════════════════════
//  EXPLORE DESTINATIONS
// ═══════════════════════════════════════════════════════
btnExplore.addEventListener('click', () => openExplore());
exploreClose.addEventListener('click', () => closeExplore());
exploreOverlay.addEventListener('click', (e) => { if (e.target === exploreOverlay) closeExplore(); });

function openExplore() {
  exploreOverlay.classList.add('active');
  renderExploreFilters();
  renderExploreGrid();
  document.body.style.overflow = 'hidden';
}
function closeExplore() {
  exploreOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.explore-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.explore-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    exploreTab = tab.dataset.tab;
    exploreRegion = 'All';
    renderExploreFilters();
    renderExploreGrid();
  });
});

function renderExploreFilters() {
  const regions = exploreTab === 'india' ? INDIA_REGIONS : ASIA_REGIONS;
  exploreFilters.innerHTML = regions.map(r =>
    `<button class="filter-pill ${r === exploreRegion ? 'active' : ''}" data-region="${r}">${r}</button>`
  ).join('');
  exploreFilters.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      exploreRegion = pill.dataset.region;
      renderExploreFilters();
      renderExploreGrid();
    });
  });
}

function renderExploreGrid() {
  const sq = (exploreSearch.value || '').toLowerCase();
  let items = exploreTab === 'india'
    ? DESTINATIONS.filter(d => d.country === 'India')
    : DESTINATIONS.filter(d => d.country !== 'India');
  if (exploreRegion !== 'All') items = items.filter(d => d.region === exploreRegion);
  if (sq) {
    items = items.filter(d =>
      d.name.toLowerCase().includes(sq) ||
      d.keyPlaces.some(p => p.toLowerCase().includes(sq)) ||
      d.types.some(t => t.toLowerCase().includes(sq))
    );
  }
  if (items.length === 0) {
    exploreGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)"><span style="font-size:2.5rem;display:block;margin-bottom:12px">🔍</span>No destinations found.</div>`;
    return;
  }
  exploreGrid.innerHTML = items.map(d => {
    const sc = d.safetyLevel==='Safe'?'safety-safe':d.safetyLevel==='Moderate'?'safety-moderate':'safety-risky';
    return `<div class="dest-card" data-id="${d.id}"><div class="dest-card-img" style="background:${d.gradient}"><span class="dest-emoji">${d.emoji}</span></div><div class="dest-card-body"><div class="dest-card-name">${d.name}</div><div class="dest-card-region">${d.country==='India'?d.region+' India':d.region} • ${d.capital}</div><div class="dest-card-types">${d.types.slice(0,3).map(t=>`<span class="type-badge">${TYPE_EMOJIS[t]||'📍'} ${t}</span>`).join('')}</div><div class="dest-card-footer"><span class="dest-card-season">📅 ${d.bestMonths}</span><span class="dest-card-safety ${sc}">🛡 ${d.safetyLevel}</span></div></div></div>`;
  }).join('');

  exploreGrid.querySelectorAll('.dest-card').forEach(card => {
    card.addEventListener('click', () => {
      const dest = DESTINATIONS.find(d => d.id === card.dataset.id);
      if (dest) openDetail(dest);
    });
  });
}

exploreSearch.addEventListener('input', () => renderExploreGrid());

// ═══════════════════════════════════════════════════════
//  DESTINATION DETAIL
// ═══════════════════════════════════════════════════════
function openDetail(dest) {
  const sc = dest.safetyLevel==='Safe'?'safety-safe':dest.safetyLevel==='Moderate'?'safety-moderate':'safety-risky';
  detailContent.innerHTML = `
    <div class="detail-hero" style="background:${dest.gradient};border-radius:var(--radius-lg) var(--radius-lg) 0 0"><span class="detail-hero-emoji">${dest.emoji}</span></div>
    <div class="detail-info">
      <h2 class="detail-name">${dest.name}</h2>
      <div class="detail-meta">
        <span>📍 ${dest.country==='India'?dest.region+' India':dest.region}</span>
        <span>🏛️ ${dest.capital}</span><span>📅 ${dest.bestMonths}</span>
        <span class="${sc}" style="padding:1px 8px;border-radius:8px;font-weight:600">🛡 ${dest.safetyLevel}</span>
        ${dest.visa?`<span>🛂 ${dest.visa}</span>`:''}
      </div>
      <p class="detail-desc">${dest.description}</p>
      <div class="detail-section"><div class="detail-section-title">🎯 Top Highlights</div><div class="detail-tags">${dest.highlights.map(h=>`<span class="detail-tag">✨ ${h}</span>`).join('')}</div></div>
      <div class="detail-section"><div class="detail-section-title">📍 Key Places</div><div class="detail-tags">${dest.keyPlaces.map(p=>`<span class="detail-tag">${p}</span>`).join('')}</div></div>
      <div class="detail-section"><div class="detail-section-title">🏷️ Travel Type</div><div class="detail-tags">${dest.types.map(t=>`<span class="detail-tag">${TYPE_EMOJIS[t]||'📍'} ${t}</span>`).join('')}</div></div>
      <div class="detail-actions-row">
        <button class="detail-action" id="detailAskBtn">✈️ Plan trip to ${dest.name}</button>
        <button class="detail-action detail-action-secondary" id="detailWeatherBtn">🌦️ Weather</button>
        <button class="detail-action detail-action-secondary" id="detailMapBtn">🗺️ Map</button>
      </div>
    </div>`;
  detailOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('detailAskBtn').addEventListener('click', () => {
    closeDetail(); closeExplore();
    sendMessage(`Plan a complete trip to ${dest.name}. Include weather, budget, hotels, safety, and everything I need.`);
  });
  document.getElementById('detailWeatherBtn').addEventListener('click', () => {
    closeDetail(); closeExplore();
    openModal(weatherOverlay);
    weatherCityInput.value = dest.capital || dest.name;
    weatherForm.dispatchEvent(new Event('submit'));
  });
  document.getElementById('detailMapBtn').addEventListener('click', () => {
    closeDetail(); closeExplore();
    openModal(mapOverlay);
    mapSearchInput.value = dest.name;
    updateGoogleMap(dest.name);
  });
}

function closeDetail() { detailOverlay.classList.remove('active'); }
detailClose.addEventListener('click', closeDetail);
detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) closeDetail(); });

// ═══════════════════════════════════════════════════════
//  FLOATING EMOJI ANIMATION
// ═══════════════════════════════════════════════════════
const TRAVEL_EMOJIS = ['✈️','🧳','🌍','🏔️','🌊','🗺️','🏖️','🚂','🌴','⛰️','🏝️','🛕','🎒','🌅','🐘'];
function spawnEmoji() {
  const e = document.createElement('span');
  e.className = 'float-emoji';
  e.textContent = TRAVEL_EMOJIS[Math.floor(Math.random()*TRAVEL_EMOJIS.length)];
  e.style.left = Math.random()*100+'%';
  e.style.animationDuration = (10+Math.random()*8)+'s';
  e.style.fontSize = (1+Math.random()*0.8)+'rem';
  floatingEmojis.appendChild(e);
  setTimeout(()=>e.remove(),18000);
}
function startEmojiRain() { spawnEmoji(); setInterval(spawnEmoji,3500); }

// ═══════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (detailOverlay.classList.contains('active')) closeDetail();
    else if (exploreOverlay.classList.contains('active')) closeExplore();
    else if (weatherOverlay.classList.contains('active')) closeModal(weatherOverlay);
    else if (mapOverlay.classList.contains('active')) closeModal(mapOverlay);
  }
});

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
function init() {
  startEmojiRain();
  messageInput.focus();
  fetch('/api/health').then(r=>r.json()).then(d=>{
    if(!d.aiReady) console.warn('⚠️ No API key configured.');
  }).catch(()=>console.warn('⚠️ Cannot connect to server.'));
}
init();
