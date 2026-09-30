import '@fontsource/lilita-one';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { PROJECTS, TYPES } from './projects.js';
import { drawFront, drawFoilMask, drawBack } from './cardArt.js';
import { createStage } from './stage.js';
import { createBinder } from './binder.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Dev aid: ?slowmo=0.25 plays every GSAP animation at a quarter speed for frame-by-frame review.
const slowmo = Number(new URLSearchParams(location.search).get('slowmo'));
if (slowmo > 0) {
  gsap.globalTimeline.timeScale(slowmo);
  gsap.ticker.lagSmoothing(0);
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s) => document.querySelector(s);

/* ---------- saved collection ---------- */
const KEY = 'ak-binder-v1';
function load() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(ids.filter((id) => PROJECTS.some((p) => p.id === id)));
  } catch { return new Set(); }
}
// pulled: every card that has left the chest (saved). inBinder: the ones that reached the binder.
const pulled = load();
const inBinder = new Set(pulled);
function save() {
  try { localStorage.setItem(KEY, JSON.stringify([...pulled])); } catch { /* private mode */ }
}
const remaining = () => PROJECTS.filter((p) => !pulled.has(p.id));

/* ---------- elements ---------- */
const stageEl = $('#stage');
const openBtn = $('#open');
const openLabel = openBtn.querySelector('.label');
const hint = $('#pull-hint');
const drop = $('#drop');
const again = $('#again');
const againLabel = again.querySelector('.label');
const countEls = document.querySelectorAll('[data-count]');
const counterBtn = $('#counter');
const toastEl = $('#toast');

