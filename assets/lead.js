(function () {
  'use strict';
  var LEAD_ENDPOINT = 'https://besslavnie-backend.netlify.app/send-lead';
  var SUCCESS_TITLE = 'Заявка отправлена';
  var SUCCESS_DESCRIPTION = 'Скоро с вами свяжутся.';
  var dialog = document.getElementById('lead-dialog');
  var form = document.getElementById('club-lead-form');
  var scrollArea = dialog.querySelector('.lead-scroll');
  var views = Array.from(dialog.querySelectorAll('[data-lead-view]'));
  var fields = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([name="website"]),select,textarea'));
  var origin = null;
  var position = null;
  var originalBodyStyle = '';
  var backdropDown = false;
  var busy = false;
  var formSession = 0;
  var submitButton = form.querySelector('[type="submit"]');
  var submitHTML = submitButton.innerHTML;

  function setView(name) {
    views.forEach(function (view) { view.hidden = view.dataset.leadView !== name; });
    dialog.setAttribute('aria-labelledby', name === 'form' ? 'lead-title' : 'lead-' + name + '-title');
    dialog.classList.toggle('is-creator', name === 'creator');
    dialog.querySelector('.lead-label').textContent = name === 'creator' ? 'САЙТ СОЗДАЛ' : 'ЗАЯВКА В КЛУБ';
    dialog.querySelector('.lead-close').setAttribute('aria-label', name === 'creator' ? 'Закрыть окно' : 'Закрыть форму');
    dialog.setAttribute('aria-describedby', name === 'creator' ? 'lead-creator-description' : name === 'form' ? 'lead-description' : 'lead-success-description');
    scrollArea.scrollTop = 0;
  }
  function errorFor(field) {
    if (field.name === 'consent') return field.checked ? '' : 'Для продолжения необходимо ваше согласие на обработку персональных данных.';
    var value = field.value.trim();
    if (field.name === 'name') return value ? '' : 'Укажите имя.';
    if (field.name === 'contact') return value ? '' : 'Укажите Telegram или телефон.';
    if (field.name === 'business_status') return value ? '' : 'Выберите подходящий вариант.';
    if (field.name === 'situation') return '';
    return '';
  }
  function showError(field, message) {
    document.getElementById(field.id + '-error').textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  function updateFilled(field) { field.closest('.lead-field').classList.toggle('is-filled', field.type === 'checkbox' ? field.checked : !!field.value.trim()); }
  function reset() {
    formSession += 1;form.reset();
    submitButton.disabled = busy;
    submitButton.innerHTML = busy ? 'Отправляем…' : submitHTML;
    fields.forEach(function (field) { showError(field, '');updateFilled(field); });
    form.querySelector('[name="source"]').value = '';
    setView('form');
  }
  function updateViewport() {
    var v = window.visualViewport;
    dialog.style.setProperty('--lead-vh', (v ? v.height : window.innerHeight) + 'px');
    dialog.style.setProperty('--lead-vtop', (v ? v.offsetTop : 0) + 'px');
  }
  function lockScroll() {
    position = { x: window.scrollX, y: window.scrollY };
    originalBodyStyle = document.body.style.cssText;
    var gutter = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.position = 'fixed';
    document.body.style.top = -position.y + 'px';
    document.body.style.left = -position.x + 'px';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    if (gutter) document.body.style.paddingRight = gutter + 'px';
  }
  function releaseScroll(restoreFocus) {
    if (!position) return;
    var p = position;position = null;
    var style = document.documentElement.style;
    var smooth = style.scrollBehavior;
    style.scrollBehavior = 'auto';
    document.body.style.cssText = originalBodyStyle;
    window.scrollTo(p.x, p.y);
    if (restoreFocus && origin && origin.isConnected) origin.focus({ preventScroll: true });
    window.requestAnimationFrame(function () { style.scrollBehavior = smooth; });
    if (window.ClubMotion) window.ClubMotion.refresh();
  }
  function open(trigger, creator) {
    if (dialog.open) return;
    origin = trigger || document.activeElement;
    reset();
    form.querySelector('[name="source"]').value = trigger && trigger.dataset.leadSource || 'content';
    lockScroll();updateViewport();
    dialog.showModal();
    if (creator) {setView('creator');document.getElementById('lead-creator-title').focus({preventScroll:true});}
    else document.getElementById('lead-name').focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open) return;
    releaseScroll(false);dialog.close();
    if (origin && origin.isConnected) origin.focus({preventScroll:true});
  }
  function outside(event) {
    var r = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
  }

  async function deliverLead(payload) {
    var response = await fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      credentials: 'omit',
      body: new URLSearchParams(payload).toString(),
      keepalive: true
    });
    if (!response.ok) throw new Error('delivery');
  }
  function showLeadSuccess(payload, session, page, delivered) {
    // A late response must not replace a newly opened form or the creator card.
    if (dialog.open && session === formSession) {
      document.getElementById('lead-success-title').textContent = SUCCESS_TITLE;
      document.getElementById('lead-success-description').textContent = SUCCESS_DESCRIPTION;
      setView('success');
      document.getElementById('lead-success-title').focus({ preventScroll: true });
    }
    document.dispatchEvent(new CustomEvent('club:action', { detail: { action: delivered ? 'lead_form_complete' : 'lead_form_error', page: page, placement: payload.source } }));
  }
  async function handleLeadSubmit(event) {
    event.preventDefault();
    if (busy) return;
    var invalid = [];
    fields.forEach(function (field) { var message = errorFor(field);showError(field, message);if(message)invalid.push(field); });
    if (invalid.length) { invalid[0].focus();return; }
    busy = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем…';
    form.setAttribute('aria-busy', 'true');
    var session = formSession;
    var page = document.body.dataset.page;
    var payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = String(value).trim(); });
    if (!payload.situation) delete payload.situation;
    payload.consent_at = new Date().toISOString();
    try {
      await Promise.race([
  deliverLead(payload),
  new Promise(function (resolve) {
    window.setTimeout(resolve, 1500);
  })
]);
      showLeadSuccess(payload, session, page, true);
    } catch (error) {
      // Requested UX: HTTP/network failures use the same confirmation, without proving delivery.
      showLeadSuccess(payload, session, page, false);
    } finally {
      busy = false;
      submitButton.disabled = false;
      submitButton.innerHTML = submitHTML;
      form.removeAttribute('aria-busy');
    }
  }
  form.addEventListener('submit', handleLeadSubmit);
  fields.forEach(function (field) {
    function changed() { updateFilled(field);if(field.hasAttribute('aria-invalid'))showError(field,errorFor(field)); }
    field.addEventListener('input', changed);field.addEventListener('change', changed);
  });
  document.addEventListener('click', function (event) {
    var creator = event.target.closest('[data-creator-open]');
    if (creator) {event.preventDefault();open(creator, true);return;}
    var trigger = event.target.closest('[data-lead-open]');
    if (!trigger) return;
    event.preventDefault();open(trigger, false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === ' ' && event.target.matches('a[data-lead-open]')) {event.preventDefault();event.target.click();}
  });
  dialog.querySelectorAll('[data-lead-close]').forEach(function (button) {button.addEventListener('click', close);});
  dialog.addEventListener('pointerdown', function (event) {backdropDown = outside(event);});
  dialog.addEventListener('click', function (event) {if(backdropDown && outside(event))close();backdropDown=false;});
  dialog.addEventListener('cancel', function (event) { event.preventDefault();close(); });
  dialog.addEventListener('close', function () {if(!dialog.open){releaseScroll(true);reset();}});
  dialog.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab') return;
    var focusable = Array.from(dialog.querySelectorAll('a[href],button,input,textarea,select,[tabindex="0"]')).filter(function (e) { return !e.disabled && e.type !== 'hidden' && e.tabIndex >= 0 && !e.closest('[hidden],[aria-hidden="true"]') && e.getClientRects().length; });
    var first=focusable[0],last=focusable[focusable.length-1];
    if (!first) {event.preventDefault();return;}
    if (event.shiftKey && (document.activeElement===first || !focusable.includes(document.activeElement))) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
  });
  window.addEventListener('resize', updateViewport);
  if (window.visualViewport) {window.visualViewport.addEventListener('resize',updateViewport);window.visualViewport.addEventListener('scroll',updateViewport);}
  // Browser back/forward may change a route while a dialog is open.
  window.addEventListener('popstate', close);
  window.addEventListener('hashchange', close);
  window.ClubLead = { close: close };
}());
