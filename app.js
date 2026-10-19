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
const photoLightbox = document.getElementById('photoLightbox');
const lightboxImage = photoLightbox?.querySelector('.lightbox-image');
const lightboxCurrent = photoLightbox?.querySelector('[data-lightbox-current]');
const lightboxTotal = photoLightbox?.querySelector('[data-lightbox-total]');

const validRoutes = new Set(pages.map(page => page.dataset.route));
let pendingProperty = null;
let routeTimer = null;
let loaderTimer = null;
let slideshowTimer = null;
let mapZoomTimer = null;
let lightboxGallery = null;
let lightboxIndex = 0;
let currentRoute = null;

// Keep destination buttons anchored to the SVG as its displayed size changes.
function positionMapDestinations() {
  if (!mapHome?.classList.contains('illustrated-map')) return;
  const bounds = mapHome.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const scale = Math.min(bounds.width / 1440, bounds.height / 1080);
  const imageWidth = 1440 * scale;
  const imageHeight = 1080 * scale;
  const left = (bounds.width - imageWidth) / 2;
  const top = (bounds.height - imageHeight) * (window.matchMedia('(max-width: 900px)').matches ? .7 : .5);
  const mapDrawing = mapHome.querySelector('svg.map-home-image');
  if (mapDrawing) {
    mapDrawing.setAttribute('viewBox', `${-left / scale} ${-top / scale} ${bounds.width / scale} ${bounds.height / scale}`);
  }
  mapHome.querySelectorAll('[data-map-x]').forEach(button => {
    button.style.left = `${left + Number(button.dataset.mapX) * imageWidth}px`;
    button.style.top = `${top + Number(button.dataset.mapY) * imageHeight}px`;
  });
}

if (mapHome) {
  new ResizeObserver(positionMapDestinations).observe(mapHome);
  positionMapDestinations();
}

function getRoute() {
  const route = location.hash.replace('#', '').trim() || 'home';
  return validRoutes.has(route) ? route : 'home';
}

function cleanHomeHash() {
  if (location.hash !== '#home') return;
  history.replaceState(null, '', location.pathname + location.search);
}

