import gsap from 'gsap';
import { TYPES } from './projects.js';

// The binder: every project as a card. Sealed (face down) until pulled or
// flipped early; then tilt for foil, tap to flip for the details.
export function createBinder(list, { projects, art, back, pulled, reduced, onReveal }) {
  const backURL = back.toDataURL('image/png');
  const cards = new Map();

  for (const p of projects) {
    const type = TYPES[p.type];
    const li = document.createElement('li');
    li.className = 'slot';
    li.style.setProperty('--type', type.color);
    li.innerHTML = `
      <button class="bcard is-sealed" type="button" data-id="${p.id}">
        <span class="bcard-tilt">
          <span class="bcard-turn">
            <span class="bcard-flip">
              <span class="bface bface-front">
                <img src="${art[p.id].front.toDataURL('image/png')}" width="768" height="1076" alt="${p.title} card. Art: ${p.art}." loading="lazy" decoding="async">
                <span class="holo" aria-hidden="true"></span>
                <span class="glare" aria-hidden="true"></span>
                <span class="new-tag" aria-hidden="true">New</span>
              </span>
              <span class="bface bface-info">
                <span class="info-type">${type.label}<span class="info-month">${p.month}</span></span>
                <span class="info-title">${p.title}</span>
                <span class="info-blurb">${p.blurb}</span>
                ${p.facts.map((f) => `<span class="info-fact">${f}</span>`).join('')}
                <span class="info-hint">Tap to flip back</span>
              </span>
            </span>
            <span class="sleeve" aria-hidden="true">
              <img src="${backURL}" width="768" height="1076" alt="">
              <span class="sleeve-label">Tap to flip early</span>
            </span>
          </span>
        </span>
      </button>`;
    list.append(li);
    const btn = li.querySelector('.bcard');
    cards.set(p.id, { li, btn, p });
    label(btn, p, pulled.has(p.id));
    if (pulled.has(p.id)) btn.classList.remove('is-sealed');

    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-revealing')) return;
      if (btn.classList.contains('is-sealed')) {
        reveal(p.id, true);
        onReveal?.(p);
        return;
      }
      btn.classList.remove('is-new');
      const flipped = btn.classList.toggle('is-flipped');
      btn.setAttribute('aria-pressed', String(flipped));
    });

    // foil and tilt follow the pointer
    let raf = 0;
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || btn.classList.contains('is-sealed')) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = btn.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        btn.style.setProperty('--px', `${px * 100}%`);
        btn.style.setProperty('--py', `${py * 100}%`);
        if (!reduced) {
          btn.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
          btn.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
        }
        btn.classList.add('is-tilting');
      });
    });
    btn.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      btn.classList.remove('is-tilting');
      btn.style.setProperty('--rx', '0deg');
      btn.style.setProperty('--ry', '0deg');
    });
  }

  function label(btn, p, open) {
    btn.setAttribute('aria-label', open
      ? `${p.title}, ${TYPES[p.type].label}, ${p.month}. Press to flip for details.`
      : `${p.title}, not pulled yet. Press to flip it early.`);
    if (open) btn.setAttribute('aria-pressed', 'false');
    else btn.removeAttribute('aria-pressed');
  }

  // Turn a sealed card face up: it lifts, turns over, and sets back down with a sweep of foil.
  function reveal(id, animate) {
    const c = cards.get(id);
    if (!c || !c.btn.classList.contains('is-sealed')) return;
    label(c.btn, c.p, true);
    if (!animate) {
      c.btn.classList.remove('is-sealed');
      c.btn.classList.add('is-new');
      return;
    }
    if (reduced) {
      c.btn.classList.remove('is-sealed');
      gsap.fromTo(c.btn.querySelector('.bface-front'), { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' });
      return;
    }
    const turn = c.btn.querySelector('.bcard-turn');
    const holo = c.btn.querySelector('.holo');
    c.btn.classList.add('is-revealing');
    const tl = gsap.timeline({
      onComplete: () => {
        c.btn.classList.remove('is-sealed', 'is-revealing');
        gsap.set([turn, c.btn, holo], { clearProps: 'transform,opacity,zIndex' });
        c.btn.style.removeProperty('--px');
      },
    });
    tl.set(c.btn, { zIndex: 2 });
    tl.to(c.btn, { y: -16, scale: 1.06, duration: 0.2, ease: 'power2.out' }, 0);
    tl.fromTo(turn, { rotationY: 180 }, { rotationY: 0, duration: 0.62, ease: 'back.out(1.25)' }, 0.06);
    tl.to(c.btn, { y: 0, scale: 1, duration: 0.42, ease: 'power3.inOut' }, 0.4);
    tl.fromTo(holo, { opacity: 0.8 }, { opacity: 0, duration: 0.9, ease: 'power2.in', immediateRender: false }, 0.38);
    tl.fromTo(c.btn, { '--px': '0%' }, { '--px': '100%', duration: 0.9, ease: 'power2.out', immediateRender: false }, 0.38);
  }

  return {
    reveal,
    count: () => [...cards.values()].filter((c) => !c.btn.classList.contains('is-sealed')).length,
  };
}
