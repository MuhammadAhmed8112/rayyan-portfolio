/* ============================================================
   Motion. Durations and curves from the design-system tokens.
   ============================================================ */
const EASE   = 'expo.out';                 // [0.16,1,0.3,1]
const MICRO  = 'power2.out';
const DUR    = { micro:.15, small:.45, section:.8, hero:1.2, settle:1.5 };
const STAG   = { sibling:.07, text:.04, row:.03 };
const LERP   = { copy:.12, ui:.08, image:.035 };
const DEPTH  = { foreground:28, mid:10, background:4, image:1 };

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* If GSAP never arrived (blocked CDN, offline), show the page and stop.
   Content must never depend on an animation library loading. */
const HAS_GSAP = typeof window.gsap !== 'undefined';
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

/* Hard failsafe: whatever happens above, the site becomes readable.
   setTimeout still fires in throttled/background tabs; rAF does not. */
function revealEverything(){
  document.body.classList.remove('loading');
  const pre = document.getElementById('pre');
  if (pre) pre.style.display = 'none';
  const curtain = document.querySelector('.curtain');
  if (curtain) curtain.style.display = 'none';
  document.querySelectorAll('.rv, .pl').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.filter = 'none';
  });
  document.querySelectorAll('.line > span').forEach(el => { el.style.transform = 'none'; });
  document.querySelectorAll('[data-count]').forEach(el => {
    if (el.textContent === '0') el.textContent = el.dataset.count;
  });
}
const FAILSAFE = setTimeout(revealEverything, 6000);

/* ---------- inject the real diagrams ---------- */
async function loadDiagrams(){
  const jobs = [
    ['assets/pipeline.svg', '#heroDiagram'],
    ['assets/gsm.svg',      '#gsmShot'],
    ['assets/pipeline.svg', '#pipeShot'],
  ];
  await Promise.all(jobs.map(async ([url, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    try {
      const svg = await fetch(url).then(r => r.text());
      el.innerHTML = svg;
      // Strip the fixed dimensions and let CSS size it — no inline width,
      // or it overrides the stylesheet and the hero crop stops working.
      const s = el.querySelector('svg');
      if (s){ s.removeAttribute('width'); s.removeAttribute('height'); }
    } catch(e){ /* diagram is decoration, never block the page */ }
  }));
}

/* ---------- 1 · composed entrance ---------- */
function preloader(){
  const pre = document.getElementById('pre');
  if (reduced){ pre?.remove(); document.body.classList.remove('loading'); return Promise.resolve(); }

  const countEl = pre.querySelector('.count');
  const barFill = pre.querySelector('.bar i');
  const state = { v:0 };

  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.from(pre.querySelector('.mark'), { y:26, opacity:0, duration:DUR.section, ease:EASE })
      .from(pre.querySelector('.sub'),  { y:12, opacity:0, duration:DUR.small,  ease:EASE }, '-=.45')
      .to(state, {
        v:100, duration:1.7, ease:'power1.inOut',
        onUpdate(){
          const n = Math.round(state.v);
          countEl.textContent = String(n).padStart(2,'0');
          barFill.style.transform = `scaleX(${n/100})`;
        }
      }, '-=.3')
      .to('.curtain', { y:'0%', duration:.7, ease:EASE }, '-=.15')
      .set(pre, { display:'none' })
      .to('.curtain', { y:'-100%', duration:.9, ease:EASE })
      .add(() => document.body.classList.remove('loading'), '<');
  });
}

/* ---------- 2+3 · hero reveal ---------- */
function heroIn(){
  // If frames are throttled (background tab, heavy CPU) an entrance tween can
  // stall with the hero still invisible. Guarantee the end state either way.
  const settle = setTimeout(() => {
    gsap.set('.hero .pl, .panel-stack, .float-card, #chrome', { clearProps:'all' });
    gsap.set('.hero h1 .line > span', { clearProps:'all' });
  }, 4200);

  const tl = gsap.timeline({ onComplete: () => clearTimeout(settle) });
  tl.from('#chrome', { y:-70, opacity:0, duration:DUR.section, ease:EASE })
    .from('.hero h1 .line > span', {
      yPercent:112, duration:DUR.hero, ease:EASE, stagger:STAG.text * 4
    }, '-=.55')
    .from('.hero .pl', {
      y:22, opacity:0, filter:'blur(8px)', duration:DUR.section, ease:EASE, stagger:STAG.sibling
    }, '-=.8')
    .from('.panel-stack', {
      scale:1.05, opacity:0, duration:DUR.settle, ease:EASE
    }, '-=1.1')
    .from('.float-card', {
      y:18, opacity:0, duration:DUR.section, ease:EASE, stagger:.12
    }, '-=.7');

  // ambient drift — the hero subject is never fully still
  if (!reduced){
    gsap.to('#heroPanel', {
      y:-14, duration:6, ease:'sine.inOut', yoyo:true, repeat:-1
    });
  }
}

