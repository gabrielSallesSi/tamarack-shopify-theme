/* Tamarack theme: storefront behavior. No dependencies. */
(() => {
  const T = window.Tamarack || { routes: {}, cartDrawer: true, moneyFormat: '${{amount}}' };

  /* ---------- Money ---------- */
  const formatMoney = (cents, format = T.moneyFormat || '${{amount}}') => {
    const value = Number(cents) || 0;
    const fmt = (n, decimals, thousands = ',', decimal = '.') => {
      const fixed = (n / 100).toFixed(decimals);
      const [whole, frac] = fixed.split('.');
      const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return frac ? `${withSep}${decimal}${frac}` : withSep;
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return fmt(value, 0);
        case 'amount_with_comma_separator': return fmt(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fmt(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return fmt(value, 2, "'", '.');
        default: return fmt(value, 2);
      }
    });
  };

  const setArtColor = (scope, hex) => {
    if (!scope || !hex) return;
    scope.querySelectorAll('[data-art]').forEach((art) => art.style.setProperty('--art-color', hex));
  };

  const pressSwatch = (button, group) => {
    group.forEach((b) => {
      b.classList.toggle('is-active', b === button);
      b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
    });
  };

  /* ---------- Color switching (vector art + photo stacks) ---------- */
  /* Shows the 3D model for the panel's color. Models are matched by alt text or file link in Liquid,
     or by their material names once loaded (see the 3D viewer below). */
  const pickModel = (panel) => {
    const items = [...panel.querySelectorAll('[data-model-color]')];
    if (!items.length) return;
    const want = panel.dataset.color;
    const match = items.find((item) => item.dataset.modelColor === want);
    const pending = items.some((item) => item.dataset.modelColor === '' && !item.dataset.checked);
    panel.classList.toggle('is-detecting', !match && pending && !panel.hidden);
    const show = match || (pending ? null : items[0]);
    items.forEach((item) => item.classList.toggle('is-active', item === show));
    const ar = panel.parentElement && panel.parentElement.querySelector('[data-shopify-xr]');
    if (ar && show) ar.setAttribute('data-shopify-model3d-id', show.dataset.modelId);
  };

  const handleize = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const setColor = (scope, handle, hex) => {
    if (!scope) return;
    if (hex) {
      setArtColor(scope, hex);
      scope.querySelectorAll('[data-glow]').forEach((glow) => glow.parentElement.style.setProperty('--glow', hex));
    }
    scope.querySelectorAll('[data-photo-stack]').forEach((stack) => {
      const imgs = [...stack.querySelectorAll('img[data-color]')];
      if (!imgs.some((img) => img.dataset.color === handle)) return;
      imgs.forEach((img) => {
        const on = img.dataset.color === handle;
        if (on) img.loading = 'eager';
        img.classList.toggle('is-active', on);
      });
    });
    scope.querySelectorAll('[data-model3d]').forEach((panel) => {
      panel.dataset.color = handle;
      pickModel(panel);
    });
  };

  /* Centers the bottle body (not the photo box) over the color picker. The handle makes the photo
     lopsided, so the visible pixels of the active photo are measured and the photo is shifted until
     the body sits on the center line. Falls back to the section's fixed shift if a photo can't be read. */
  const bodyOffset = (img) => {
    if (!img || !img.naturalWidth) return null;
    try {
      const w = 160;
      const h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const c = canvas.getContext('2d', { willReadFrequently: true });
      c.drawImage(img, 0, 0, w, h);
      const data = c.getImageData(0, 0, w, h).data;
      let top = -1, bottom = -1;
      for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) { top = y; break; }
      for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) { bottom = y; break; }
      if (top < 0) return null;
      /* Average the body edges over a band near the bottom, below the handle. */
      let sum = 0, n = 0;
      for (let y = Math.round(top + (bottom - top) * 0.78); y <= Math.round(top + (bottom - top) * 0.92); y++) {
        let l = -1, r = -1;
        for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) { if (l < 0) l = x; r = x; }
        if (l >= 0) { sum += (l + r) / 2; n++; }
      }
      if (!n) return null;
      return sum / n / w;
    } catch (e) {
      return null;
    }
  };
  const alignHeroBottle = (hero) => {
    const box = hero.querySelector('.hero__bottle');
    const img = hero.querySelector('.hero__art .photo-stack__img.is-active');
    if (!box || !img) return;
    const apply = () => {
      const ratio = bodyOffset(img);
      if (ratio === null) { box.style.removeProperty('--nudge-px'); return; }
      const el = img.getBoundingClientRect();
      const scale = Math.min(el.width / img.naturalWidth, el.height / img.naturalHeight);
      const drawnW = img.naturalWidth * scale;
      const bodyX = (el.width - drawnW) / 2 + ratio * drawnW;
      box.style.setProperty('--nudge-px', `${(el.width / 2 - bodyX).toFixed(1)}px`);
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  };

  document.querySelectorAll('[data-hero]').forEach((hero) => {
    const swatches = [...hero.querySelectorAll('[data-hero-swatch]')];
    const label = hero.querySelector('[data-hero-color]');
    const cta = hero.querySelector('[data-hero-cta]');
    swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        pressSwatch(swatch, swatches);
        setColor(hero.querySelector('.hero__product'), swatch.dataset.color, swatch.dataset.hex);
        if (label) label.textContent = swatch.dataset.name;
        if (cta && swatch.dataset.url) cta.href = swatch.dataset.url;
        alignHeroBottle(hero);
      });
    });
    alignHeroBottle(hero);
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => alignHeroBottle(hero), 150); });
  });

  document.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-card-swatch]');
    if (!swatch) return;
    const card = swatch.closest('[data-card]');
    const group = [...card.querySelectorAll('[data-card-swatch]')];
    pressSwatch(swatch, group);
    setColor(card, swatch.dataset.color, swatch.dataset.hex);
    if (swatch.dataset.url) card.querySelectorAll('[data-card-link]').forEach((link) => { link.href = swatch.dataset.url; });
  });

  /* ---------- Number ticker for prices (pattern from Magic UI Number Ticker) ---------- */
  const reduceMotionEarly = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tickers = new WeakMap();
  const tickTo = (el, cents) => {
    const target = Math.round(Number(cents) || 0);
    const from = tickers.has(el) ? tickers.get(el).value : target;
    if (reduceMotionEarly || from === target) {
      tickers.set(el, { value: target, raf: 0 });
      el.textContent = formatMoney(target);
      return;
    }
    const prev = tickers.get(el);
    if (prev && prev.raf) cancelAnimationFrame(prev.raf);
    const state = { value: from, raf: 0 };
    tickers.set(el, state);
    let velocity = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const stiffness = 170;
      const damping = 26;
      velocity += (stiffness * (target - state.value) - damping * velocity) * dt;
      state.value += velocity * dt;
      if (Math.abs(target - state.value) < 0.5 && Math.abs(velocity) < 5) {
        state.value = target;
        el.textContent = formatMoney(target);
        state.raf = 0;
        return;
      }
      el.textContent = formatMoney(Math.round(state.value));
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  };

  /* ---------- Cart drawer ---------- */
  const drawer = () => document.querySelector('[data-cart-drawer]');
  let lastFocus = null;

  const updateCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.classList.toggle('is-empty', Number(count) === 0);
    });
    document.querySelectorAll('[data-cart-toggle]').forEach((el) => el.setAttribute('aria-label', `Cart, ${count} items`));
  };

  const renderDrawer = (html) => {
    const current = drawer();
    if (!current || !html) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const next = doc.querySelector('[data-cart-drawer]');
    if (!next) return;
    const wasUnlocked = current.querySelector('.ship-progress')?.dataset.unlocked === 'true';
    current.querySelector('.drawer__panel').innerHTML = next.querySelector('.drawer__panel').innerHTML;
    current.dataset.count = next.dataset.count;
    updateCount(next.dataset.count);
    const nowUnlocked = current.querySelector('.ship-progress')?.dataset.unlocked === 'true';
    if (nowUnlocked && !wasUnlocked) setTimeout(celebrate, 500);
  };

  const openDrawer = () => {
    const el = drawer();
    if (!el) return;
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      el.querySelector('.drawer__panel').focus();
    });
  };

  const closeDrawer = () => {
    const el = drawer();
    if (!el || el.hidden) return;
    el.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    const done = () => { el.hidden = true; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 350);
    if (lastFocus) lastFocus.focus();
  };

  const onCartPage = document.body.classList.contains('template-cart');

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-cart-toggle]') && drawer() && !onCartPage) {
      event.preventDefault();
      openDrawer();
    }
    if (event.target.closest('[data-drawer-close]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
    const el = drawer();
    if (event.key === 'Tab' && el && !el.hidden) {
      const focusables = [...el.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')].filter((n) => n.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  const postJSON = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.status) throw new Error(data.description || data.message || 'Something went wrong. Try again.');
    return data;
  };

  const changeLine = async (line, quantity, scope) => {
    const el = drawer();
    if (el) el.classList.add('is-busy');
    try {
      const data = await postJSON(T.routes.cartChange, { line, quantity, sections: 'cart-drawer' });
      if (onCartPage) { window.location.reload(); return; }
      renderDrawer(data.sections && data.sections['cart-drawer']);
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (el) el.classList.remove('is-busy');
    }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qty-change]');
    if (!button) return;
    const line = button.closest('[data-line]');
    if (!line) return;
    changeLine(Number(line.dataset.line), Number(button.dataset.qtyChange));
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-upsell-add]');
    if (!button) return;
    button.disabled = true;
    try {
      const data = await postJSON(T.routes.cartAdd, { items: [{ id: Number(button.dataset.upsellAdd), quantity: 1 }], sections: 'cart-drawer' });
      renderDrawer(data.sections && data.sections['cart-drawer']);
    } catch (error) {
      button.disabled = false;
      window.alert(error.message);
    }
  });

  /* ---------- Product form ---------- */
  document.querySelectorAll('[data-product-section]').forEach((section) => {
    const jsonEl = section.querySelector('[data-product-json]');
    const form = section.querySelector('[data-product-form]');
    if (!jsonEl || !form) return;
    const data = JSON.parse(jsonEl.textContent);
    const variants = data.variants || [];

    const idInput = form.querySelector('[data-variant-id]');
    const addButton = form.querySelector('[data-add-button]');
    const addLabel = form.querySelector('[data-add-label]');
    const errorBox = form.querySelector('[data-form-error]');
    const sticky = section.querySelector('[data-sticky-buy]');
    const stickyButton = section.querySelector('[data-sticky-button]');

    const findVariant = () => {
      const fieldsets = [...form.querySelectorAll('[data-option-index]')];
      if (!fieldsets.length) return variants[0];
      const chosen = fieldsets.map((fs) => {
        const checked = fs.querySelector('input:checked');
        return checked ? checked.value : null;
      });
      return variants.find((v) => v.options.every((value, i) => value === chosen[i]));
    };

    const currentPlan = () => {
      const purchase = form.querySelector('[data-purchase-options]');
      if (!purchase) return '';
      const type = purchase.querySelector('[data-purchase-type]:checked');
      if (!type || type.value !== 'subscribe') return '';
      const select = type.closest('.purchase__option--sub').querySelector('[data-selling-plan-select]');
      return select ? select.value : '';
    };

    const unitPrice = (variant) => {
      const plan = currentPlan();
      const allocations = (data.allocations || {})[variant.id] || {};
      return plan && allocations[plan] ? allocations[plan] : variant.price;
    };

    const refreshPrices = (variant) => {
      const unit = unitPrice(variant);
      section.querySelectorAll('[data-price-current]').forEach((el) => tickTo(el, unit));
      section.querySelectorAll('[data-price-compare]').forEach((el) => {
        el.textContent = formatMoney(variant.compare_at_price || 0);
        el.hidden = !(variant.compare_at_price > variant.price);
      });

      form.querySelectorAll('[data-tier]').forEach((input) => {
        const qty = Number(input.value);
        const pct = Number(input.dataset.discount) || 0;
        const tier = input.closest('.tier');
        const total = tier.querySelector('[data-tier-total]');
        const full = tier.querySelector('[data-tier-full]');
        if (total) tickTo(total, Math.round(unit * qty * (100 - pct) / 100));
        if (full) full.textContent = formatMoney(unit * qty);
      });

      const once = form.querySelector('[data-once-price]');
      if (once) once.textContent = formatMoney(variant.price);
      form.querySelectorAll('.purchase__option--sub').forEach((group) => {
        const select = group.querySelector('[data-selling-plan-select]');
        const priceEl = group.querySelector('[data-sub-price]');
        const allocations = (data.allocations || {})[variant.id] || {};
        if (select && priceEl && allocations[select.value]) priceEl.textContent = formatMoney(allocations[select.value]);
      });

      const planInput = form.querySelector('[data-selling-plan]');
      if (planInput) planInput.value = currentPlan();

      const qtyInput = form.querySelector('[data-tier]:checked');
      const qty = qtyInput ? Number(qtyInput.value) : 1;
      const pct = qtyInput ? Number(qtyInput.dataset.discount) || 0 : 0;
      /* Buy it now (Shopify's dynamic checkout) reads the form's quantity field, so keep it in sync with the tier. */
      const qtyField = form.querySelector('[data-quantity-input]');
      if (qtyField) qtyField.value = String(qty);
      const stickyPrice = section.querySelector('[data-sticky-price]');
      if (stickyPrice) tickTo(stickyPrice, Math.round(unit * qty * (100 - pct) / 100));
    };

    const refreshVariant = () => {
      const variant = findVariant();
      if (errorBox) errorBox.hidden = true;

      form.querySelectorAll('[data-option-index]').forEach((fs) => {
        const checked = fs.querySelector('input:checked');
        const label = fs.querySelector('[data-option-value]');
        if (checked && label) label.textContent = checked.value;
      });

      if (!variant) {
        addButton.disabled = true;
        addLabel.textContent = 'Unavailable';
        if (stickyButton) stickyButton.disabled = true;
        return;
      }

      idInput.value = variant.id;
      addButton.disabled = !variant.available;
      addLabel.textContent = variant.available ? 'Add to cart' : 'Sold out';
      if (stickyButton) stickyButton.disabled = !variant.available;
      const stickyVariant = section.querySelector('[data-sticky-variant]');
      if (stickyVariant) stickyVariant.textContent = variant.title;

      if (data.colorIndex >= 0) {
        const colorName = variant.options[data.colorIndex];
        setColor(section.querySelector('[data-product-stage]'), handleize(colorName), data.colorHex[colorName]);
        section.querySelectorAll('[data-thumb-color]').forEach((t) => t.classList.toggle('is-active', t.dataset.thumbColor === handleize(colorName)));
      }

      if (variant.featured_media) {
        const thumb = section.querySelector(`[data-thumb][data-media-id="${variant.featured_media.id}"]`);
        if (thumb) thumb.click();
      }

      refreshPrices(variant);

      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    };

    const syncQuantity = () => {
      const tier = form.querySelector('[data-tier]:checked');
      const qtyField = form.querySelector('[data-quantity-input]');
      if (qtyField) qtyField.value = tier ? tier.value : '1';
    };
    syncQuantity();
    window.addEventListener('pageshow', syncQuantity);
    form.querySelectorAll('[data-tier]').forEach((tier) => tier.addEventListener('input', syncQuantity));

    form.addEventListener('change', (event) => {
      if (event.target.matches('[data-option-input]')) refreshVariant();
      else if (event.target.matches('[data-tier], [data-purchase-type], [data-selling-plan-select]')) {
        if (event.target.matches('[data-selling-plan-select]')) {
          const radio = event.target.closest('.purchase__option--sub').querySelector('[data-purchase-type]');
          if (radio) radio.checked = true;
        }
        const variant = findVariant();
        if (variant) refreshPrices(variant);
      }
    });

    section.querySelectorAll('[data-thumb-color]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const input = [...form.querySelectorAll('[data-option-input]')].find((i) => i.value === thumb.dataset.colorValue);
        if (input && !input.checked) input.click();
      });
    });

    section.querySelectorAll('[data-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const main = section.querySelector('[data-main-media] img');
        if (main) { main.src = thumb.dataset.src; main.removeAttribute('srcset'); }
        section.querySelectorAll('[data-thumb]').forEach((t) => t.classList.toggle('is-active', t === thumb));
      });
    });

    form.addEventListener('submit', async (event) => {
      if (!T.cartDrawer || !drawer()) return;
      event.preventDefault();
      const qtyInput = form.querySelector('[data-tier]:checked');
      const item = { id: Number(idInput.value), quantity: qtyInput ? Number(qtyInput.value) : 1 };
      const plan = currentPlan();
      if (plan) item.selling_plan = Number(plan);

      addButton.disabled = true;
      addButton.setAttribute('aria-busy', 'true');
      try {
        const result = await postJSON(T.routes.cartAdd, { items: [item], sections: 'cart-drawer' });
        renderDrawer(result.sections && result.sections['cart-drawer']);
        addButton.classList.remove('is-added');
        void addButton.offsetWidth;
        addButton.classList.add('is-added');
        addLabel.textContent = 'Added';
        setTimeout(() => {
          addButton.classList.remove('is-added');
          addLabel.textContent = 'Add to cart';
        }, 1600);
        setTimeout(openDrawer, 450);
      } catch (error) {
        if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
      } finally {
        addButton.disabled = false;
        addButton.removeAttribute('aria-busy');
      }
    });

    if (sticky && addButton) {
      let ticking = false;
      const updateSticky = () => {
        ticking = false;
        const show = addButton.getBoundingClientRect().bottom < 0;
        if (show === sticky.classList.contains('is-visible')) return;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
        if (stickyButton) stickyButton.tabIndex = show ? 0 : -1;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(updateSticky); }
      }, { passive: true });
      updateSticky();
    }

    const initial = findVariant();
    if (initial) refreshPrices(initial);
  });

  /* ---------- Collection sorting ---------- */
  document.querySelectorAll('[data-sort-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', select.value);
      url.searchParams.delete('page');
      window.location.href = url.toString();
    });
  });

  /* ---------- Count-up + line draw on the temperature track (pattern from React Bits CountUp) ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const countUp = (el, from, to, duration) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(from + (to - from) * easeOutExpo(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        seen.unobserve(entry.target);
        entry.target.classList.add('is-playing');
        entry.target.querySelectorAll('[data-count-to]').forEach((el) => {
          countUp(el, Number(el.dataset.countFrom), Number(el.dataset.countTo), 1800);
        });
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('[data-retention]').forEach((el) => seen.observe(el));
  }

  /* ---------- Spotlight on product art (adapted from React Bits SpotlightCard) ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const SIZE = 220;
    document.querySelectorAll('[data-spotlight]').forEach((root) => {
      const light = root.querySelector('.spotlight__light');
      const edge = root.querySelector('.spotlight__edge');
      if (!light || !edge) return;
      const state = { x: 0, y: 0, presence: 0 };
      const pointer = { x: 0, y: 0, inside: false };
      let raf = 0;
      let last = 0;
      const paint = () => {
        const at = `${state.x.toFixed(1)}px ${state.y.toFixed(1)}px`;
        light.style.background = `radial-gradient(circle ${SIZE}px at ${at}, rgba(255,255,255,.95), rgba(255,255,255,0) 70%)`;
        edge.style.background = `radial-gradient(circle ${SIZE * 0.6}px at ${at}, var(--spruce), transparent 75%)`;
        light.style.opacity = String(state.presence * 0.85);
        edge.style.opacity = String(state.presence * 0.55);
      };
      const tick = (now) => {
        raf = 0;
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        last = now;
        const target = pointer.inside ? 1 : 0;
        if (state.presence < 0.02 && target > 0) { state.x = pointer.x; state.y = pointer.y; }
        const follow = 1 - Math.exp(-dt / (0.015 + 0.3 * 0.22));
        state.x += (pointer.x - state.x) * follow;
        state.y += (pointer.y - state.y) * follow;
        const fade = 1 - Math.exp(-dt / (target > state.presence ? 0.1 : 0.32));
        state.presence += (target - state.presence) * fade;
        if (Math.abs(target - state.presence) < 0.002) state.presence = target;
        paint();
        const moving = Math.abs(pointer.x - state.x) > 0.1 || Math.abs(pointer.y - state.y) > 0.1;
        if (moving || state.presence !== target) raf = requestAnimationFrame(tick);
      };
      const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
      root.addEventListener('pointermove', (event) => {
        const rect = root.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.inside = true;
        wake();
      });
      root.addEventListener('pointerleave', () => { pointer.inside = false; wake(); });
    });
  }

  /* ---------- Trail lines behind the newsletter (adapted from Background Paths, Kokonut UI on 21st.dev, MIT) ---------- */
  const LAYERS = [
    { width: 1, opacity: 0.16, phase: 0.6, pace: 0.7, part: 0.45 },
    { width: 1.25, opacity: 0.26, phase: 0.3, pace: 0.85, part: 0.75 },
    { width: 1.5, opacity: 0.4, phase: 0, pace: 1, part: 1 },
  ];
  const SAMPLES = 64;
  const OVERSCAN = 0.06;
  const PART_RADIUS = 150;
  const PART_PUSH = 56;
  const lineY = (s, u, layer, frame, shape, band) => {
    const t = frame.time * layer.pace;
    const x = u * frame.width;
    const center = frame.height * 0.5 + shape.slope * (x - frame.width / 2) + band * 0.1 * Math.sin(Math.PI * 2 * (0.75 * u + 0.1) + layer.phase + t * 0.35);
    const turn = 0.22 + 0.09 * Math.sin(t * 0.21 + layer.phase);
    const breathe = 0.3 * Math.sin(t * 0.5 + s * 4 + layer.phase);
    const twist = Math.cos(Math.PI * (u - turn) + s * (0.6 + breathe) + layer.phase);
    return center + s * shape.spread * band * twist;
  };
  const partY = (x, y, frame, strength) => {
    const p = frame.pointer;
    if (p.amount < 0.001) return y;
    const dx = x - p.x;
    const dy = y - p.y;
    const falloff = Math.exp(-(dx * dx + dy * dy) / (PART_RADIUS * PART_RADIUS));
    return y + (dy / (Math.abs(dy) + 24)) * falloff * PART_PUSH * strength * p.amount;
  };
  document.querySelectorAll('[data-background-paths]').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const host = canvas.closest('section') || canvas.parentElement;
    const count = Number(canvas.dataset.count) || 36;
    const shape = { count, spread: 1, slope: Math.tan(((Number(canvas.dataset.angle) || -6) * Math.PI) / 180), interactive: !reduceMotion };
    const perLayer = Math.max(1, Math.round(count / LAYERS.length));
    const frame = { width: 0, height: 0, time: 40, drawn: new Array(perLayer * LAYERS.length).fill(reduceMotion ? 1 : 0), pointer: { x: 0, y: 0, amount: 0, on: false } };
    let color = getComputedStyle(canvas).color;
    let start = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    const easeOut = (t) => 1 - (1 - t) ** 3;
    const paint = () => {
      const { width, height } = frame;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const band = Math.min(height, width * 1.1);
      const xs = new Float32Array(SAMPLES + 1);
      const ys = new Float32Array(SAMPLES + 1);
      LAYERS.forEach((layer, li) => {
        ctx.lineWidth = layer.width;
        for (let i = 0; i < perLayer; i++) {
          const drawn = frame.drawn[li * perLayer + i] ?? 1;
          if (drawn <= 0) continue;
          const s = perLayer === 1 ? 0 : i / (perLayer - 1) - 0.5;
          const lastK = Math.max(1, Math.ceil(SAMPLES * drawn));
          for (let k = 0; k <= lastK; k++) {
            const u = -OVERSCAN + (k / SAMPLES) * (1 + OVERSCAN * 2);
            const x = u * width;
            const y = lineY(s, u, layer, frame, shape, band);
            xs[k] = x;
            ys[k] = shape.interactive ? partY(x, y, frame, layer.part) : y;
          }
          ctx.globalAlpha = layer.opacity * (0.45 + 0.55 * (1 - Math.abs(s) * 2));
          ctx.beginPath();
          ctx.moveTo(xs[0], ys[0]);
          for (let k = 1; k < lastK; k++) ctx.quadraticCurveTo(xs[k], ys[k], (xs[k] + xs[k + 1]) / 2, (ys[k] + ys[k + 1]) / 2);
          ctx.lineTo(xs[lastK], ys[lastK]);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      frame.width = rect.width;
      frame.height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };
    const loop = (now) => {
      raf = 0;
      if (!start) { start = now; last = now; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame.time += dt * 0.6;
      const elapsed = now - start;
      for (let i = 0; i < frame.drawn.length; i++) {
        if (frame.drawn[i] < 1) frame.drawn[i] = easeOut(Math.min(Math.max((elapsed - (i % perLayer) * 40) / 1400, 0), 1));
      }
      const p = frame.pointer;
      p.amount += ((p.on ? 1 : 0) - p.amount) * 0.08;
      paint();
      if (visible) raf = requestAnimationFrame(loop);
    };
    const play = () => { if (!raf && visible && !reduceMotion) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    resize();
    canvas.style.opacity = '1';
    new ResizeObserver(resize).observe(canvas);
    let onScreen = false;
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visible = onScreen && !document.hidden;
      if (visible) { color = getComputedStyle(canvas).color; play(); }
    }).observe(host);
    document.addEventListener('visibilitychange', () => { visible = onScreen && !document.hidden; if (visible) play(); });
    host.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || !shape.interactive) return;
      const rect = canvas.getBoundingClientRect();
      frame.pointer.x = event.clientX - rect.left;
      frame.pointer.y = event.clientY - rect.top;
      frame.pointer.on = true;
    });
    host.addEventListener('pointerleave', () => { frame.pointer.on = false; });
  });

  /* ---------- Confetti when free shipping unlocks (Magic UI Confetti, canvas-confetti ISC) ---------- */
  function celebrate() {
    if (reduceMotion) return;
    const fire = () => {
      if (!window.confetti) return;
      const colors = ['#F2541B', '#2C3F38', '#96A7AB', '#D2CFCB', '#F7A23B'];
      const origin = { x: window.innerWidth > 640 ? 0.82 : 0.5, y: 0.22 };
      window.confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin, colors, scalar: 0.9, disableForReducedMotion: true });
      setTimeout(() => window.confetti({ particleCount: 40, spread: 100, startVelocity: 28, origin, colors, scalar: 0.8, disableForReducedMotion: true }), 180);
    };
    if (window.confetti) return fire();
    const src = T.assets && T.assets.confetti;
    if (!src) return;
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = fire;
    document.head.appendChild(tag);
  }

  /* ---------- Rotating hero word (adapted from React Bits RotatingText) ---------- */
  document.querySelectorAll('[data-rotator]').forEach((rotator) => {
    const words = [...rotator.querySelectorAll('.rotator__word')];
    words.forEach((word) => {
      const text = word.textContent;
      word.textContent = '';
      [...text].forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'rotator__char';
        span.style.setProperty('--c', i);
        span.textContent = ch === ' ' ? ' ' : ch;
        word.appendChild(span);
      });
    });
    const fit = (word) => { rotator.style.width = `${word.getBoundingClientRect().width}px`; };
    requestAnimationFrame(() => fit(words[0]));
    if (reduceMotion || words.length < 2) return;
    let index = 0;
    let timer = 0;
    const next = () => {
      const current = words[index];
      index = (index + 1) % words.length;
      const incoming = words[index];
      current.classList.remove('is-active');
      current.classList.add('is-leaving');
      setTimeout(() => current.classList.remove('is-leaving'), 700);
      incoming.classList.add('is-active');
      fit(incoming);
    };
    const start = () => { if (!timer) timer = setInterval(next, 2600); };
    const stop = () => { clearInterval(timer); timer = 0; };
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(rotator);
    window.addEventListener('resize', () => fit(words[index]));
  });

  /* ---------- Tilted product photo (adapted from React Bits TiltedCard) ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const inner = card.querySelector('.tilt__inner');
      const glare = card.querySelector('.tilt__glare');
      const MAX = 12;
      const state = { rx: 0, ry: 0, s: 1, trx: 0, try: 0, ts: 1 };
      let raf = 0;
      const tick = () => {
        raf = 0;
        state.rx += (state.trx - state.rx) * 0.12;
        state.ry += (state.try - state.ry) * 0.12;
        state.s += (state.ts - state.s) * 0.12;
        inner.style.transform = `rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg) scale(${state.s.toFixed(3)})`;
        if (Math.abs(state.trx - state.rx) + Math.abs(state.try - state.ry) + Math.abs(state.ts - state.s) > 0.01) raf = requestAnimationFrame(tick);
      };
      const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        state.try = px * MAX * 2;
        state.trx = -py * MAX * 2;
        state.ts = 1.04;
        card.classList.add('is-active');
        if (glare) { glare.style.setProperty('--gx', `${(px + 0.5) * 100}%`); glare.style.setProperty('--gy', `${(py + 0.5) * 100}%`); }
        wake();
      });
      card.addEventListener('pointerleave', () => {
        state.trx = 0; state.try = 0; state.ts = 1;
        card.classList.remove('is-active');
        wake();
      });
      if (glare) {
        const active = () => card.querySelector('.photo-stack__img.is-active');
        const sync = () => {
          const img = active();
          if (!img) return;
          glare.style.setProperty('--glare-mask', `url("${img.currentSrc || img.src}") center bottom / contain no-repeat`);
        };
        sync();
        card.closest('[data-hero]')?.addEventListener('click', () => setTimeout(sync, 0));
      }
    });
  }

  /* ---------- Magnetic buttons (adapted from React Bits Magnet) ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-magnet]').forEach((el) => {
      const PADDING = 70;
      const STRENGTH = 3.2;
      window.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const near = Math.abs(dx) < rect.width / 2 + PADDING && Math.abs(dy) < rect.height / 2 + PADDING;
        el.classList.toggle('is-pulling', near);
        el.style.transform = near ? `translate3d(${(dx / STRENGTH).toFixed(1)}px, ${(dy / STRENGTH).toFixed(1)}px, 0)` : 'translate3d(0, 0, 0)';
      }, { passive: true });
    });
  }

  /* ---------- Scroll-linked effects: progress bar, text reveal, marquee velocity ---------- */
  const progressBars = [...document.querySelectorAll('[data-scroll-progress]')];
  const reveals = [...document.querySelectorAll('[data-text-reveal]')];
  const marquees = [...document.querySelectorAll('.marquee__track')];
  let lastY = window.scrollY;
  let lastT = performance.now();
  let velocity = 0;
  let scrollRaf = 0;
  const onScrollFrame = () => {
    scrollRaf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    progressBars.forEach((bar) => bar.style.setProperty('--progress', progress.toFixed(4)));
    if (!reduceMotion) {
      reveals.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const span = rect.height - window.innerHeight;
        const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
        section.style.setProperty('--p', p.toFixed(4));
      });
    }
  };
  window.addEventListener('scroll', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScrollFrame); }, { passive: true });
  onScrollFrame();

  // Marquee speeds up with scroll speed and reverses on scroll up (pattern from React Bits ScrollVelocity).
  if (!reduceMotion && marquees.length) {
    const tickVelocity = (now) => {
      const dt = Math.max(1, now - lastT);
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      lastT = now;
      const instant = dy / dt;
      velocity += (instant - velocity) * 0.12;
      const direction = velocity < -0.02 ? -1 : 1;
      const rate = direction * (1 + Math.min(5, Math.abs(velocity) * 6));
      marquees.forEach((track) => {
        const anim = track.getAnimations()[0];
        if (anim && !track.matches(':hover')) anim.playbackRate = rate;
      });
      requestAnimationFrame(tickVelocity);
    };
    requestAnimationFrame(tickVelocity);
  }

  /* ---------- Anatomy hotspots ---------- */
  document.querySelectorAll('[data-anatomy]').forEach((figure) => {
    const section = figure.closest('section');
    const list = section?.querySelector('.anatomy__list');
    const close = () => {
      figure.querySelectorAll('.hotspot.is-open').forEach((h) => { h.classList.remove('is-open'); h.querySelector('[data-hotspot]').setAttribute('aria-expanded', 'false'); });
      list?.classList.remove('has-focus');
      list?.querySelectorAll('.is-focus').forEach((row) => row.classList.remove('is-focus'));
    };
    figure.querySelectorAll('[data-hotspot]').forEach((button) => {
      const focusRow = (on) => {
        const row = list?.querySelector(`[data-hotspot-row="${button.dataset.hotspot}"]`);
        list?.classList.toggle('has-focus', on);
        row?.classList.toggle('is-focus', on);
      };
      button.addEventListener('click', () => {
        const spot = button.closest('.hotspot');
        const open = !spot.classList.contains('is-open');
        close();
        spot.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', String(open));
        focusRow(open);
      });
      button.addEventListener('pointerenter', () => focusRow(true));
      button.addEventListener('pointerleave', () => { if (!button.closest('.hotspot').classList.contains('is-open')) focusRow(false); });
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    document.addEventListener('click', (event) => { if (!event.target.closest('.hotspot')) close(); });
  });

  /* ---------- Decrypting spec values (adapted from React Bits DecryptedText) ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/%-';
    const decrypt = (el) => {
      const original = el.textContent;
      const order = [...original].map((_, i) => i);
      let revealed = 0;
      el.classList.add('is-scrambling');
      const timer = setInterval(() => {
        revealed += Math.max(1, Math.ceil(original.length / 22));
        el.textContent = order.map((i) => {
          const ch = original[i];
          if (i < revealed || ch === ' ') return ch;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('');
        if (revealed >= original.length) {
          clearInterval(timer);
          el.textContent = original;
          el.classList.remove('is-scrambling');
        }
      }, 45);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        entry.target.querySelectorAll('[data-decrypt]').forEach((el, i) => setTimeout(() => decrypt(el), i * 140));
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.spec__list').forEach((list) => io.observe(list));
  }

  /* ---------- Lens zoom on the product photo (adapted from Magic UI Lens) ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-lens]').forEach((stage) => {
      let lens = null;
      const build = () => {
        lens = document.createElement('div');
        lens.className = 'lens';
        lens.setAttribute('aria-hidden', 'true');
        const zoom = document.createElement('div');
        zoom.className = 'lens__zoom';
        const ring = document.createElement('div');
        ring.className = 'lens__ring';
        lens.append(zoom, ring);
        stage.appendChild(lens);
      };
      const fill = () => {
        const zoom = lens.querySelector('.lens__zoom');
        const source = stage.querySelector('.photo-stack, .art, .media, .product__photo');
        zoom.innerHTML = '';
        if (!source) return;
        const clone = source.cloneNode(true);
        clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        clone.style.position = 'absolute';
        const rect = source.getBoundingClientRect();
        const host = stage.getBoundingClientRect();
        clone.style.left = `${rect.left - host.left}px`;
        clone.style.top = `${rect.top - host.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        zoom.appendChild(clone);
      };
      stage.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse') return;
        if (!lens) build();
        fill();
        lens.classList.add('is-on');
      });
      stage.addEventListener('pointermove', (event) => {
        if (!lens) return;
        const host = stage.getBoundingClientRect();
        const x = event.clientX - host.left;
        const y = event.clientY - host.top;
        lens.style.setProperty('--lx', `${x}px`);
        lens.style.setProperty('--ly', `${y}px`);
        const mask = `radial-gradient(circle ${(85 / 1.8).toFixed(1)}px at ${x}px ${y}px, #000 99%, transparent 100%)`;
        lens.querySelector('.lens__zoom').style.webkitMaskImage = mask;
        lens.querySelector('.lens__zoom').style.maskImage = mask;
      });
      stage.addEventListener('pointerleave', () => lens?.classList.remove('is-on'));
    });
  }

  /* ---------- Odometer number (adapted from React Bits Counter, MIT + Commons Clause, David Haz) ----------
     Each digit is a strip of 0-9 moved by a damped spring, with a vertical motion blur while it spins.
     Leading zeros fold away, so 92 -> 6 drops a tile instead of showing 06. */
  const createOdometer = (root, count) => {
    const TAU = Math.PI * 2;
    const mod = (v, b) => ((v % b) + b) % b;
    const wrap = (o) => mod(o + 5, 10) - 5;
    const cfg = { duration: 0.75, bounce: 0.22, stagger: 0.06 };
    const uid = `odo${Math.random().toString(36).slice(2, 8)}`;
    root.textContent = '';
    root.setAttribute('aria-hidden', 'true');
    const items = [];
    for (let i = 0; i < count; i++) {
      const tile = document.createElement('span');
      tile.className = 'odo__digit';
      const sizer = document.createElement('span');
      sizer.className = 'odo__sizer';
      sizer.textContent = '0';
      const win = document.createElement('span');
      win.className = 'odo__window';
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      const numerals = [];
      for (let n = 0; n < 10; n++) {
        const num = document.createElement('span');
        num.className = 'odo__numeral';
        num.textContent = String(n);
        strip.appendChild(num);
        numerals.push(num);
      }
      win.appendChild(strip);
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'odo__blur');
      svg.setAttribute('aria-hidden', 'true');
      const filter = document.createElementNS(svgNS, 'filter');
      filter.setAttribute('id', `${uid}-${i}`);
      filter.setAttribute('x', '-10%'); filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '120%'); filter.setAttribute('height', '200%');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      const blur = document.createElementNS(svgNS, 'feGaussianBlur');
      blur.setAttribute('stdDeviation', '0 0');
      filter.appendChild(blur); svg.appendChild(filter);
      tile.append(sizer, win, svg);
      root.appendChild(tile);
      items.push({ tile, strip, numerals, blur, filterId: `${uid}-${i}`, blurred: false, pos: 0, vel: 0, target: 0, shown: 1, shownVel: 0, shownTarget: 1, wait: 0, rank: count - 1 - i });
    }
    let raf = 0, last = 0, current = null;
    const em = () => parseFloat(getComputedStyle(root).fontSize) || 16;
    const paint = (item) => {
      item.numerals.forEach((num, n) => { num.style.transform = `translateY(${(wrap(n - item.pos) * 100).toFixed(3)}%)`; });
      const shown = Math.min(1, Math.max(0, item.shown));
      item.tile.style.setProperty('--shown', shown.toFixed(3));
      const radius = Math.min(0.09, Math.max(0, (Math.abs(item.vel) - 3) * 0.006)) * em();
      if (radius > 0.25) {
        item.blur.setAttribute('stdDeviation', `0 ${radius.toFixed(2)}`);
        if (!item.blurred) { item.strip.style.filter = `url(#${item.filterId})`; item.blurred = true; }
      } else if (item.blurred) { item.strip.style.filter = ''; item.blurred = false; }
    };
    const frame = (now) => {
      raf = 0;
      const elapsed = Math.min(1 / 20, Math.max(0, (now - last) / 1000));
      last = now;
      const omega = TAU / cfg.duration;
      const zeta = 1 - cfg.bounce;
      const presence = TAU / (cfg.duration * 0.85);
      let busy = false;
      items.forEach((item) => {
        let left = elapsed;
        if (item.wait > 0) { const used = Math.min(item.wait, left); item.wait -= used; left -= used; }
        if (left > 0) {
          const steps = Math.ceil(left * 240);
          const dt = left / steps;
          for (let k = 0; k < steps; k++) {
            item.vel += (-omega * omega * (item.pos - item.target) - 2 * zeta * omega * item.vel) * dt;
            item.pos += item.vel * dt;
            item.shownVel += (-presence * presence * (item.shown - item.shownTarget) - 2 * presence * item.shownVel) * dt;
            item.shown += item.shownVel * dt;
          }
        }
        const settled = item.wait <= 0 && Math.abs(item.pos - item.target) < 0.002 && Math.abs(item.vel) < 0.02
          && Math.abs(item.shown - item.shownTarget) < 0.002 && Math.abs(item.shownVel) < 0.02;
        if (settled) {
          item.target = mod(Math.round(item.target), 10); item.pos = item.target; item.vel = 0;
          item.shown = item.shownTarget; item.shownVel = 0;
        } else busy = true;
        paint(item);
      });
      if (busy) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); };
    const digitsOf = (value) => {
      const text = String(Math.max(0, Math.round(Math.abs(Number(value) || 0)))).slice(-count).padStart(count, '0');
      const firstSig = text.search(/[1-9]/);
      return [...text].map((ch, i) => ({ digit: Number(ch), visible: i >= (firstSig < 0 ? count - 1 : firstSig) }));
    };
    const set = (value, { instant = false } = {}) => {
      const next = digitsOf(value);
      const prev = current;
      current = Number(value);
      const trend = prev === null ? 'up' : current > prev ? 'up' : current < prev ? 'down' : 'shortest';
      const moving = [];
      items.forEach((item, i) => {
        const { digit, visible } = next[i];
        item.shownTarget = visible ? 1 : 0;
        if (instant || reduceMotion) {
          item.target = digit; item.pos = digit; item.vel = 0; item.shown = item.shownTarget; item.shownVel = 0;
          paint(item); return;
        }
        const from = mod(Math.round(item.target), 10);
        const up = mod(digit - from, 10);
        const step = trend === 'up' ? up : trend === 'down' ? (up === 0 ? 0 : up - 10) : (up > 5 ? up - 10 : up);
        item.target += step;
        moving.push(item);
      });
      moving.sort((a, b) => a.rank - b.rank).forEach((item, order) => { item.wait = order * cfg.stagger; });
      if (!instant && !reduceMotion) kick();
    };
    const spin = () => {
      if (reduceMotion) return;
      items.filter((item) => item.shownTarget > 0).sort((a, b) => a.rank - b.rank).forEach((item, order) => { item.target += 10; item.wait = order * cfg.stagger; });
      kick();
    };
    return { set, spin };
  };

  /* ---------- Temperature readout on the photo break ---------- */
  document.querySelectorAll('[data-readout]').forEach((card) => {
    const odoEl = card.querySelector('[data-odo]');
    const tabs = [...card.querySelectorAll('[data-readout-tab]')];
    if (!odoEl || !tabs.length) return;
    const unit = card.querySelector('[data-readout-unit]');
    const caption = card.querySelector('[data-readout-caption]');
    const sr = card.querySelector('[data-readout-sr]');
    const count = Math.max(1, Math.min(4, Number(odoEl.dataset.digits) || 2));
    const odo = createOdometer(odoEl, count);
    let index = 0, timer = 0, auto = !reduceMotion, visible = false;
    const HOLD = 3600;
    const show = (i, { instant = false } = {}) => {
      index = i;
      const tab = tabs[i];
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
        t.classList.remove('is-running');
      });
      card.classList.remove('readout--hot', 'readout--cold', 'readout--neutral');
      card.classList.add(`readout--${tab.dataset.tone || 'hot'}`);
      if (unit) unit.textContent = tab.dataset.unit || '';
      if (caption) {
        caption.classList.remove('is-swap'); void caption.offsetWidth;
        caption.textContent = tab.dataset.caption || '';
        caption.classList.add('is-swap');
      }
      if (sr) sr.textContent = `${tab.dataset.label}: ${tab.dataset.value}${tab.dataset.unit || ''}`;
      odo.set(tab.dataset.value, { instant });
      if (auto && visible) { void tab.offsetWidth; tab.classList.add('is-running'); }
    };
    const stop = () => { clearInterval(timer); timer = 0; tabs.forEach((t) => t.classList.remove('is-running')); };
    const start = () => {
      if (!auto || timer) return;
      tabs[index].classList.add('is-running');
      timer = setInterval(() => show((index + 1) % tabs.length), HOLD);
    };
    tabs.forEach((tab, i) => tab.addEventListener('click', () => { auto = false; stop(); show(i); }));
    card.addEventListener('pointerenter', () => { if (auto) stop(); });
    card.addEventListener('pointerleave', () => { if (auto && visible) start(); });
    card.addEventListener('focusin', () => { if (auto) stop(); });
    card.style.setProperty('--hold', `${HOLD}ms`);
    show(0, { instant: true });
    if (!('IntersectionObserver' in window)) { visible = true; start(); return; }
    let introduced = false;
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        card.classList.add('is-in');
        if (!introduced) { introduced = true; odo.spin(); }
        start();
      } else stop();
    }, { threshold: 0.4 }).observe(card);
  });

  /* ---------- FAQ page: smooth open/close and a live filter ---------- */
  document.querySelectorAll('[data-faq-item]').forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq-item__a');
    if (!summary || !answer || reduceMotion) return;
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (item.dataset.animating) return;
      item.dataset.animating = '1';
      const opening = !item.open;
      if (opening) item.open = true;
      const full = answer.scrollHeight;
      const anim = answer.animate(
        opening ? [{ height: '0px', opacity: 0 }, { height: `${full}px`, opacity: 1 }] : [{ height: `${full}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 280, easing: 'cubic-bezier(.2, .7, .2, 1)' }
      );
      anim.onfinish = () => { if (!opening) item.open = false; delete item.dataset.animating; };
    });
  });
  document.querySelectorAll('[data-faq-page]').forEach((page) => {
    const input = page.querySelector('[data-faq-filter]');
    const items = [...page.querySelectorAll('[data-faq-item]')];
    const topics = [...page.querySelectorAll('[data-faq-topic]')];
    const empty = page.querySelector('[data-faq-empty]');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      items.forEach((item) => {
        const hit = !q || item.textContent.toLowerCase().includes(q);
        item.hidden = !hit;
        if (hit) shown++;
        if (q && hit && !item.open) item.open = true;
        if (!q) item.open = false;
      });
      topics.forEach((topic) => {
        let next = topic.nextElementSibling, any = false;
        while (next && !next.matches('[data-faq-topic], [data-faq-empty]')) { if (!next.hidden) any = true; next = next.nextElementSibling; }
        topic.hidden = !any;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });

  /* ---------- 3D viewer on the product page (Shopify 3D models rendered with model-viewer) ---------- */
  const loadModelViewer = (done) => {
    if (window.customElements && customElements.get('model-viewer')) { done(true); return; }
    if (!(window.Shopify && typeof window.Shopify.loadFeatures === 'function')) { done(false); return; }
    window.Shopify.loadFeatures([{ name: 'model-viewer-ui', version: '1.0', onLoad: (errors) => done(!errors) }]);
  };
  const colorFromMaterials = (viewer, handles) => {
    const names = ((viewer.model && viewer.model.materials) || []).map((m) => String(m.name || '').toLowerCase());
    return handles.find((h) => names.some((n) => n.split(/[^a-z0-9]+/).includes(h))) || '';
  };
  document.querySelectorAll('[data-model3d]').forEach((panel) => {
    const stage = panel.closest('[data-product-stage]');
    const toggle = stage && stage.querySelector('[data-model3d-toggle]');
    if (!toggle) return;
    const handles = (panel.dataset.colors || '').split(',').filter(Boolean);
    const items = [...panel.querySelectorAll('[data-model-color]')];
    if (reduceMotion) panel.querySelectorAll('model-viewer').forEach((viewer) => viewer.removeAttribute('auto-rotate'));
    let requested = false;
    const detect = () => {
      items.forEach((item) => {
        if (item.dataset.modelColor) return;
        const viewer = item.querySelector('model-viewer');
        if (!viewer) { item.dataset.checked = '1'; return; }
        const done = () => {
          item.dataset.modelColor = colorFromMaterials(viewer, handles);
          item.dataset.checked = '1';
          pickModel(panel);
        };
        if (viewer.loaded) done();
        else {
          viewer.addEventListener('load', done, { once: true });
          viewer.addEventListener('error', () => { item.dataset.checked = '1'; pickModel(panel); }, { once: true });
          viewer.setAttribute('loading', 'eager');
          if (typeof viewer.dismissPoster === 'function') viewer.dismissPoster();
        }
      });
    };
    const show = (on) => {
      stage.classList.toggle('is-3d', on);
      panel.hidden = !on;
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      pickModel(panel);
      if (on && !requested) {
        requested = true;
        panel.classList.add('is-loading');
        loadModelViewer((ok) => {
          panel.classList.remove('is-loading');
          if (!ok) { show(false); toggle.hidden = true; return; }
          customElements.whenDefined('model-viewer').then(() => { detect(); pickModel(panel); });
        });
      }
    };
    toggle.addEventListener('click', () => show(panel.hidden));
  });

  const xrData = [...document.querySelectorAll('[data-model-json]')];
  if (xrData.length && window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
    const setupXR = () => {
      if (!window.ShopifyXR) { document.addEventListener('shopify_xr_initialized', setupXR, { once: true }); return; }
      xrData.forEach((el) => {
        try { window.ShopifyXR.addModels(JSON.parse(el.textContent)); } catch (e) { /* ignore bad JSON */ }
      });
      window.ShopifyXR.setupXRElements();
    };
    window.Shopify.loadFeatures([{ name: 'shopify-xr', version: '1.0', onLoad: (errors) => { if (!errors) setupXR(); } }]);
  }

  /* ---------- Click sparks on swatches and tiers (adapted from React Bits ClickSpark) ---------- */
  if (!reduceMotion) {
    let canvas = null;
    let ctx = null;
    const sparks = [];
    let raf = 0;
    const ensure = () => {
      if (canvas) return;
      canvas = document.createElement('canvas');
      canvas.className = 'spark-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      size();
      window.addEventListener('resize', size);
    };
    const draw = (now) => {
      raf = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const t = (now - s.start) / 420;
        if (t >= 1) { sparks.splice(i, 1); continue; }
        const eased = t * (2 - t);
        const distance = eased * 26;
        const length = 10 * (1 - eased);
        const x1 = s.x + distance * Math.cos(s.angle);
        const y1 = s.y + distance * Math.sin(s.angle);
        const x2 = s.x + (distance + length) * Math.cos(s.angle);
        const y2 = s.y + (distance + length) * Math.sin(s.angle);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      if (sparks.length) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('click', (event) => {
      const host = event.target.closest('[data-spark], [data-swatch]');
      if (!host) return;
      ensure();
      const color = getComputedStyle(host).getPropertyValue('--swatch').trim() || getComputedStyle(document.documentElement).getPropertyValue('--blaze').trim();
      const now = performance.now();
      for (let i = 0; i < 8; i++) sparks.push({ x: event.clientX, y: event.clientY, angle: (2 * Math.PI * i) / 8, start: now, color });
      if (!raf) raf = requestAnimationFrame(draw);
    });
  }

  /* ---------- Newsletter send animation (Uiverse.io, adamgiebl) ---------- */
  document.querySelectorAll('.newsletter__form').forEach((form) => {
    form.addEventListener('submit', () => form.querySelector('.send-btn')?.classList.add('is-sending'));
  });

  /* ---------- Giant footer word (adapted from React Bits TextPressure) ---------- */
  document.querySelectorAll('[data-text-pressure]').forEach((word) => {
    const chars = [...word.querySelectorAll('.footer-word__char')];
    if (!chars.length) return;
    const mouse = { x: 0, y: 0 };
    const cursor = { x: 0, y: 0 };
    let active = false;
    let raf = 0;
    let visible = false;
    const render = () => {
      raf = 0;
      cursor.x += (mouse.x - cursor.x) / 6;
      cursor.y += (mouse.y - cursor.y) / 6;
      const box = word.getBoundingClientRect();
      const maxDist = box.width / 2.2;
      chars.forEach((span) => {
        const r = span.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(cursor.x - cx, cursor.y - cy);
        const pressure = active ? Math.max(0, 1 - d / maxDist) : 0;
        const wdth = Math.round(75 + 50 * pressure);
        const wght = Math.round(650 + 250 * pressure);
        span.style.fontVariationSettings = `'wdth' ${wdth}, 'wght' ${wght}`;
      });
      if (visible && (active || Math.abs(mouse.x - cursor.x) > 0.5)) raf = requestAnimationFrame(render);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(render); };
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(word);
    window.addEventListener('pointermove', (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (!visible) return;
      const box = word.getBoundingClientRect();
      active = event.clientY > box.top - 200 && event.clientY < box.bottom + 80;
      wake();
    }, { passive: true });
  });

  /* ---------- Photo parallax: hero follows the cursor a little, photo sections drift on scroll ---------- */
  (() => {
    const hero = document.querySelector('[data-hero]');
    const heroPhoto = hero && hero.querySelector('[data-hero-photo]');
    const drifters = [...document.querySelectorAll('[data-photo-break-media]')];
    const breaks = [...document.querySelectorAll('[data-photo-break]')];
    if ('IntersectionObserver' in window) {
      const seen = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); seen.unobserve(entry.target); }
      }), { threshold: 0.25 });
      breaks.forEach((el) => seen.observe(el));
    } else {
      breaks.forEach((el) => el.classList.add('is-in'));
    }
    if (reduceMotion) return;
    const mouse = { x: 0, y: 0, cx: 0, cy: 0 };
    let raf = 0;
    const frame = () => {
      raf = 0;
      mouse.cx += (mouse.x - mouse.cx) * 0.06;
      mouse.cy += (mouse.y - mouse.cy) * 0.06;
      const vh = window.innerHeight;
      if (heroPhoto) {
        const rect = hero.getBoundingClientRect();
        if (rect.bottom > 0) {
          const scroll = Math.max(0, -rect.top);
          heroPhoto.style.transform = `translate3d(${(mouse.cx * -14).toFixed(2)}px, ${(mouse.cy * -10 + scroll * 0.28).toFixed(2)}px, 0)`;
        }
      }
      drifters.forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const progress = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height);
        el.style.transform = `translate3d(0, ${(progress * -18).toFixed(2)}%, 0)`;
      });
      if (Math.abs(mouse.x - mouse.cx) + Math.abs(mouse.y - mouse.cy) > 0.002) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    if (hero && window.matchMedia('(hover: hover)').matches) {
      hero.addEventListener('pointermove', (event) => {
        const rect = hero.getBoundingClientRect();
        mouse.x = (event.clientX - rect.left) / rect.width - 0.5;
        mouse.y = (event.clientY - rect.top) / rect.height - 0.5;
        wake();
      });
      hero.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; wake(); });
    }
    wake();
  })();

  /* ---------- Magic bento (adapted from React Bits MagicBento) ---------- */
  document.querySelectorAll('[data-bento]').forEach((grid) => {
    const cards = [...grid.querySelectorAll('.bento__card')];
    const spot = grid.querySelector('.bento__spotlight');
    const counters = [...grid.querySelectorAll('[data-count-to]')];
    const reveal = () => {
      grid.classList.add('is-in');
      if (reduceMotion) return;
      counters.forEach((el) => {
        const to = Number(el.dataset.countTo) || 0;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / 1600);
          el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { io.disconnect(); reveal(); } }, { threshold: 0.2 });
      io.observe(grid);
    } else {
      reveal();
    }
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    const PROXIMITY = 220;
    const TILT = 5;
    let raf = 0;
    let pointer = null;
    const frame = () => {
      raf = 0;
      if (!pointer) {
        cards.forEach((card) => { card.style.setProperty('--near', 0); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
        grid.style.setProperty('--spot', 0);
        return;
      }
      const g = grid.getBoundingClientRect();
      if (spot) {
        grid.style.setProperty('--sx', `${pointer.x - g.left}px`);
        grid.style.setProperty('--sy', `${pointer.y - g.top}px`);
        grid.style.setProperty('--spot', 1);
      }
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const dx = Math.max(r.left - pointer.x, 0, pointer.x - r.right);
        const dy = Math.max(r.top - pointer.y, 0, pointer.y - r.bottom);
        const near = Math.max(0, 1 - Math.hypot(dx, dy) / PROXIMITY);
        card.style.setProperty('--near', near.toFixed(3));
        card.style.setProperty('--mx', `${pointer.x - r.left}px`);
        card.style.setProperty('--my', `${pointer.y - r.top}px`);
        const inside = dx === 0 && dy === 0;
        const px = (pointer.x - r.left) / r.width - 0.5;
        const py = (pointer.y - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', inside ? `${(-py * TILT).toFixed(2)}deg` : '0deg');
        card.style.setProperty('--ry', inside ? `${(px * TILT).toFixed(2)}deg` : '0deg');
      });
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
    grid.addEventListener('pointermove', (event) => { pointer = { x: event.clientX, y: event.clientY }; wake(); });
    grid.addEventListener('pointerleave', () => { pointer = null; wake(); });
    window.addEventListener('scroll', () => { if (pointer) wake(); }, { passive: true });
    cards.forEach((card) => {
      card.addEventListener('click', (event) => {
        const r = card.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'bento__ripple';
        ripple.style.left = `${event.clientX - r.left}px`;
        ripple.style.top = `${event.clientY - r.top}px`;
        card.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  });
})();
