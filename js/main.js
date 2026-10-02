// 67 DRIP: клиентская логика сайта (чистый JavaScript, без библиотек).
// Модули: меню, количество и выбор опций, корзина (localStorage), каталог (фильтр и сортировка),
// избранное, галерея товара, формы с проверкой полей.
(function () {
  'use strict';

  var PRODUCTS = window.DRIP_PRODUCTS || {};
  var ICONS = window.DRIP_ICONS || {};
  var KEY_CART = 'drip67.cart.v1';
  var KEY_FAV = 'drip67.fav.v1';
  var KEY_PROMO = 'drip67.promo.v1';
  var FREE_FROM = 5000;
  var COURIER_PRICE = 300;
  var PROMO_CODE = 'DRIP67';
  var PROMO_RATE = 0.1;

  /* ---------- вспомогательные функции ---------- */
  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }
  function money(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function setText(selector, text, root) { var el = $(selector, root); if (el) el.textContent = text; }

  /* ---------- мобильное меню ---------- */
  var burger = $('[data-burger]');
  var nav = $('[data-nav]');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- выбор размера, цвета и количества ---------- */
  $$('[role="group"]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var item = e.target.closest('.chip, .swatch');
      if (!item || !group.contains(item)) return;
      $$('.chip, .swatch', group).forEach(function (el) { el.classList.remove('is-active'); el.setAttribute('aria-pressed', 'false'); });
      item.classList.add('is-active');
      item.setAttribute('aria-pressed', 'true');
    });
  });
  $$('[data-qty]').forEach(function (box) {
    var value = $('[data-qty-value]', box);
    $('[data-qty-minus]', box).addEventListener('click', function () { value.textContent = Math.max(1, +value.textContent - 1); });
    $('[data-qty-plus]', box).addEventListener('click', function () { value.textContent = Math.min(99, +value.textContent + 1); });
  });

  /* ---------- уведомление ---------- */
  var toastTimer = null;
  function toast(message) {
    var el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.remove('is-visible');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  /* ---------- корзина ---------- */
  function seedCart() {
    // Первый визит: в корзине три демонстрационные позиции, чтобы сразу было видно оформление заказа.
    return [
      { id: 'hoodie', size: 'L', color: 'Молочный', qty: 1 },
      { id: 'classic', size: 'M', color: 'Белый', qty: 2 },
      { id: 'cap', size: '58-60', color: 'Чёрный', qty: 1 }
    ];
  }
  function getCart() {
    var cart = read(KEY_CART, null);
    if (cart === null) { cart = seedCart(); write(KEY_CART, cart); }
    return cart.filter(function (line) { return PRODUCTS[line.id]; });
  }
  function setCart(cart) { write(KEY_CART, cart); refreshCount(); }
  function lineKey(line) { return [line.id, line.size, line.color].join('|'); }
  function cartCount(cart) { return cart.reduce(function (sum, line) { return sum + line.qty; }, 0); }
  function itemsTotal(cart) { return cart.reduce(function (sum, line) { return sum + PRODUCTS[line.id].price * line.qty; }, 0); }
  function getPromo() { return read(KEY_PROMO, '') === PROMO_CODE; }

  function refreshCount() {
    var count = cartCount(getCart());
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    });
    $$('[data-cart-link]').forEach(function (el) {
      el.setAttribute('aria-label', 'Корзина, ' + count + ' ' + plural(count, 'товар', 'товара', 'товаров'));
    });
  }

  function addToCart(id, size, color, qty) {
    var p = PRODUCTS[id];
    if (!p) return;
    var cart = getCart();
    var line = { id: id, size: size || p.size, color: color || p.color, qty: qty || 1 };
    var found = cart.filter(function (l) { return lineKey(l) === lineKey(line); })[0];
    if (found) found.qty = Math.min(99, found.qty + line.qty); else cart.push(line);
    setCart(cart);
    toast('«' + p.name + '» добавлен в корзину');
  }

  $$('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () { addToCart(btn.getAttribute('data-add')); });
  });

  /* ---------- страница товара ---------- */
  var productPage = $('[data-product-page]');
  if (productPage) {
    var pid = productPage.getAttribute('data-product-page');
    var selected = function (name) {
      var active = $('[data-opt="' + name + '"] .is-active', productPage);
      return active ? active.getAttribute('data-value') : undefined;
    };
    var qtyOf = function () { return +$('[data-qty-value]', productPage).textContent || 1; };
    var updateOpts = function () {
      setText('[data-color-label]', selected('color') || '', productPage);
      $$('[data-sticky-opts]').forEach(function (el) { el.textContent = 'Размер ' + selected('size') + ' · ' + selected('color'); });
    };
    $$('[data-opt]', productPage).forEach(function (group) { group.addEventListener('click', updateOpts); });
    $$('[data-add-current]').forEach(function (btn) {
      btn.addEventListener('click', function () { addToCart(pid, selected('size'), selected('color'), qtyOf()); });
    });
    var buyNow = $('[data-buy-now]', productPage);
    if (buyNow) buyNow.addEventListener('click', function () {
      addToCart(pid, selected('size'), selected('color'), qtyOf());
      window.location.href = 'checkout.html';
    });
    // галерея: клик по миниатюре меняет главное фото
    var main = $('[data-gallery-main] img', productPage);
    var mainOrigin = main ? main.getAttribute('data-zoom') : '';
    $$('[data-gallery-thumb]', productPage).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        $$('[data-gallery-thumb]', productPage).forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        main.src = 'img/' + thumb.getAttribute('data-img') + '.jpg';
        main.className = 'art art--photo ' + (thumb.getAttribute('data-cls') || '');
        main.style.transformOrigin = thumb.getAttribute('data-cls') === 'art--zoom' ? mainOrigin : '';
      });
    });
  }

  /* ---------- избранное ---------- */
  var favs = read(KEY_FAV, []);
  function paintFavs() {
    $$('[data-wish]').forEach(function (btn) {
      var on = favs.indexOf(btn.getAttribute('data-wish')) !== -1;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $$('[data-wish]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-wish');
      var at = favs.indexOf(id);
      if (at === -1) { favs.push(id); toast('Добавлено в избранное'); } else { favs.splice(at, 1); toast('Убрано из избранного'); }
      write(KEY_FAV, favs);
      paintFavs();
    });
  });
  paintFavs();

  /* ---------- каталог: фильтр по категории, поиск, сортировка ---------- */
  var grid = $('[data-grid]');
  if (grid) {
    var params = new URLSearchParams(window.location.search);
    var state = { cat: params.get('cat') || 'all', sort: params.get('sort') || 'pop', q: (params.get('q') || '').trim().toLowerCase(), fav: params.get('fav') === '1' };
    var cards = $$('[data-product]', grid);
    var promo = $('[data-promo]', grid);
    var sortSelect = $('[data-sort]');
    var chips = $$('[data-filter]');
    var validCats = chips.map(function (c) { return c.getAttribute('data-filter'); });
    if (validCats.indexOf(state.cat) === -1) state.cat = 'all';
    var searchInput = $('.search input');
    if (searchInput && state.q) searchInput.value = params.get('q');

    var sorters = {
      pop: function (a, b) { return +a.getAttribute('data-pop') - +b.getAttribute('data-pop'); },
      'price-asc': function (a, b) { return +a.getAttribute('data-price') - +b.getAttribute('data-price'); },
      'price-desc': function (a, b) { return +b.getAttribute('data-price') - +a.getAttribute('data-price'); },
      name: function (a, b) { return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'ru'); }
    };

    var applyCatalog = function () {
      var visible = 0;
      cards.forEach(function (card) {
        var text = (card.getAttribute('data-name') + ' ' + card.textContent).toLowerCase();
        var ok = (state.cat === 'all' || card.getAttribute('data-cat') === state.cat)
          && (!state.q || text.indexOf(state.q) !== -1)
          && (!state.fav || favs.indexOf(card.getAttribute('data-id')) !== -1);
        card.hidden = !ok;
        if (ok) visible += 1;
      });
      cards.slice().sort(sorters[state.sort] || sorters.pop).forEach(function (card) { grid.appendChild(card); });
      if (promo) { grid.appendChild(promo); promo.hidden = state.fav || !!state.q; }
      chips.forEach(function (chip) {
        var on = chip.getAttribute('data-filter') === state.cat;
        chip.classList.toggle('is-active', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (sortSelect) sortSelect.value = state.sort;
      setText('[data-count]', visible + ' ' + plural(visible, 'товар', 'товара', 'товаров'));
      setText('[data-title]', state.fav ? 'Избранное' : (state.cat === 'all' ? 'Все товары' : (chips.filter(function (c) { return c.getAttribute('data-filter') === state.cat; })[0] || {}).textContent));
      var note = $('[data-note]');
      if (note) {
        note.hidden = !state.q;
        note.textContent = state.q ? 'Результаты поиска по запросу «' + params.get('q') + '»' : '';
      }
      var empty = $('[data-empty]');
      if (empty) empty.hidden = visible !== 0;
      grid.hidden = visible === 0;
    };

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { state.cat = chip.getAttribute('data-filter'); state.fav = false; applyCatalog(); });
    });
    if (sortSelect) sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; applyCatalog(); });
    applyCatalog();
  }

  /* ---------- корзина и оформление: отрисовка ---------- */
  function deliveryFor(total, mode) {
    if (mode === 'pickup') return { text: 'Бесплатно', cost: 0 };
    if (mode === 'russia') return { text: 'Рассчитаем после заказа', cost: 0 };
    return total >= FREE_FROM ? { text: 'Бесплатно', cost: 0 } : { text: money(COURIER_PRICE), cost: COURIER_PRICE };
  }
  function discountFor(total) { return getPromo() ? Math.round(total * PROMO_RATE) : 0; }

  function renderTotals(mode) {
    var cart = getCart();
    var total = itemsTotal(cart);
    var discount = discountFor(total);
    var delivery = deliveryFor(total - discount, mode);
    setText('[data-sum-items-label]', 'Товары (' + cartCount(cart) + ')');
    setText('[data-sum-items]', money(total));
    var row = $('[data-sum-discount-row]');
    if (row) { row.hidden = !discount; setText('[data-sum-discount]', '−' + money(discount)); }
    setText('[data-sum-delivery]', delivery.text);
    setText('[data-sum-total]', money(total - discount + delivery.cost));
    var bar = $('[data-progress]');
    if (bar) {
      var left = Math.max(0, FREE_FROM - total);
      var percent = Math.min(100, Math.round(total / FREE_FROM * 100));
      $('i', bar).style.width = percent + '%';
      bar.setAttribute('aria-valuenow', percent);
      setText('[data-progress-value]', left === 0 ? 'включена' : 'ещё ' + money(left));
    }
    return { cart: cart, total: total - discount + delivery.cost };
  }

  function rowHtml(line) {
    var p = PRODUCTS[line.id];
    var key = lineKey(line);
    return '<article class="cart-row" data-key="' + key + '">' +
      '<a class="cart-row__art" href="' + p.file + '"><img class="art art--photo" src="img/' + p.img + '.jpg" alt="' + p.name + '" width="1000" height="1000"></a>' +
      '<div><h2 class="t-h4 cart-row__name"><a href="' + p.file + '">' + p.name + '</a></h2>' +
      '<p class="t-small t-muted cart-row__opts">Размер ' + line.size + ' · ' + line.color + '</p>' +
      '<p class="t-small cart-row__price">' + money(p.price) + ' за шт.</p>' +
      '<button class="cart-row__remove" type="button" data-remove>' + (ICONS.trash || '') + 'Удалить</button></div>' +
      '<div class="qty cart-row__qty"><button class="qty__btn" type="button" aria-label="Меньше" data-dec>' + (ICONS.minus || '−') + '</button>' +
      '<span class="qty__value">' + line.qty + '</span>' +
      '<button class="qty__btn" type="button" aria-label="Больше" data-inc>' + (ICONS.plus || '+') + '</button></div>' +
      '<div class="cart-row__sum">' + money(p.price * line.qty) + '</div></article>';
  }

  var cartRoot = $('[data-cart]');
  if (cartRoot) {
    var list = $('[data-cart-list]', cartRoot);
    var summary = $('[data-cart-summary]', cartRoot);
    var drawCart = function () {
      var cart = getCart();
      var count = cartCount(cart);
      setText('[data-cart-badge]', count + ' ' + plural(count, 'товар', 'товара', 'товаров'));
      if (!cart.length) {
        list.innerHTML = '<div class="cart-empty"><h2 class="t-h3">Корзина пуста</h2><p class="t-muted">Добавьте вещь из каталога, и она появится здесь.</p><a class="btn btn--primary" href="listing.html">Перейти в каталог</a></div>';
        summary.hidden = true;
        return;
      }
      summary.hidden = false;
      list.innerHTML = cart.map(rowHtml).join('');
      renderTotals('courier');
    };
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.cart-row');
      if (!row) return;
      var cart = getCart();
      var line = cart.filter(function (l) { return lineKey(l) === row.getAttribute('data-key'); })[0];
      if (!line) return;
      if (e.target.closest('[data-inc]')) line.qty = Math.min(99, line.qty + 1);
      else if (e.target.closest('[data-dec]')) line.qty = Math.max(1, line.qty - 1);
      else if (e.target.closest('[data-remove]')) cart.splice(cart.indexOf(line), 1);
      else return;
      setCart(cart);
      drawCart();
    });
    var promoForm = $('[data-promo-form]', cartRoot);
    var promoHint = $('[data-promo-hint]', cartRoot);
    if (promoForm) promoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = promoForm.elements.promo.value.trim().toUpperCase();
      var field = promoForm.querySelector('.field');
      if (code === PROMO_CODE) {
        write(KEY_PROMO, code);
        field.classList.remove('is-error');
        promoHint.textContent = 'Промокод применён: скидка 10%.';
        promoHint.classList.remove('is-error');
        drawCart();
      } else {
        field.classList.add('is-error');
        promoHint.classList.add('is-error');
        promoHint.textContent = code ? 'Такого промокода нет. Проверьте написание.' : 'Введите промокод.';
      }
    });
    drawCart();
  }

  var checkoutRoot = $('[data-checkout]');
  var orderSnapshot = null;
  if (checkoutRoot) {
    var lines = $('[data-order-lines]', checkoutRoot);
    var modeSelect = $('[data-delivery]', checkoutRoot);
    var drawOrder = function () {
      var cart = getCart();
      lines.innerHTML = cart.map(function (line) {
        var p = PRODUCTS[line.id];
        return '<li class="order-line"><img class="order-line__img art art--photo" src="img/' + p.img + '.jpg" alt="" width="1000" height="1000">' +
          '<span class="order-line__name">' + p.name + '<br><span class="t-small t-muted">Размер ' + line.size + ' · ' + line.qty + ' шт.</span></span>' +
          '<b>' + money(p.price * line.qty) + '</b></li>';
      }).join('') || '<li class="t-muted">В корзине пусто. <a class="order-line__link" href="listing.html">Выберите вещь в каталоге.</a></li>';
      orderSnapshot = renderTotals(modeSelect.value);
    };
    modeSelect.addEventListener('change', drawOrder);
    drawOrder();
  }

  /* ---------- формы: проверка полей ---------- */
  var RULES = {
    name: function (v) { return !v ? 'Укажите имя' : v.length < 2 ? 'Имя слишком короткое: минимум 2 символа' : ''; },
    email: function (v) {
      if (!v) return 'Укажите e-mail';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Проверьте e-mail: нужен формат name@example.ru';
    },
    phone: function (v) {
      if (!v) return 'Укажите телефон';
      var d = v.replace(/\D/g, '');
      var ok = d.length === 10 || (d.length === 11 && /^[78]/.test(d));
      return ok ? '' : 'Введите номер полностью: 10-11 цифр, например +7 (900) 123-45-67';
    },
    address: function (v) { return !v ? 'Укажите адрес доставки' : v.length < 6 ? 'Адрес слишком короткий: нужны город, улица и дом' : ''; },
    message: function (v) { return !v ? 'Напишите, что нужно напечатать' : v.length < 10 ? 'Опишите задачу подробнее: минимум 10 символов' : ''; },
    agree: function (checked) { return checked ? '' : 'Нужно согласие на обработку персональных данных'; }
  };

  function checkControl(control) {
    var rule = control.getAttribute('data-rule');
    var box = control.closest('[data-field]');
    if (!rule || !box) return '';
    var hint = $('[data-hint]', box);
    if (hint && hint.getAttribute('data-default') === null) hint.setAttribute('data-default', hint.textContent);
    var message = control.type === 'checkbox' ? RULES.agree(control.checked) : RULES[rule](control.value.trim());
    box.classList.toggle('is-error', !!message);
    control.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (hint) hint.textContent = message || hint.getAttribute('data-default');
    return message;
  }

  $$('form[data-form]').forEach(function (form) {
    var controls = $$('[data-rule]', form);
    var status = $('[data-form-status]', form);
    controls.forEach(function (control) {
      control.addEventListener('blur', function () { if (control.value || control.type === 'checkbox') checkControl(control); });
      control.addEventListener('input', function () { if (control.closest('[data-field]').classList.contains('is-error')) checkControl(control); });
      control.addEventListener('change', function () { if (control.type === 'checkbox') checkControl(control); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = controls.filter(function (control) { return checkControl(control); });
      if (form.getAttribute('data-form') === 'checkout' && !getCart().length) {
        status.hidden = false;
        status.textContent = 'В корзине пусто: добавьте товары, чтобы оформить заказ.';
        return;
      }
      if (bad.length) {
        status.hidden = false;
        status.textContent = 'Проверьте ' + bad.length + ' ' + plural(bad.length, 'поле', 'поля', 'полей') + ', отмеченных красным.';
        bad[0].focus();
        return;
      }
      status.hidden = true;
      var data = {};
      controls.forEach(function (c) { data[c.name || c.id] = c.value.trim(); });
      var done = $('[data-form-success]');
      if (form.getAttribute('data-form') === 'checkout') {
        data.order = '67-' + String(Date.now()).slice(-6);
        write(KEY_CART, []);
        write(KEY_PROMO, '');
        refreshCount();
        $('aside.summary').hidden = true;
      }
      $$('[data-fill]', done).forEach(function (el) { el.textContent = data[el.getAttribute('data-fill')] || ''; });
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
  });

  refreshCount();
})();
