const pages = [...document.querySelectorAll('.page')];
const navLinks = [...document.querySelectorAll('.nav a')];
const header = document.getElementById('siteHeader');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const propertySelect = document.getElementById('propertySelect');
const loader = document.getElementById('loader');
const loaderText = loader ? loader.querySelector('p') : null;
const mapHome = document.querySelector('.map-home');
const slideshows = [...document.querySelectorAll('[data-slideshow]')];

const validRoutes = new Set(pages.map(page => page.dataset.route));
let pendingProperty = null;
let routeTimer = null;
let loaderTimer = null;
let slideshowTimer = null;
let currentRoute = null;

function getRoute() {
  const route = location.hash.replace('#', '').trim() || 'home';
  return validRoutes.has(route) ? route : 'home';
}

function setActiveNav(route) {
  navLinks.forEach(link => {
    const linkRoute = link.getAttribute('href').replace('#', '');
    const isActive = route === linkRoute ||
      (['skouzen', 'pearl'].includes(route) && linkRoute === 'piraeus') ||
      (['ivory', 'onyx'].includes(route) && linkRoute === 'spetses');
    link.classList.toggle('active', isActive);
  });
}

function showLoader(text = 'Loading your next stay') {
  if (!loader) return;
  window.clearTimeout(loaderTimer);
  if (loaderText) loaderText.textContent = text;
  loader.classList.remove('hide');
  loader.classList.add('route-loading');
  document.body.classList.add('is-loading-route');
}

function hideLoader() {
  if (!loader) return;
  loaderTimer = window.setTimeout(() => {
    loader.classList.add('hide');
    loader.classList.remove('route-loading');
    document.body.classList.remove('is-loading-route');
  }, 180);
}

function animateActivePage(page) {
  const animatedItems = page.querySelectorAll('.reveal-up, .property-card, .detail-gallery, .detail-copy, .booking-copy, .booking-form, .contact-card');
  animatedItems.forEach(item => {
    item.classList.remove('play-in');
    void item.offsetWidth;
    item.classList.add('play-in');
  });
}

function setGalleryPhoto(gallery, index) {
  const buttons = [...gallery.querySelectorAll('.thumb-row button[data-photo]')];
  const mainPhoto = gallery.querySelector('.main-photo');
  if (!mainPhoto || !buttons.length) return;

  const nextIndex = (index + buttons.length) % buttons.length;
  const selected = buttons[nextIndex];
  mainPhoto.src = selected.dataset.photo;
  mainPhoto.alt = selected.querySelector('img')?.alt || 'Apartment photo';
  mainPhoto.classList.remove('photo-pop');
  void mainPhoto.offsetWidth;
  mainPhoto.classList.add('photo-pop');

  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle('active', buttonIndex === nextIndex);
  });

  const current = gallery.querySelector('[data-slide-current]');
  const total = gallery.querySelector('[data-slide-total]');
  if (current) current.textContent = String(nextIndex + 1);
  if (total) total.textContent = String(buttons.length);
  selected.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function stepGallery(gallery, direction = 1) {
  const buttons = [...gallery.querySelectorAll('.thumb-row button[data-photo]')];
  const activeIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
  setGalleryPhoto(gallery, activeIndex + direction);
}

function stopSlideshow() {
  window.clearInterval(slideshowTimer);
  slideshowTimer = null;
}

function startSlideshow(page) {
  stopSlideshow();
  const gallery = page?.querySelector('[data-slideshow]');
  if (!gallery || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slideshowTimer = window.setInterval(() => stepGallery(gallery, 1), 5200);
}

function renderRoute(route) {
  pages.forEach(page => page.classList.toggle('active', page.dataset.route === route));
  const activePage = pages.find(page => page.dataset.route === route);
  document.body.classList.toggle('route-home', route === 'home');
  document.body.classList.toggle('route-inner', route !== 'home');
  setActiveNav(route);
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (route === 'book' && pendingProperty && propertySelect) {
    propertySelect.value = pendingProperty;
  }

  if (activePage) animateActivePage(activePage);
  startSlideshow(activePage);
  currentRoute = route;
}

function showRouteWithLoading() {
  const route = getRoute();
  window.clearTimeout(routeTimer);
  showLoader('Loading');
  routeTimer = window.setTimeout(() => {
    renderRoute(route);
    hideLoader();
  }, 520);
}

function closeMenu() {
  if (!menuToggle || !mainNav) return;
  menuToggle.classList.remove('open');
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

window.addEventListener('hashchange', showRouteWithLoading);
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 10);
});