/* ---------- 4 · mouse parallax, 3 depth layers ---------- */
function parallax(){
  if (reduced || window.matchMedia('(pointer:coarse)').matches) return;
  const layers = [
    { el:document.querySelectorAll('.float-card'), d:DEPTH.foreground, x:0, y:0 },
    { el:document.querySelectorAll('.hero-copy'),  d:DEPTH.background, x:0, y:0 },
    { el:document.querySelectorAll('#heroPanel'),  d:DEPTH.mid,        x:0, y:0 },
  ];
  let tx=0, ty=0;
  window.addEventListener('mousemove', e => {
    tx = (e.clientX / window.innerWidth  - .5) * 2;
    ty = (e.clientY / window.innerHeight - .5) * 2;
  }, { passive:true });

  gsap.ticker.add(() => {
    layers.forEach(L => {
      L.x += (tx * L.d - L.x) * LERP.ui;
      L.y += (ty * L.d - L.y) * LERP.ui;
      L.el.forEach(n => { n.style.transform = `translate3d(${L.x}px, ${L.y}px, 0)`; });
    });
  });
}

/* ---------- 5 · scroll reveals ---------- */
/* IntersectionObserver, not ScrollTrigger, on purpose: content entrances must
   not depend on the animation ticker. If rAF is throttled the transition simply
   snaps and the section is still readable. */
function reveals(){
  const groups = ['.bento', '.steps', '.stats'];
  groups.forEach(sel => {
    const parent = document.querySelector(sel);
    if (!parent) return;
    [...parent.children].forEach((child, i) => {
      child.classList.add('rv');
      child.style.transitionDelay = Math.min(i * STAG.sibling, .4) + 's';
    });
  });

  const targets = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)){
    targets.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin:'0px 0px -12% 0px', threshold:.08 });
  targets.forEach(el => io.observe(el));
}

/* ---------- 6 · pinned horizontal track ---------- */
function pinned(){
  if (reduced) return;
  const outer = document.querySelector('.pin-outer');
  const track = document.getElementById('pinTrack');
  if (!outer || !track) return;

  const distance = () => track.scrollWidth - window.innerWidth + 120;

  gsap.to(track, {
    x: () => -distance(),
    ease:'none',
    scrollTrigger:{
      trigger:outer, start:'top top', end:() => '+=' + distance(),
      scrub:.6, pin:'.pin-inner', invalidateOnRefresh:true, anticipatePin:1
    }
  });

  gsap.from(track.children, {
    opacity:0, y:30, duration:DUR.section, ease:EASE, stagger:STAG.sibling,
    scrollTrigger:{ trigger:outer, start:'top 60%', once:true }
  });
}

/* ---------- 7 · inertial scroll ---------- */
function smoothScroll(){
  if (reduced || window.matchMedia('(pointer:coarse)').matches) return;
  let current = 0, target = 0;
  const body = document.querySelector('main');
  if (!body) return;
  // light-touch smoothing: only the scroll-driven timeline reads this
  gsap.ticker.add(() => {
    target = window.scrollY;
    current += (target - current) * LERP.copy;
  });
}

/* ---------- 8 · magnetic CTAs ---------- */
function magnetic(){
  if (reduced || window.matchMedia('(pointer:coarse)').matches) return;
  document.querySelectorAll('.magnetic').forEach(btn => {
    const strength = 16;
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width/2)  / (r.width/2);
      const y = (e.clientY - r.top  - r.height/2) / (r.height/2);
      gsap.to(btn, { x:x*strength, y:y*strength, duration:.4, ease:MICRO });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x:0, y:0, duration:.6, ease:'elastic.out(1,.4)' });
    });
  });
}

/* ---------- marquee ---------- */
function marquee(){
  const track = document.getElementById('marquee');
  if (!track) return;
  track.innerHTML += track.innerHTML;           // seamless loop
  if (reduced) return;
  gsap.to(track, { xPercent:-50, duration:26, ease:'none', repeat:-1 });
}

/* ---------- counters ---------- */
function counters(){
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count);
    if (reduced){ el.textContent = end; return; }
    const o = { v:0 };
    gsap.to(o, {
      v:end, duration:1.4, ease:'power2.out',
      scrollTrigger:{ trigger:el, start:'top 90%', once:true },
      onUpdate(){ el.textContent = Math.round(o.v); }
    });
  });
}

/* ---------- nav hide on scroll-down ---------- */
function navBehaviour(){
  const chrome = document.getElementById('chrome');
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    chrome.classList.toggle('solid', y > 40);
    if (y > last && y > 260) chrome.classList.add('hidden');
    else chrome.classList.remove('hidden');
    last = y;
  }, { passive:true });
}

/* ---------- boot ---------- */
(async function init(){
  navBehaviour();

  // diagrams load in parallel — they must never delay the entrance
  loadDiagrams().then(() => { if (HAS_GSAP) ScrollTrigger.refresh(); });

  if (!HAS_GSAP){ clearTimeout(FAILSAFE); revealEverything(); return; }

  // Never let the entrance block the rest of the page's behaviour. If the
  // timeline stalls (throttled frames), carry on and wire everything up anyway.
  const timeout = ms => new Promise(r => setTimeout(r, ms));
  let entranceDone = false;
  await Promise.race([ preloader().then(() => { entranceDone = true; }), timeout(5000) ]);
  clearTimeout(FAILSAFE);
  document.body.classList.remove('loading');

  // The curtain is fixed and covers the page. If its timeline never finished,
  // take it down by hand — otherwise the visitor stares at the wordmark.
  if (!entranceDone){
    const pre = document.getElementById('pre');
    const curtain = document.querySelector('.curtain');
    if (pre) pre.style.display = 'none';
    if (curtain) curtain.style.display = 'none';
  }
  heroIn();
  parallax();
  reveals();
  pinned();
  smoothScroll();
  magnetic();
  marquee();
  counters();
  ScrollTrigger.refresh();
})();
