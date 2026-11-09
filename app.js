
let events = [], selected = new Date(), weekStart;

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const monday = d => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - (x.getDay() + 6) % 7);
  return x;
};

const add = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmt = d =>
  d.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long'
  });

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

// KALENDARZ

function render() {
  weekStart = monday(selected);

  $('week').textContent =
    `${fmt(weekStart)} – ${fmt(add(weekStart, 6))}`;

  $('days').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = add(weekStart, i);
    const k = dateKey(d);
    const has = events.some(e => e.date === k);

    return `
      <button class="day
        ${k === dateKey(selected) ? 'active' : ''}
        ${has ? 'has' : ''}"
        data-date="${k}">
        ${['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'][i]}
        <b>${d.getDate()}</b>
      </button>
    `;
  }).join('');

  document.querySelectorAll('[data-date]').forEach(b => {
    b.onclick = () => {
      selected = new Date(b.dataset.date + 'T12:00:00');
      render();
    };
  });

  const list = events
    .filter(e => e.date === dateKey(selected))
    .sort((a, b) => a.start.localeCompare(b.start));

  $('heading').textContent =
    selected.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

  $('count').textContent = `${list.length} zajęć`;

  $('events').innerHTML = list.length
    ? list.map(e => `
      <article class="event ${e.group === 'WykS' ? 'lecture' : ''}">
        <div class="bar"></div>
        <div>
          <div class="time">
            ${esc(e.start)}–${esc(e.end)}
          </div>
          <h3>${esc(e.subject)}</h3>
          <p>
            ⌖ ${esc(e.room || 'Sala niepodana')}
            ${e.note ? ' · ' + esc(e.note) : ''}
          </p>
          <span class="tag">
            ${e.group === 'WykS' ? 'Wykład' : 'Ćwiczenia'}
          </span>
        </div>
      </article>
    `).join('')
    : '<div class="empty">Brak zajęć w wybranym dniu ☕</div>';
}

// NAWIGACJA

$('prev').onclick = () => {
  selected = add(weekStart, -7);
  render();
};

$('next').onclick = () => {
  selected = add(weekStart, 7);
  render();
};

// ODCZYT CSV

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let day = null;
  const out = [];

  for (const line of lines) {
    const cols = line.split(';');

    if (cols[0]?.startsWith('Data Zajec:')) {
      const m = cols[0].match(/(\d{4})\.(\d{2})\.(\d{2})/);
      day = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      continue;
    }

    const g = cols[4]?.trim().split(/\s+/).pop();

    if (
      day &&
      ['Cw2S', 'WykS'].includes(g) &&
      /^\d{1,2}:\d{2}$/.test(cols[1] || '')
    ) {
      out.push({
        date: day,
        start: cols[1],
        end: cols[2],
        group: g,
        subject: cols[5],
        room: cols[6],
        assessment: cols[7],
        note: cols[8]
      });
    }
  }

  return out;
}

// IDENTYFIKATOR ZAJĘĆ

function key(e) {
  return [
    e.date,
    e.start,
    e.end,
    e.group,
    e.subject,
    e.room,
    e.note
  ].join('|');
}

// ADRES WORKERA

const API =
  'https://plan-zajec.m-nowicka2006.workers.dev/';

// BEZPIECZNA AKTUALIZACJA

function applyNew(newer, origin) {
  if (!newer.length) {
    throw Error('Nie znaleziono zajęć Cw2S ani WykS.');
  }

  const before = new Set(events.map(key));
  const merged = new Map(events.map(e => [key(e), e]));

  const added = [];

  for (const e of newer) {
    if (!before.has(key(e))) {
      added.push(e);
    }
    merged.set(key(e), e);
  }

  events = Array.from(merged.values()).sort(
    (a, b) =>
      (a.date + a.start).localeCompare(b.date + b.start)
  );

  localStorage.setItem('dsw-plan', JSON.stringify(events));

  const stamp = new Date().toLocaleString('pl-PL');

  localStorage.setItem('dsw-updated', stamp);

  $('source').textContent = origin + ' · ' + stamp;

  $('changes').innerHTML = `
    <div class="good">
      Synchronizacja zakończona · ${esc(stamp)}
    </div>

    <div class="changed">
      Pobrano: ${newer.length} zajęć<br>
      Nowe wpisy: ${added.length}<br>
      Łącznie w kalendarzu: ${events.length}
    </div>

    <div>
      Zachowano wcześniejsze wpisy.
      Brak zajęć w eksporcie nie oznacza
      automatycznie ich odwołania.
    </div>

    ${added.slice(0, 15).map(x => `
      <div>
        ＋ ${esc(x.date)}
        ${esc(x.start)}
        ${esc(x.subject)}
      </div>
    `).join('')}
  `;

  render();
}

// SYNCHRONIZACJA ONLINE

async function sync() {
  const b = $('sync');

  b.disabled = true;
  b.textContent = 'Sprawdzam…';

  try {
    const r = await fetch(API + '?t=' + Date.now(), {
      cache: 'no-store'
    });

    if (!r.ok) {
      throw Error('Serwer synchronizacji: HTTP ' + r.status);
    }

    const result = await r.json();

    if (!result.success || !result.csv) {
      throw Error(
        result.error ||
        'Serwer nie zwrócił danych CSV.'
      );
    }

    const newer = parseCSV(result.csv);

    applyNew(newer, 'IDEIS online');

  } catch (e) {
    $('changes').textContent =
      'Nie udało się odświeżyć: ' +
      e.message +
      ' Ostatni zapisany plan pozostaje dostępny.';

  } finally {
    b.disabled = false;
    b.textContent = '↻ Sprawdź aktualny plan';
  }
}

$('sync').onclick = sync;

// IMPORT CSV

$('upload').onchange = async e => {
  const f = e.target.files?.[0];
  if (!f) return;

  const bytes = await f.arrayBuffer();

  let text = new TextDecoder('windows-1250').decode(bytes);

  if (text.includes('�')) {
    text = new TextDecoder('utf-8').decode(bytes);
  }

  try {
    applyNew(parseCSV(text), 'CSV ręcznie');
  } catch (err) {
    $('changes').textContent = err.message;
  }
};

// URUCHOMIENIE APLIKACJI

(async () => {
  try {
    const saved = localStorage.getItem('dsw-plan');

    events = saved
      ? JSON.parse(saved)
      : await (await fetch('plan.json')).json();

    $('source').textContent = saved
      ? 'Zapisany plan: ' +
        (localStorage.getItem('dsw-updated') || 'offline')
      : 'Plan z eksportu IDEIS';

    const today = dateKey(new Date());

    if (!events.some(e => e.date === today)) {
      const upcoming = events.find(e => e.date >= today);

      if (upcoming) {
        selected = new Date(upcoming.date + 'T12:00:00');
      }
    }

    render();
    await sync();

  } catch (err) {
    $('events').textContent =
      'Nie udało się wczytać planu: ' + err.message;
  }
})();

// SERVICE WORKER

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});
}