async function boot() {
  await Promise.all([
    document.fonts.load('78px "Lilita One"'),
    document.fonts.load('500 28px Rubik'),
    document.fonts.load('700 28px Rubik'),
  ]).catch(() => {});

  const art = {};
  for (const p of PROJECTS) art[p.id] = { front: drawFront(p), foil: drawFoilMask(p) };
  const back = drawBack();

  const binder = createBinder($('#binder-grid'), {
    projects: PROJECTS, art, back, pulled, reduced,
    onReveal: (p) => { pulled.add(p.id); inBinder.add(p.id); save(); updateCount(true); },
  });

  let stage = null;
  try {
    stage = createStage($('#stage-canvas'), {
      art, back, reduced,
      onChestClick: pull,
      stowTarget: () => counterBtn.querySelector('i').getBoundingClientRect(),
    });
  } catch (err) {
    console.warn('3D stage unavailable, using the flat version.', err);
  }
  if (!stage) document.body.classList.add('no-webgl');

  let current = null;
  let busy = false;

  function setOpenState() {
    const left = remaining().length;
    openBtn.disabled = false;
    if (left) {
      openLabel.textContent = pulled.size ? 'Open it again' : 'Open the chest';
      hint.textContent = `${left} of 8 still inside. Tap the chest or the button.`;
    } else {
      openLabel.textContent = 'Share the chest';
      hint.textContent = 'Empty. You pulled all eight.';
    }
  }

  function updateCount(bump) {
    const n = inBinder.size;
    countEls.forEach((el) => { el.textContent = n; });
    document.body.classList.toggle('is-complete', n === PROJECTS.length);
    if (bump) {
      // the counter takes the card: a pop and a ring of light
      counterBtn.classList.remove('is-bumped');
      void counterBtn.offsetWidth;
      counterBtn.classList.add('is-bumped');
      if (!reduced) {
        gsap.fromTo(counterBtn, { scale: 1.16 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: true, clearProps: 'transform' });
      }
    }
    if (n === PROJECTS.length && bump) celebrate();
  }

  // a pulled card reaches the binder
  function land(p, bump) {
    if (inBinder.has(p.id)) return;
    inBinder.add(p.id);
    binder.reveal(p.id, false);
    updateCount(bump);
  }

  function fillDrop(p) {
    const type = TYPES[p.type];
    drop.style.setProperty('--type', type.color);
    $('#drop-type').textContent = type.label;
    $('#drop-month').textContent = p.month;
    $('#drop-title').textContent = p.title;
    $('#drop-blurb').textContent = p.blurb;
    $('#drop-facts').innerHTML = p.facts.map((f) => `<li>${f}</li>`).join('');
    $('#drop-art').src = art[p.id].front.toDataURL('image/png');
    $('#drop-art').alt = `${p.title} card. Art: ${p.art}.`;
    const last = remaining().length === 0;
    againLabel.textContent = last ? 'Share the chest' : 'Pull another';
    again.querySelector('i').className = last ? 'ph ph-share-network' : 'ph ph-arrows-clockwise';
  }

  const wide = () => innerWidth > 760 && innerWidth / innerHeight >= 0.9;
  let split;
  let dropTl;
  function showDrop(p) {
    dropTl?.kill();
    split?.revert(); // before the new title goes in: revert restores the old markup
    split = null;
    fillDrop(p);
    gsap.set(drop, { clearProps: 'opacity,transform' });
    drop.hidden = false;
    document.body.classList.add('has-drop');
    again.focus({ preventScroll: true });
    if (reduced) {
      dropTl = gsap.fromTo(drop, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      return;
    }
    split = SplitText.create('#drop-title', { type: 'words,chars', mask: 'chars', charsClass: 'ch' });
    const w = wide();
    dropTl = gsap.timeline();
    dropTl.fromTo(drop, { opacity: 0, x: w ? 28 : 0, y: w ? 0 : 32 }, { opacity: 1, x: 0, y: 0, duration: 0.55, ease: 'expo.out' });
    dropTl.from(split.chars, { yPercent: 105, duration: 0.55, stagger: 0.018, ease: 'power4.out' }, 0.06);
    dropTl.from('#drop .drop-meta, #drop-blurb, #drop-facts li, #drop .drop-actions, #drop .drop-tip', {
      opacity: 0, y: 10, duration: 0.45, stagger: 0.04, ease: 'power3.out',
    }, 0.12);
  }

  function hideDrop() {
    if (drop.hidden) return Promise.resolve();
    dropTl?.kill();
    return new Promise((res) => {
      const w = wide();
      dropTl = gsap.to(drop, {
        opacity: 0, x: w && !reduced ? 16 : 0, y: !w && !reduced ? 20 : 0,
        duration: reduced ? 0.01 : 0.18, ease: 'power2.in',
        onComplete: () => { drop.hidden = true; res(); },
      });
    });
  }

  async function stowCurrent() {
    if (!current) return;
    const p = current;
    current = null;
    const hidden = hideDrop();
    if (stage) await stage.stow();
    await hidden;
    document.body.classList.remove('has-drop');
    land(p, true);
  }

  async function pull() {
    if (busy) return;
    const pool = remaining();
    if (!pool.length && !current) { share(); return; }
    busy = true;
    openBtn.disabled = true;
    document.body.classList.add('is-pulling');
    if (!pool.length) {
      document.body.classList.remove('is-pulling');
      await stowCurrent();
      busy = false;
      setOpenState();
      share();
      return;
    }
    await stowCurrent();
    const p = pool[Math.floor(Math.random() * pool.length)];
    pulled.add(p.id);
    save();
    if (stage) await stage.open(p);
    document.body.classList.remove('is-pulling');
    current = p;
    if (!stage) land(p, true); // no flight to watch: it goes straight in
    showDrop(p);
    setOpenState();
    busy = false;
  }

  async function closeDrop() {
    if (!current || busy) return;
    busy = true;
    await stowCurrent();
    setOpenState();
    busy = false;
    openBtn.focus({ preventScroll: true });
  }

  // "Binder" (and the counter): put the card away first, then go and look at it
  async function goToBinder(e) {
    e.preventDefault();
    if (busy) return;
    if (current) {
      busy = true;
      await stowCurrent();
      setOpenState();
      busy = false;
    }
    $('#binder').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  // Scrolled off with a card still out: it goes into the binder without a flight.
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting || !current || busy) return;
    const p = current;
    current = null;
    dropTl?.kill();
    drop.hidden = true;
    document.body.classList.remove('has-drop');
    stage?.stowNow();
    land(p, false);
    setOpenState();
  }).observe(stageEl);

  openBtn.addEventListener('click', pull);
  again.addEventListener('click', pull);
  $('#drop-close').addEventListener('click', closeDrop);
  $('#drop .btn-ghost').addEventListener('click', goToBinder);
  counterBtn.addEventListener('click', goToBinder);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrop(); });
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', share));

  setOpenState();
  updateCount(false);
  document.body.classList.add('is-ready');

  /* ---------- motion outside the stage ---------- */
  const landAt = stage ? stage.intro() : 0;
  if (!reduced) {
    // the HUD arrives while the chest falls; the button once it has landed
    const hudSplit = SplitText.create('.hud-name', { type: 'chars', mask: 'chars', charsClass: 'ch' });
    gsap.from(hudSplit.chars, { yPercent: 105, duration: 0.7, stagger: 0.03, ease: 'power4.out', delay: 0.15 });
    gsap.fromTo('.hud-sub, .hud-count', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.35, clearProps: 'opacity,transform' });
    gsap.fromTo('#open, #pull-hint', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'expo.out', delay: landAt + 0.12, clearProps: 'opacity,transform' });

    // headings: characters rise out of a mask as they arrive
    document.querySelectorAll('[data-split]').forEach((el) => {
      const s = SplitText.create(el, { type: 'words,chars', mask: 'chars', charsClass: 'ch' });
      gsap.from(s.chars, {
        yPercent: 105, duration: 0.75, stagger: 0.018, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    // cards are dealt into the binder, a row at a time as they scroll in
    const slots = gsap.utils.toArray('.slot');
    gsap.set(slots, { opacity: 0, y: 56, x: -18, rotation: (i) => (i % 2 ? 7 : -6), scale: 0.94 });
    ScrollTrigger.batch(slots, {
      start: 'top 94%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, x: 0, rotation: 0, scale: 1, duration: 0.75, ease: 'expo.out', stagger: 0.07,
        overwrite: true, clearProps: 'transform,opacity',
      }),
    });
    gsap.from('.how-step', {
      opacity: 0, y: 24, duration: 0.6, stagger: 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.how-steps', start: 'top 88%', once: true },
    });
    gsap.from('.how-line', {
      scaleX: 0, transformOrigin: 'left center', duration: 1.0, ease: 'expo.inOut',
      scrollTrigger: { trigger: '.how-line', start: 'top 90%', once: true },
    });

    // the gold buttons lean a little toward the pointer
    if (finePointer) {
      document.querySelectorAll('[data-magnetic]').forEach((el) => {
        const pos = { x: 0, y: 0 };
        const write = () => { el.style.setProperty('--mx', `${pos.x.toFixed(2)}px`); el.style.setProperty('--my', `${pos.y.toFixed(2)}px`); };
        const xTo = gsap.quickTo(pos, 'x', { duration: 0.4, ease: 'power3.out', onUpdate: write });
        const yTo = gsap.quickTo(pos, 'y', { duration: 0.4, ease: 'power3.out', onUpdate: write });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.12);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.2);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }
  }
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ---------- share and feedback ---------- */
async function share() {
  const url = location.href.split('#')[0].split('?')[0];
  const data = { title: 'Armaan K.', text: 'Open the chest and see what Armaan built.', url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. Paste it in the group chat.');
  } catch {
    toast(`Copy this link: ${url}`);
  }
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3600);
}

// the binder is full: confetti bursts out of the counter
function celebrate() {
  toast('All eight pulled. The binder is full.');
  if (reduced) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const colors = Object.values(TYPES).map((t) => t.color).concat('#F5A623');
  const r = counterBtn.getBoundingClientRect();
  const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  for (let i = 0; i < 70; i++) {
    const bit = document.createElement('span');
    bit.style.background = colors[i % colors.length];
    layer.append(bit);
    const a = Math.PI * (0.55 + Math.random() * 0.9);
    const v = 160 + Math.random() * 380;
    gsap.fromTo(bit,
      { x: ox, y: oy, rotation: 0, scale: 0.5 + Math.random() * 0.8 },
      {
        keyframes: {
          x: [ox, ox + Math.cos(a) * v],
          y: [oy, oy - Math.sin(a) * v * 0.5 + 40, oy + innerHeight * (0.5 + Math.random() * 0.5)],
          easeEach: 'none',
        },
        rotation: (Math.random() - 0.5) * 900,
        duration: 1.6 + Math.random() * 1.0,
        ease: 'power1.in',
        onComplete: () => bit.remove(),
      });
  }
  setTimeout(() => layer.remove(), 3000);
}

boot();