window.addEventListener('load', () => {
  renderRoute(getRoute());
  window.setTimeout(() => hideLoader(), 650);
});

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.classList.toggle('open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', event => {
  const mapHotspot = event.target.closest('.map-hotspot');
  if (mapHotspot) {
    event.preventDefault();
    const targetRoute = mapHotspot.dataset.place;
    if (!targetRoute || !validRoutes.has(targetRoute)) return;

    mapHotspot.classList.remove('tap-pulse');
    void mapHotspot.offsetWidth;
    mapHotspot.classList.add('tap-pulse');
    showLoader('Loading');
    window.setTimeout(() => {
      location.hash = targetRoute;
    }, 170);
    return;
  }

  const hashLink = event.target.closest('a[href^="#"]');
  if (hashLink) {
    const targetRoute = hashLink.getAttribute('href').replace('#', '') || 'home';
    if (targetRoute && targetRoute !== currentRoute) {
      showLoader('Loading');
    }
  }

  const bookLink = event.target.closest('[data-book-property]');
  if (bookLink) {
    pendingProperty = bookLink.dataset.bookProperty;
  }

  const prevSlide = event.target.closest('[data-slide-prev]');
  const nextSlide = event.target.closest('[data-slide-next]');
  if (prevSlide || nextSlide) {
    const gallery = event.target.closest('[data-slideshow]');
    stepGallery(gallery, prevSlide ? -1 : 1);
    startSlideshow(gallery.closest('.page'));
    return;
  }

  const thumb = event.target.closest('.thumb-row button');
  if (thumb) {
    const gallery = thumb.closest('.detail-gallery');
    const buttons = [...gallery.querySelectorAll('.thumb-row button[data-photo]')];
    setGalleryPhoto(gallery, buttons.indexOf(thumb));
    if (gallery.matches('[data-slideshow]')) startSlideshow(gallery.closest('.page'));
  }

  if (!event.target.closest('.site-header')) {
    closeMenu();
  }
});

const form = document.getElementById('bookingForm');
if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const note = document.getElementById('formNote');
    note.textContent = `Έτοιμο αίτημα για ${data.property}. Σύνδεσέ το με email ή backend για πραγματική κράτηση.`;
    form.classList.add('sent');
  });
}

if (mapHome && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let rafId = null;
  let nextX = 0;
  let nextY = 0;

  function applyMapMotion() {
    rafId = null;
    mapHome.style.setProperty('--map-pan-x', `${nextX * -16}px`);
    mapHome.style.setProperty('--map-pan-y', `${nextY * -12}px`);
    mapHome.style.setProperty('--hotspot-pan-x', `${nextX * -11.5}px`);
    mapHome.style.setProperty('--hotspot-pan-y', `${nextY * -8.5}px`);
    mapHome.style.setProperty('--map-tilt-x', `${nextY * 2.6}deg`);
    mapHome.style.setProperty('--map-tilt-y', `${nextX * -3.2}deg`);
    mapHome.style.setProperty('--map-light-x', `${50 + nextX * 18}%`);
    mapHome.style.setProperty('--map-light-y', `${48 + nextY * 14}%`);
  }

  mapHome.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = mapHome.getBoundingClientRect();
    nextX = ((event.clientX - rect.left) / rect.width - .5) * 2;
    nextY = ((event.clientY - rect.top) / rect.height - .5) * 2;
    if (!rafId) rafId = window.requestAnimationFrame(applyMapMotion);
  });

  mapHome.addEventListener('pointerleave', () => {
    nextX = 0;
    nextY = 0;
    if (!rafId) rafId = window.requestAnimationFrame(applyMapMotion);
  });
}
