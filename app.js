const pages = [...document.querySelectorAll('.page')];
const navLinks = [...document.querySelectorAll('.nav a')];
const header = document.getElementById('siteHeader');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const destinationGroups = [...document.querySelectorAll('.nav-destination')];
const desktopNavigation = () => window.matchMedia('(min-width: 901px) and (hover: hover)').matches;
const propertySelect = document.getElementById('propertySelect');
const loader = document.getElementById('loader');
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
let lightboxPhotoTimer = null;
let lightboxTrigger = null;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Keep destination buttons anchored to the SVG as its displayed size changes.
function positionMapDestinations() {
  if (!mapHome?.classList.contains('illustrated-map')) return;
  const bounds = mapHome.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const scale = Math.min(bounds.width / 1440, bounds.height / 1080);
  const imageWidth = 1440 * scale;
  const imageHeight = 1080 * scale;
  const left = (bounds.width - imageWidth) / 2;
  const top = (bounds.height - imageHeight) * (window.matchMedia('(max-width: 900px)').matches ? .55 : .5);
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
    const linkRoute = link.hasAttribute('data-home-link') ? 'home' : link.getAttribute('href').replace('#', '');
    const isActive = route === linkRoute;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  destinationGroups.forEach(group => {
    const destination = ['piraeus', 'skouzen', 'pearl'].includes(route) ? 'piraeus' : ['spetses', 'ivory'].includes(route) ? 'spetses' : null;
    group.querySelector('.nav-destination-trigger').classList.toggle('active', group.dataset.destination === destination);
  });
}

function hideLoader() {
  if (!loader) return;
  loaderTimer = window.setTimeout(() => {
    loader.classList.add('hide');
    loader.classList.remove('route-loading');
    document.body.classList.remove('is-loading-route');
  }, 0);
}

