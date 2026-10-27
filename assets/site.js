(function () {
'use strict';
// Preserve links shared before the move from hash routes to static documents.
var match=window.location.hash.match(/^#\/(index|about|events|residency)?(?:\/(.*))?$/);
if(match){
  var page=match[1]||'index';
  var target=new URL(page+'.html',window.location.href);
  target.search=window.location.search;
  target.hash=match[2]||'';
  if(page!==document.body.dataset.page){window.location.replace(target.href);return;}
  window.history.replaceState(window.history.state,'',target.hash||window.location.pathname+window.location.search);
}
function initializePage() {
  function listen(target, type, handler) {
    target.addEventListener(type, handler);
  }
  document.documentElement.classList.add('js');

  var menuButton = document.querySelector('.entry-menu-toggle');
  var nav = document.querySelector('.entry-mobile-nav');
  if (menuButton && nav) {
    function setMenu(open, returnFocus) {
      nav.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      if (returnFocus) menuButton.focus();
    }
    listen(menuButton, 'click', function () {setMenu(menuButton.getAttribute('aria-expanded') !== 'true', false);});
    listen(nav, 'click', function (event) {if (event.target.closest('a:not([data-lead-open])')) setMenu(false, false);});
    listen(document, 'click', function (event) {if (!event.target.closest('.entry-site-header,.lead-dialog') && !document.querySelector('#lead-dialog[open]'))setMenu(false, false);});
    listen(document, 'keydown', function (event) {if(event.key==='Escape' && !nav.hidden && !document.querySelector('#lead-dialog[open]'))setMenu(false,true);});
    listen(window, 'resize', function () {if(window.innerWidth>900)setMenu(false,false);});
  }

  var selectedFilter = 'all';
  var archiveItems = Array.from(document.querySelectorAll('[data-category]'));
  var filterGroup = document.querySelector('.archive-filters');
  function filterArchive(announce) {
    var count = 0;
    archiveItems.forEach(function (item) {
      var match = selectedFilter === 'all' || item.dataset.category === selectedFilter;
      item.hidden = !match;
      if (!item.hidden) count += 1;
    });
    if (announce) {
      var status = document.getElementById('archive-status');
      if (status) status.textContent = 'Показано событий: ' + count + '.';
    }
    if (window.ClubMotion) window.ClubMotion.refresh();
  }
  if (filterGroup) {
    filterGroup.hidden = false;
    listen(filterGroup, 'click', function (event) {
      var button = event.target.closest('[data-filter]');
      if (!button) return;
      selectedFilter = button.dataset.filter;
      filterGroup.querySelectorAll('button').forEach(function (item) {
        item.setAttribute('aria-pressed', String(item === button));
      });
      filterArchive(true);
    });
  }

  filterArchive(false);
  function refreshMotion() { if (window.ClubMotion) window.ClubMotion.refresh(); }
  document.querySelectorAll('details').forEach(function (detail) { listen(detail, 'toggle', refreshMotion); });
  document.querySelectorAll('img').forEach(function (image) { listen(image, 'load', refreshMotion); });
  document.querySelectorAll('video').forEach(function (video) {
    listen(video, 'loadedmetadata', refreshMotion);
    listen(video, 'play', function () {document.querySelectorAll('video').forEach(function (other) {if(other!==video)other.pause();});});
  });

  var dialog = document.querySelector('.lightbox');
  var photos = Array.from(document.querySelectorAll('[data-lightbox]'));
  if (dialog && typeof dialog.showModal === 'function' && photos.length) {
    var activePhoto = 0;
    var activePhotos = photos;
    var trigger = null;
    var photoPosition = null;
    var photoBodyStyle = '';
    var photoBackdropDown = false;
    var image = dialog.querySelector('.lightbox-image');
    var caption = dialog.querySelector('.lightbox-caption');
    var counter = dialog.querySelector('.lightbox-counter');
    var close = dialog.querySelector('.lightbox-close');
    var previous = dialog.querySelector('.lightbox-prev');
    var next = dialog.querySelector('.lightbox-next');
    previous.hidden = next.hidden = photos.length < 2;
    function showPhoto(index) {
      activePhoto = (index + activePhotos.length) % activePhotos.length;
      var photo = activePhotos[activePhoto];
      image.src = photo.href;
      image.alt = photo.querySelector('img').alt;
      caption.textContent = photo.dataset.caption;
      counter.textContent = (activePhoto + 1) + ' / ' + activePhotos.length;
    }
    photos.forEach(function (photo, index) {
      listen(photo, 'click', function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        trigger = photo;
        activePhotos = photos.filter(function (item) { return !item.closest('[hidden]'); });
        previous.hidden = next.hidden = activePhotos.length < 2;
        showPhoto(activePhotos.indexOf(photo));
        dialog.showModal();
        photoPosition = {x:window.scrollX,y:window.scrollY};
        photoBodyStyle = document.body.style.cssText;
        var gutter = Math.max(0,window.innerWidth-document.documentElement.clientWidth);
        document.body.style.position='fixed';
        document.body.style.top=-photoPosition.y+'px';
        document.body.style.left=-photoPosition.x+'px';
        document.body.style.width='100%';
        document.body.style.overflow='hidden';
        if(gutter)document.body.style.paddingRight=gutter+'px';
        document.body.classList.add('dialog-open');
        close.focus();
      });
    });
    listen(close, 'click', function () { dialog.close(); });
    listen(previous, 'click', function () { showPhoto(activePhoto - 1); });
    listen(next, 'click', function () { showPhoto(activePhoto + 1); });
    listen(dialog, 'keydown', function (event) {
      if(event.key==='Tab'){
        var controls=[close,previous,next].filter(function(el){return !el.hidden&&!el.disabled;});
        var first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showPhoto(activePhoto + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    function outsidePhoto(event) {
      if(event.target!==dialog)return false;
      var rect=dialog.getBoundingClientRect();
      return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
    }
    listen(dialog,'pointerdown',function(event){photoBackdropDown=outsidePhoto(event);});
    listen(dialog,'click',function(event){if(photoBackdropDown&&outsidePhoto(event))dialog.close();photoBackdropDown=false;});
    listen(dialog, 'close', function () {
      document.body.classList.remove('dialog-open');
      if(photoPosition){
        var pos=photoPosition;photoPosition=null;
        var smooth=document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior='auto';
        document.body.style.cssText=photoBodyStyle;
        window.scrollTo(pos.x,pos.y);
        if(trigger&&trigger.isConnected)trigger.focus({preventScroll:true});
        window.requestAnimationFrame(function(){document.documentElement.style.scrollBehavior=smooth;});
      }
    });
  }

  // Optional analytics hook. No counter, cookies, requests or personal data by default.
  listen(document, 'click', function (event) {
    var target = event.target.closest('[data-track]');
    if (!target) return;
    var payload = {
      action: target.dataset.track,
      page: document.body.dataset.page,
      placement: target.dataset.placement || 'content'
    };
    if (target.dataset.eventId) payload.event_id = target.dataset.eventId;
    document.dispatchEvent(new CustomEvent('club:action', { detail: payload }));
    if (typeof window.clubTrack === 'function') {
      try { window.clubTrack(payload); } catch (error) { /* Analytics must never interrupt navigation. */ }
    }
  });

}

initializePage();
if(window.ClubMotion)window.ClubMotion.mount();
window.addEventListener('pagehide',function(){document.querySelectorAll('video').forEach(function(video){video.pause();});});
}());