function setActiveNav(route) {
  navLinks.forEach(link => {
    const linkRoute = link.getAttribute('href').replace('#', '');
    const isActive = route === linkRoute ||
      (['skouzen', 'pearl'].includes(route) && linkRoute === 'piraeus') ||
      (route === 'ivory' && linkRoute === 'spetses');
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
  if (gallery.classList.contains('skouzen-gallery') || gallery.hasAttribute('data-manual-gallery')) return;
  slideshowTimer = window.setInterval(() => stepGallery(gallery, 1), 5200);
}

function getGalleryButtons(gallery) {
  return [...gallery.querySelectorAll('.thumb-row button[data-photo]')];
}

function setLightboxPhoto(index) {
  if (!photoLightbox || !lightboxImage || !lightboxGallery) return;
  const buttons = getGalleryButtons(lightboxGallery);
  if (!buttons.length) return;

  lightboxIndex = (index + buttons.length) % buttons.length;
  const selected = buttons[lightboxIndex];

  const applyPhoto = () => {
    lightboxImage.src = selected.dataset.photo;
    lightboxImage.alt = selected.querySelector('img')?.alt || 'Apartment photo';
    lightboxImage.classList.remove('is-changing');
  };

  if (photoLightbox.classList.contains('open')) {
    lightboxImage.classList.add('is-changing');
    window.setTimeout(applyPhoto, 150);
  } else {
    applyPhoto();
  }

  if (lightboxCurrent) lightboxCurrent.textContent = String(lightboxIndex + 1);
  if (lightboxTotal) lightboxTotal.textContent = String(buttons.length);
  setGalleryPhoto(lightboxGallery, lightboxIndex);
}

function openLightbox(gallery) {
  if (!photoLightbox || !gallery) return;
  const buttons = getGalleryButtons(gallery);
  if (!buttons.length) return;

  lightboxGallery = gallery;
  lightboxIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
  stopSlideshow();
  setLightboxPhoto(lightboxIndex);
  photoLightbox.classList.add('open');
  photoLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
}

function closeLightbox() {
  if (!photoLightbox) return;
  photoLightbox.classList.remove('open');
  photoLightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  if (lightboxGallery) startSlideshow(lightboxGallery.closest('.page'));
  lightboxGallery = null;
}

function stepLightbox(direction) {
  if (!lightboxGallery) return;
  setLightboxPhoto(lightboxIndex + direction);
}

function renderRoute(route) {
  pages.forEach(page => page.classList.toggle('active', page.dataset.route === route));
  const activePage = pages.find(page => page.dataset.route === route);
  document.body.classList.toggle('route-home', route === 'home');
  document.body.classList.toggle('route-inner', route !== 'home');
  if (route === 'home') resetMapZoom();
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

function resetMapZoom() {
  if (!mapHome) return;
  window.clearTimeout(mapZoomTimer);
  mapHome.classList.remove('is-zooming', 'zoom-piraeus', 'zoom-spetses');
  mapHome.querySelectorAll('.map-hotspot').forEach(button => {
    button.classList.remove('is-selected', 'tap-pulse');
  });
}

function showRouteWithLoading() {
  const route = getRoute();
  cleanHomeHash();
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
  cleanHomeHash();
  renderRoute(getRoute());
  window.setTimeout(() => hideLoader(), 650);
});

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.classList.toggle('open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', event => {
  const homeLink = event.target.closest('[data-home-link]');
  if (homeLink) {
    event.preventDefault();
    if (currentRoute !== 'home') showLoader('Loading');
    history.pushState(null, '', location.pathname + location.search);
    window.clearTimeout(routeTimer);
    routeTimer = window.setTimeout(() => {
      renderRoute('home');
      hideLoader();
    }, currentRoute === 'home' ? 0 : 520);
    return;
  }

  const mapHotspot = event.target.closest('.map-hotspot');
  if (mapHotspot) {
    event.preventDefault();
    if (mapHome?.classList.contains('is-zooming')) return;
    const targetRoute = mapHotspot.dataset.place;
    if (!targetRoute || !validRoutes.has(targetRoute)) return;

    mapHotspot.classList.remove('tap-pulse');
    void mapHotspot.offsetWidth;
    mapHotspot.classList.add('tap-pulse');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mapHome && !prefersReducedMotion) {
      const mapBounds = mapHome.getBoundingClientRect();
      const imageBounds = mapHome.querySelector('.map-home-image').getBoundingClientRect();
      const destinationBounds = mapHotspot.getBoundingClientRect();
      const destinationX = destinationBounds.left + destinationBounds.width / 2;
      const destinationY = destinationBounds.top + destinationBounds.height / 2;
      mapHome.style.setProperty('--map-focus-x', `${destinationX - imageBounds.left}px`);
      mapHome.style.setProperty('--map-focus-y', `${destinationY - imageBounds.top}px`);
      mapHome.style.setProperty('--map-zoom-x', `${mapBounds.left + mapBounds.width / 2 - destinationX}px`);
      mapHome.style.setProperty('--map-zoom-y', `${mapBounds.top + mapBounds.height / 2 - destinationY}px`);
      mapHome.classList.add('is-zooming', `zoom-${targetRoute}`);
      mapHotspot.classList.add('is-selected');
    }

    mapZoomTimer = window.setTimeout(() => {
      showLoader('Loading');
      location.hash = targetRoute;
    }, prefersReducedMotion ? 0 : 1100);
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

  const lightboxClose = event.target.closest('[data-lightbox-close]');
  const lightboxPrev = event.target.closest('[data-lightbox-prev]');
  const lightboxNext = event.target.closest('[data-lightbox-next]');
  if (lightboxClose) {
    closeLightbox();
    return;
  }
  if (lightboxPrev || lightboxNext) {
    stepLightbox(lightboxPrev ? -1 : 1);
    return;
  }
  if (photoLightbox?.classList.contains('open') && event.target === photoLightbox) {
    closeLightbox();
    return;
  }

  const slideshowPhoto = event.target.closest('[data-slideshow] .main-photo');
  if (slideshowPhoto) {
    openLightbox(slideshowPhoto.closest('[data-slideshow]'));
    return;
  }

  const thumb = event.target.closest('.thumb-row button');
  if (thumb) {
    const gallery = thumb.closest('.detail-gallery');
    const buttons = [...gallery.querySelectorAll('.thumb-row button[data-photo]')];
    setGalleryPhoto(gallery, buttons.indexOf(thumb));
    if (gallery.classList.contains('skouzen-gallery')) {
      openLightbox(gallery);
      return;
    }
    if (gallery.matches('[data-slideshow]')) startSlideshow(gallery.closest('.page'));
  }

  if (!event.target.closest('.site-header')) {
    closeMenu();
  }
});

window.addEventListener('keydown', event => {
  if (event.target.matches?.('.ivory-gallery .main-photo') && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openLightbox(event.target.closest('[data-slideshow]'));
    return;
  }
  if (!photoLightbox?.classList.contains('open')) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') stepLightbox(-1);
  if (event.key === 'ArrowRight') stepLightbox(1);
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