function animateActivePage(page) {
  page.querySelectorAll('h1, h2').forEach(heading => {
    if (heading.closest('.map-home-copy') || heading.dataset.motionPrepared) return;
    const words = heading.textContent.trim().split(/\s+/);
    heading.replaceChildren();
    words.forEach((word, index) => {
      if (index) heading.append(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'motion-word';
      span.style.setProperty('--word-delay', `${Math.min(index, 6) * 55}ms`);
      span.textContent = word;
      heading.append(span);
    });
    heading.dataset.motionPrepared = 'true';
  });
  const animatedItems = page.querySelectorAll('.reveal-up, .property-card, .detail-gallery, .detail-copy, .booking-copy, .booking-form, .contact-card');
  const topLevelItems = [...animatedItems].filter(item => !item.parentElement.closest('.reveal-up, .property-card, .detail-gallery, .detail-copy, .booking-copy, .booking-form, .contact-card'));
  topLevelItems.forEach((item, index) => {
    item.classList.remove('play-in');
    item.style.setProperty('--enter-delay', `${Math.min(index, 3) * 100}ms`);
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
  const activeIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
  const photoChanged = mainPhoto.getAttribute('src') !== selected.dataset.photo;
  gallery.style.setProperty('--photo-shift', nextIndex >= activeIndex ? '24px' : '-24px');
  if (photoChanged && !reduceMotion() && mainPhoto.complete && mainPhoto.naturalWidth && mainPhoto.parentElement.classList.contains('slideshow-stage')) {
    gallery.querySelectorAll('.photo-previous').forEach(photo => photo.remove());
    const previous = mainPhoto.cloneNode(false);
    previous.className = 'photo-previous';
    previous.removeAttribute('tabindex');
    previous.removeAttribute('role');
    previous.removeAttribute('aria-label');
    previous.setAttribute('aria-hidden', 'true');
    previous.alt = '';
    previous.style.objectFit = getComputedStyle(mainPhoto).objectFit;
    previous.style.objectPosition = getComputedStyle(mainPhoto).objectPosition;
    mainPhoto.after(previous);
    previous.addEventListener('animationend', () => previous.remove(), { once: true });
    window.setTimeout(() => previous.remove(), 900);
  }
  mainPhoto.src = selected.dataset.photo;
  mainPhoto.alt = selected.querySelector('img')?.alt || 'Apartment photo';
  mainPhoto.classList.remove('photo-pop');
  mainPhoto.onload = () => {
    mainPhoto.classList.remove('photo-pop');
    void mainPhoto.offsetWidth;
    if (photoChanged) mainPhoto.classList.add('photo-pop');
  };

  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle('active', buttonIndex === nextIndex);
  });

  const current = gallery.querySelector('[data-slide-current]');
  const total = gallery.querySelector('[data-slide-total]');
  if (current) current.textContent = String(nextIndex + 1);
  if (total) total.textContent = String(buttons.length);
  // Scroll only the thumbnail strip; never move the page or a lightbox behind it.
  const strip = selected.closest('.thumb-row');
  if (strip && strip.scrollWidth > strip.clientWidth) {
    strip.scrollTo({ left: selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
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
  window.clearTimeout(lightboxPhotoTimer);

  const applyPhoto = () => {
    lightboxImage.src = selected.dataset.photo;
    lightboxImage.alt = selected.querySelector('img')?.alt || 'Apartment photo';
    lightboxImage.classList.remove('is-changing');
  };

  if (photoLightbox.classList.contains('open')) {
    lightboxImage.classList.add('is-changing');
    lightboxPhotoTimer = window.setTimeout(applyPhoto, reduceMotion() ? 0 : 100);
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
  lightboxTrigger = document.activeElement;
  lightboxIndex = Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
  stopSlideshow();
  setLightboxPhoto(lightboxIndex);
  photoLightbox.classList.add('open');
  photoLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  photoLightbox.querySelector('[data-lightbox-close]').focus({ preventScroll: true });
}

function closeLightbox() {
  if (!photoLightbox) return;
  window.clearTimeout(lightboxPhotoTimer);
  photoLightbox.classList.remove('open');
  photoLightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  if (lightboxGallery) startSlideshow(lightboxGallery.closest('.page'));
  lightboxGallery = null;
  lightboxTrigger?.focus({ preventScroll: true });
  lightboxTrigger = null;
}

function stepLightbox(direction) {
  if (!lightboxGallery) return;
  setLightboxPhoto(lightboxIndex + direction);
}

function renderRoute(route, motion = null) {
  pages.forEach(page => {
    const isActive = page.dataset.route === route;
    page.classList.remove('is-leaving', 'map-exit', 'scene-reveal', 'scene-destination', 'scene-home');
    page.classList.toggle('active', isActive);
    page.inert = !isActive;
    page.setAttribute('aria-hidden', String(!isActive));
  });
  const activePage = pages.find(page => page.dataset.route === route);
  if (motion && !reduceMotion()) {
    activePage?.classList.add(route === 'home' ? 'scene-home' : motion === 'destination' ? 'scene-destination' : 'scene-reveal');
  }
  document.body.classList.toggle('route-home', route === 'home');
  document.body.classList.toggle('route-inner', route !== 'home');
  if (route === 'home') resetMapZoom();
  setActiveNav(route);
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (route === 'book' && pendingProperty && propertySelect) {
    propertySelect.value = pendingProperty;
    propertySelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (activePage) animateActivePage(activePage);
  startSlideshow(activePage);
  currentRoute = route;
}

function transitionToRoute(route) {
  window.clearTimeout(routeTimer);
  const activePage = pages.find(page => page.classList.contains('active'));
  const fromMapZoom = mapHome?.classList.contains('is-zooming');
  const delay = reduceMotion() || currentRoute === route ? 0 : fromMapZoom ? 260 : 180;
  if (delay) {
    activePage?.classList.toggle('map-exit', fromMapZoom);
    activePage?.classList.add('is-leaving');
  }
  closeMenu();
  stopSlideshow();
  routeTimer = window.setTimeout(() => {
    renderRoute(route, fromMapZoom ? 'destination' : 'page');
    hideLoader();
  }, delay);
}

function resetMapZoom() {
  if (!mapHome) return;
  window.clearTimeout(mapZoomTimer);
  mapHome.classList.remove('is-zooming', 'zoom-piraeus', 'zoom-spetses');
  mapHome.querySelectorAll('.map-hotspot').forEach(button => {
    button.classList.remove('is-selected', 'tap-pulse');
  });
}

function handleRouteChange() {
  const route = getRoute();
  cleanHomeHash();
  transitionToRoute(route);
}

function closeMenu() {
  destinationGroups.forEach(group => setDestinationOpen(group, false));
  if (!menuToggle || !mainNav) return;
  menuToggle.classList.remove('open');
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

function setDestinationOpen(group, open) {
  group.classList.toggle('is-open', open);
  group.querySelector('.nav-destination-trigger').setAttribute('aria-expanded', String(open));
  const panel = group.querySelector('.destination-menu');
  panel.inert = !open;
  panel.setAttribute('aria-hidden', String(!open));
}

destinationGroups.forEach(group => {
  const trigger = group.querySelector('.nav-destination-trigger');
  const openGroup = () => {
    destinationGroups.forEach(other => setDestinationOpen(other, other === group));
  };
  group.addEventListener('pointerenter', () => { if (desktopNavigation()) openGroup(); });
  group.addEventListener('pointerleave', () => { if (desktopNavigation()) setDestinationOpen(group, false); });
  trigger.addEventListener('click', event => {
    if (desktopNavigation() && event.detail > 0) openGroup();
    else if (group.classList.contains('is-open')) setDestinationOpen(group, false);
    else openGroup();
  });
  group.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      setDestinationOpen(group, false); trigger.focus();
    } else if (event.key === 'ArrowDown' && event.target === trigger) {
      event.preventDefault(); openGroup();
      group.querySelector('.destination-menu a').focus();
    } else if (event.key === 'Tab') {
      window.setTimeout(() => { if (!group.contains(document.activeElement)) setDestinationOpen(group, false); }, 0);
    }
  });
});
mainNav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
mainNav.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeMenu(); menuToggle.focus(); }
});

window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('popstate', handleRouteChange);
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 10);
});

window.addEventListener('load', () => {
  cleanHomeHash();
  renderRoute(getRoute());
  hideLoader();
});

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.classList.toggle('open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  if (!isOpen) destinationGroups.forEach(group => setDestinationOpen(group, false));
});

document.addEventListener('click', event => {
  const homeLink = event.target.closest('[data-home-link]');
  if (homeLink) {
    event.preventDefault();
    history.pushState(null, '', location.pathname + location.search);
    transitionToRoute('home');
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
      location.hash = targetRoute;
    }, prefersReducedMotion ? 0 : 1100);
    return;
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
  if (event.target.matches?.('.property-photo-gallery .main-photo') && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openLightbox(event.target.closest('[data-slideshow]'));
    return;
  }
  if (!photoLightbox?.classList.contains('open')) return;
  if (event.key === 'Tab') {
    const controls = [...photoLightbox.querySelectorAll('button')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
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
    note.textContent = `Προεπισκόπηση για το ${data.property}. Το αίτημα δεν έχει αποσταλεί.`;
    form.classList.add('sent');
  });
}
