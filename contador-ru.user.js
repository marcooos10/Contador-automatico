// ==UserScript==
// @name         RU UFAC — Contador de refeições validadas
// @namespace    ru-ufac-contador
// @version      1.6.0
// @description  Contador auxiliar exclusivo do E-ticket UFAC para bolsistas autorizados do RU.
// @match        https://sistemas.ufac.br/eticket/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

// Uso exclusivo do E-ticket UFAC por bolsistas do RU com acesso autorizado.
// Este script não concede acesso nem substitui o sistema oficial.

(function () {
  'use strict';

  // As únicas três mensagens que geram +1.
  const SUCCESS_MESSAGES = [
    'Refeição validada com sucesso!',
    'Usuário gratuito, refeição validada sem desconto de crédito.',
    'Ticket validado com sucesso!'
  ];

  // Não alterar estas chaves: recuperam a contagem anterior.
  const STORAGE_KEY = 'ru_counter_state_v1';
  const BACKUP_KEY = 'ru_counter_state_backup_v1';

  // Preferências visuais independentes da contagem.
  const THEME_KEY = 'ru_counter_theme_v1';
  const CHRISTMAS_KEY = 'ru_counter_christmas_v1';
  const THEMES = ['dark', 'white', 'blue', 'pink', 'red'];

  function todayBR() {
    return new Intl.DateTimeFormat('pt-BR').format(new Date());
  }

  function defaultState() {
    return {
      total: 0,
      lastValidationAt: '',
      lastResult: 'none',
      sourceDate: todayBR(),
      lastSavedAt: ''
    };
  }

  function validState(value) {
    return value &&
      Number.isSafeInteger(value.total) &&
      value.total >= 0;
  }

  function loadState() {
    let local = null;
    let backup = null;

    try {
      local = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {}

    try {
      backup = GM_getValue(BACKUP_KEY, null);
    } catch (_) {}

    let chosen = null;
    if (validState(local) && validState(backup)) {
      const timeA = Date.parse(local.lastSavedAt || '') || 0;
      const timeB = Date.parse(backup.lastSavedAt || '') || 0;
      chosen = timeA >= timeB ? local : backup;
    } else if (validState(local)) {
      chosen = local;
    } else if (validState(backup)) {
      chosen = backup;
    }

    return { ...defaultState(), ...(chosen || {}) };
  }

  let state = loadState();

  function saveState() {
    state.lastSavedAt = new Date().toISOString();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('RU: falha ao salvar no navegador', error);
    }

    try {
      GM_setValue(BACKUP_KEY, JSON.parse(JSON.stringify(state)));
    } catch (error) {
      console.warn('RU: falha ao salvar no Tampermonkey', error);
    }
  }

  saveState();

  // =====================================================
  // PREFERÊNCIAS VISUAIS
  // =====================================================

  function loadPreferences() {
    let theme = 'dark';
    let christmas = false;
    try {
      theme = GM_getValue(THEME_KEY, 'dark');
      christmas = GM_getValue(CHRISTMAS_KEY, false) === true;
    } catch (_) {}
    return {
      theme: THEMES.includes(theme) ? theme : 'dark',
      christmas
    };
  }

  const preferences = loadPreferences();

  function applyPreferences() {
    const widget = document.getElementById('ru-counter-widget');
    if (!widget) return;

    widget.dataset.ruTheme = preferences.theme;
    widget.classList.toggle('ru-christmas-on', preferences.christmas);

    widget.querySelectorAll('[data-theme-choice]').forEach(button => {
      const active = button.dataset.themeChoice === preferences.theme;
      button.classList.toggle('ru-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const santaButton = widget.querySelector('#ru-christmas-toggle');
    if (santaButton) {
      santaButton.classList.toggle('ru-selected', preferences.christmas);
      santaButton.setAttribute('aria-pressed', String(preferences.christmas));
      santaButton.title = preferences.christmas
        ? 'Desativar decoração de Natal'
        : 'Ativar decoração de Natal';
    }
  }

  function selectTheme(theme) {
    if (!THEMES.includes(theme)) return;
    preferences.theme = theme;
    try { GM_setValue(THEME_KEY, theme); } catch (_) {}
    applyPreferences();
  }

  function toggleChristmas() {
    preferences.christmas = !preferences.christmas;
    try { GM_setValue(CHRISTMAS_KEY, preferences.christmas); } catch (_) {}
    applyPreferences();
  }

  // =====================================================
  // AVISOS DO E-TICKET
  // =====================================================

  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function textOfAlert(alert) {
    const copy = alert.cloneNode(true);
    copy.querySelectorAll(
      'button, .btn-close, .close, [data-bs-dismiss]'
    ).forEach(node => node.remove());
    return normalize(copy.textContent);
  }

  function readTicketAlerts() {
    const box = document.getElementById('message-box');
    if (!box) return { kind: 'none', message: '' };

    const alerts = [...box.querySelectorAll('.alert, [role="alert"]')]
      .filter(el => !(
        el.classList.contains('fade') &&
        !el.classList.contains('show')
      ));

    if (!alerts.length) return { kind: 'none', message: '' };

    // Verde conhecido tem prioridade sobre qualquer outro aviso.
    for (const alert of alerts) {
      const text = textOfAlert(alert);
      if (
        alert.classList.contains('alert-success') &&
        SUCCESS_MESSAGES.some(message => normalize(message) === text)
      ) {
        return { kind: 'success', message: text };
      }
    }

    return { kind: 'error', message: '' };
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleTimeString('pt-BR');
  }

  // =====================================================
  // PAINEL DO CONTADOR
  // =====================================================

  function createWidget() {
    if (document.getElementById('ru-counter-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'ru-counter-widget';

    widget.innerHTML = `
      <div class="ru-christmas-decoration" aria-hidden="true">🎄🎅</div>

      <div class="ru-head">
        <div class="ru-heading">
          <div class="ru-title">🍽️ VALIDADOS</div>
          <div class="ru-subtitle">contador local</div>
        </div>

        <div class="ru-top-right">
          <div class="ru-theme-picker" role="group" aria-label="Tema do contador">
            <button type="button" class="ru-theme-dot ru-dot-dark"
              data-theme-choice="dark" title="Padrão escuro" aria-label="Tema padrão escuro"></button>
            <button type="button" class="ru-theme-dot ru-dot-white"
              data-theme-choice="white" title="Branco gelo" aria-label="Tema branco"></button>
            <button type="button" class="ru-theme-dot ru-dot-blue"
              data-theme-choice="blue" title="Azul suave" aria-label="Tema azul"></button>
            <button type="button" class="ru-theme-dot ru-dot-pink"
              data-theme-choice="pink" title="Rosa pastel" aria-label="Tema rosa"></button>
            <button type="button" class="ru-theme-dot ru-dot-red"
              data-theme-choice="red" title="Vermelho coral" aria-label="Tema vermelho"></button>
            <button type="button" id="ru-christmas-toggle"
              class="ru-santa-dot" title="Ativar decoração de Natal"
              aria-label="Ativar ou desativar decoração de Natal">🎅</button>
          </div>
          <span class="ru-storage">● LOCAL</span>
        </div>
      </div>

      <div id="ru-total" class="ru-total">0</div>

      <div class="ru-row">
        <span>Último validado:</span>
        <strong id="ru-last">—</strong>
      </div>

      <div id="ru-result" class="ru-result ru-neutral">
        <span id="ru-result-icon" class="ru-result-icon">⏳</span>
        <span id="ru-result-text">Aguardando validação</span>
      </div>

      <div id="ru-status" class="ru-status">● Contagem salva localmente</div>

      <div class="ru-correction-label">CORREÇÃO MANUAL</div>
      <div class="ru-corrections">
        <button id="ru-minus" type="button">−1</button>
        <button id="ru-plus" type="button">+1</button>
      </div>
      <div class="ru-actions">
        <button id="ru-reset" type="button">Zerar</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #ru-counter-widget {
        --ru-bg: #202328;
        --ru-text: #ffffff;
        --ru-secondary: #bdc2ca;
        --ru-border: #35383f;
        --ru-neutral-bg: #353941;
        --ru-neutral-border: #555963;
        --ru-button-bg: #ffffff;
        --ru-button-text: #25282c;
        --ru-reset-bg: #4b4b4b;
        --ru-reset-text: #ffffff;
        --ru-success-bg: rgba(34,197,94,.18);
        --ru-success-border: rgba(34,197,94,.4);
        --ru-success-text: #86efac;
        --ru-error-bg: rgba(239,68,68,.18);
        --ru-error-border: rgba(239,68,68,.4);
        --ru-error-text: #fca5a5;

        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: 255px;
        padding: 14px;
        box-sizing: border-box;
        border: 1px solid var(--ru-border);
        border-radius: 16px;
        background: var(--ru-bg);
        color: var(--ru-text);
        box-shadow: 0 10px 35px rgba(0,0,0,.3);
        font-family: system-ui, Arial, sans-serif;
        font-size: 13px;
        user-select: none;
        overflow: visible;
      }

      #ru-counter-widget[data-ru-theme="white"] {
        --ru-bg: #f1f2f5;
        --ru-text: #272b32;
        --ru-secondary: #606974;
        --ru-border: #d5d9e0;
        --ru-neutral-bg: #e2e6eb;
        --ru-neutral-border: #cfd5dc;
        --ru-button-bg: #ffffff;
        --ru-button-text: #272b32;
        --ru-reset-bg: #dce0e5;
        --ru-reset-text: #30343a;
        --ru-success-bg: #dcefe4;
        --ru-success-border: #add9bc;
        --ru-success-text: #236f44;
        --ru-error-bg: #f9e1e3;
        --ru-error-border: #edb8c0;
        --ru-error-text: #9e3541;
      }

      #ru-counter-widget[data-ru-theme="blue"] {
        --ru-bg: #354f72;
        --ru-text: #ffffff;
        --ru-secondary: #d7e3ef;
        --ru-border: #607b9b;
        --ru-neutral-bg: #486483;
        --ru-neutral-border: #708ba9;
        --ru-reset-bg: #2c405e;
      }

      #ru-counter-widget[data-ru-theme="pink"] {
        --ru-bg: #a76d96;
        --ru-text: #ffffff;
        --ru-secondary: #f6e2f0;
        --ru-border: #c99fbd;
        --ru-neutral-bg: #875875;
        --ru-neutral-border: #d6accb;
        --ru-reset-bg: #82536f;
      }

      #ru-counter-widget[data-ru-theme="red"] {
        --ru-bg: #b25760;
        --ru-text: #ffffff;
        --ru-secondary: #ffe3e5;
        --ru-border: #d58b91;
        --ru-neutral-bg: #934750;
        --ru-neutral-border: #d8979d;
        --ru-reset-bg: #7d424a;
      }

      #ru-counter-widget * { box-sizing: border-box; }

      #ru-counter-widget .ru-christmas-decoration {
        display: none;
        position: absolute;
        bottom: calc(100% - 3px);
        left: 50%;
        transform: translateX(-50%);
        font-size: 27px;
        line-height: 1.15;
        white-space: nowrap;
        pointer-events: none;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,.22));
      }
      #ru-counter-widget.ru-christmas-on .ru-christmas-decoration {
        display: block;
      }

      #ru-counter-widget .ru-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 6px;
      }
      #ru-counter-widget .ru-heading { min-width: 0; }
      #ru-counter-widget .ru-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
        white-space: nowrap;
      }
      #ru-counter-widget .ru-subtitle {
        margin-top: 4px;
        color: var(--ru-secondary);
        font-size: 11px;
      }
      #ru-counter-widget .ru-top-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
        flex-shrink: 0;
      }
      #ru-counter-widget .ru-theme-picker {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 23px;
      }
      #ru-counter-widget .ru-storage {
        color: #9ce8b0;
        font-weight: 700;
        font-size: 10px;
      }
      #ru-counter-widget[data-ru-theme="white"] .ru-storage {
        color: #267d4a;
      }

      #ru-counter-widget button {
        border: 0;
        border-radius: 9px;
        padding: 9px 10px;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        background: var(--ru-button-bg);
        color: var(--ru-button-text);
      }
      #ru-counter-widget button:hover { filter: brightness(.94); }
      #ru-counter-widget button:active { transform: scale(.97); }
      #ru-counter-widget button:disabled {
        opacity: .4;
        cursor: not-allowed;
      }
      #ru-counter-widget button:focus-visible {
        outline: 2px solid var(--ru-text);
        outline-offset: 2px;
      }
      #ru-counter-widget button.ru-theme-dot {
        flex: 0 0 12px;
        width: 12px;
        height: 12px;
        padding: 0;
        border: 1px solid rgba(100,100,100,.55);
        border-radius: 50%;
      }
      #ru-counter-widget .ru-dot-dark { background: #41454e; }
      #ru-counter-widget .ru-dot-white { background: #f1f2f5; }
      #ru-counter-widget .ru-dot-blue { background: #729ec8; }
      #ru-counter-widget .ru-dot-pink { background: #e8a5cf; }
      #ru-counter-widget .ru-dot-red { background: #de8590; }

      #ru-counter-widget button.ru-santa-dot {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 22px;
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 50%;
        background: var(--ru-neutral-bg);
        color: var(--ru-text);
        font-size: 13px;
        line-height: 1;
        border: 1px solid var(--ru-neutral-border);
      }
      #ru-counter-widget button.ru-selected {
        outline: 2px solid var(--ru-text);
        outline-offset: 2px;
      }

      #ru-counter-widget .ru-total {
        font-size: 56px;
        line-height: 1;
        font-weight: 800;
        text-align: center;
        padding: 14px 0 12px;
        font-variant-numeric: tabular-nums;
      }
      #ru-counter-widget .ru-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: var(--ru-text);
        margin-bottom: 12px;
      }
      #ru-counter-widget .ru-result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 44px;
        padding: 9px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
      }
      #ru-counter-widget .ru-result-icon {
        font-size: 25px;
        line-height: 1;
      }
      #ru-counter-widget .ru-success {
        background: var(--ru-success-bg);
        color: var(--ru-success-text);
        border: 1px solid var(--ru-success-border);
      }
      #ru-counter-widget .ru-error {
        background: var(--ru-error-bg);
        color: var(--ru-error-text);
        border: 1px solid var(--ru-error-border);
      }
      #ru-counter-widget .ru-neutral {
        background: var(--ru-neutral-bg);
        color: var(--ru-text);
        border: 1px solid var(--ru-neutral-border);
      }
      #ru-counter-widget .ru-status {
        margin-top: 8px;
        color: var(--ru-secondary);
        font-size: 11px;
        text-align: center;
        min-height: 16px;
      }
      #ru-counter-widget .ru-correction-label {
        margin: 13px 0 7px;
        color: var(--ru-secondary);
        font-size: 10px;
        text-align: center;
        letter-spacing: .08em;
      }
      #ru-counter-widget .ru-corrections {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      #ru-counter-widget .ru-corrections button { font-size: 19px; }
      #ru-counter-widget .ru-actions { margin-top: 8px; }
      #ru-counter-widget #ru-reset {
        width: 100%;
        background: var(--ru-reset-bg);
        color: var(--ru-reset-text);
      }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(widget);

    widget.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        selectTheme(button.dataset.themeChoice);
      });
    });
    document.getElementById('ru-christmas-toggle')
      .addEventListener('click', toggleChristmas);
    document.getElementById('ru-minus')
      .addEventListener('click', () => adjustCounter(-1));
    document.getElementById('ru-plus')
      .addEventListener('click', () => adjustCounter(1));
    document.getElementById('ru-reset')
      .addEventListener('click', resetCounter);

    applyPreferences();
  }

  function renderWidget(statusText) {
    createWidget();

    document.getElementById('ru-total').textContent =
      state.total.toLocaleString('pt-BR');
    document.getElementById('ru-last').textContent =
      formatTime(state.lastValidationAt);
    document.getElementById('ru-minus').disabled = state.total <= 0;

    const result = document.getElementById('ru-result');
    const icon = document.getElementById('ru-result-icon');
    const text = document.getElementById('ru-result-text');

    result.classList.remove('ru-success', 'ru-error', 'ru-neutral');
    if (state.lastResult === 'success') {
      result.classList.add('ru-success');
      icon.textContent = '✅';
      text.textContent = 'Validada com sucesso';
    } else if (state.lastResult === 'error') {
      result.classList.add('ru-error');
      icon.textContent = '❌';
      text.textContent = 'Aviso do E-ticket';
    } else {
      result.classList.add('ru-neutral');
      icon.textContent = '⏳';
      text.textContent = 'Aguardando validação';
    }

    if (statusText) {
      document.getElementById('ru-status').textContent = statusText;
    }
  }

  // =====================================================
  // CONTAGEM E CORREÇÃO
  // =====================================================

  function countValidation() {
    state.total += 1;
    state.lastValidationAt = new Date().toISOString();
    state.lastResult = 'success';
    state.sourceDate = todayBR();
    saveState();
    renderWidget('● +1 validação • salvo no PC');
  }

  function markError() {
    // Um aviso não reconhecido como sucesso nunca soma nem subtrai.
    state.lastResult = 'error';
    saveState();
    renderWidget('● Aviso detectado • não contabilizado');
  }

  function adjustCounter(delta) {
    if (delta < 0 && state.total === 0) return;
    state.total = Math.max(0, state.total + delta);
    state.sourceDate = todayBR();
    saveState();
    renderWidget(delta > 0
      ? '● Correção manual +1 salva'
      : '● Correção manual −1 salva');
  }

  function resetCounter() {
    const ok = confirm(
      `Zerar a contagem de ${state.total.toLocaleString('pt-BR')} refeições?`
    );
    if (!ok) return;

    state.total = 0;
    state.lastValidationAt = '';
    state.lastResult = 'none';
    state.sourceDate = todayBR();
    saveState();
    renderWidget('● Contagem zerada e salva');
  }

  // =====================================================
  // DETECÇÃO: MESMA LÓGICA DA VERSÃO 1.5.1
  // =====================================================

  function getNavigationType() {
    try {
      const items = performance.getEntriesByType('navigation');
      if (items.length) return items[0].type;
    } catch (_) {}

    try {
      if (performance.navigation?.type === 1) return 'reload';
      if (performance.navigation?.type === 2) return 'back_forward';
    } catch (_) {}
    return 'navigate';
  }

  let previousKind = 'none';
  let groupHadSuccess = false;

  function checkAlerts() {
    const current = readTicketAlerts();

    if (current.kind === 'none') {
      previousKind = 'none';
      groupHadSuccess = false;
      return;
    }

    // Se verde e vermelho coexistirem, prevalece o verde.
    if (current.kind === 'success') {
      if (!groupHadSuccess) countValidation();
      groupHadSuccess = true;
      previousKind = 'success';
      return;
    }

    // Após uma confirmação verde, vermelho da mesma sequência
    // não remove o check nem altera a contagem.
    if (groupHadSuccess) return;

    if (previousKind !== 'error') markError();
    previousKind = 'error';
  }

  function init() {
    createWidget();
    renderWidget('● Contagem local ativa');

    const initial = readTicketAlerts();
    previousKind = initial.kind;
    groupHadSuccess = initial.kind === 'success';

    const navigationType = getNavigationType();

    // Verde numa navegação nova: +1.
    // F5 ou Voltar com verde já presente: não repete +1.
    if (initial.kind === 'success') {
      if (navigationType === 'navigate') {
        countValidation();
      } else {
        state.lastResult = 'success';
        saveState();
        renderWidget('● Confirmação já exibida • sem novo +1');
      }
    } else if (initial.kind === 'error') {
      markError();
    }

    // Não lê a rede nem intervém na validação do E-ticket.
    const observer = new MutationObserver(checkAlerts);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    window.addEventListener('pageshow', checkAlerts);
    window.addEventListener('popstate', checkAlerts);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
