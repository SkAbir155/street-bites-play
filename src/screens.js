// The screens around the game, built from ordinary web-page elements on top
// of the game picture (see screens.css):
//   studio logo -> main menu (Play / Load / New game / Quit) -> loading -> game
//   and, at the end of each day: the day's report -> the shop.

const SPLASH_TIME = 2600;   // the studio logo stays at least this long (ms)
const LOADING_TIME = 5000;  // the loading screen before a game starts (ms)
const QUICK_LOADING_TIME = 1200; // ...when the restaurant is only being rebuilt after shopping
const LOADING_TIPS = [
  'Take the order, ring the bell, serve it hot.',
  'Bring the food quickly and customers leave a tip.',
  'Clear dirty tables: nobody likes sitting in a mess.',
  'Never throw away food that someone is still waiting for.',
  'Spend your tips in the shop at the end of the day.',
];

const Screens = {
  // ---------- small helpers ----------

  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  },

  // Show one screen (by id) and hide the rest; no id hides them all.
  show(id) {
    for (const s of this.root.children) s.classList.toggle('on', s.id === id);
    // (while arranging, taps go through to the restaurant, except on its bar and panel)
    this.root.style.pointerEvents = id && id !== 'arrange' ? 'auto' : 'none';
  },

  // A picture file from assets/, with the build number so updates show at once.
  art(key) {
    const version = window.BUILD && window.BUILD !== 'dev' ? `?v=${window.BUILD}` : '';
    return ART_FILES[key] + version;
  },

  click(sound = 'ready') {
    if (this.game && this.game.sfx) this.game.sfx.play(sound);
  },

  // ---------- start-up ----------

  init(game) {
    this.game = game;
    this.root = document.getElementById('screens');
    this.root.append(
      this.el(`<section class="screen" id="splash">
        <div class="logo">Abir<i>'</i>s</div><div class="logo-sub">PRODUCTION</div>
        <div class="bar"><i></i></div></section>`),
      this.el(`<section class="screen" id="menu"><div class="backdrop"></div>
        <button class="profile-chip" data-act="profile"></button>
        <h1 class="title">STREET <b>BITES</b></h1>
        <div class="menu-buttons">
          <button class="btn play" data-act="play">▶ PLAY<small></small></button>
          <button class="btn plain" data-act="load">LOAD</button>
          <button class="btn plain" data-act="new">NEW GAME</button>
          <button class="btn plain" data-act="account">👤 PROFILE &amp; SYNC</button>
          <button class="btn plain" data-act="help">❓ HOW TO PLAY</button>
          <button class="btn plain wide" data-act="quit">QUIT</button>
        </div>
        <div class="corner"></div></section>`),
      this.el(`<section class="screen dim" id="slots"><div class="wood">
        <h2></h2><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen" id="loading">
        <h1 class="title"></h1><div class="foods"></div>
        <div class="bar"><i></i></div><div class="tip"></div></section>`),
      this.el(`<section class="screen dim" id="report"><div class="wood">
        <h2></h2><div class="paper"></div>
        <div class="foot"><button class="btn" data-act="next">CONTINUE ▶</button></div></div></section>`),
      this.el(`<section class="screen dim" id="hub"><div class="wood">
        <h2></h2><div class="purse"></div><div class="paper"></div>
        <div class="foot"><button class="btn" data-act="go"></button></div></div></section>`),
      this.el(`<section class="screen dim" id="shop"><div class="wood">
        <h2>SHOP</h2><div class="purse"></div>
        <div class="tabs">${SHOP_TABS.map(([tab, label]) => `<button class="btn plain" data-tab="${tab}">${label}</button>`).join('')}</div>
        <div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen dim" id="market"><div class="wood">
        <h2></h2><div class="purse"></div><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="plan"></button>
        <button class="btn" data-act="buy"></button></div></div></section>`),
      this.el(`<section class="screen" id="arrange">
        <div class="arrange-bar"><span></span><button class="btn plain" data-act="cancel">✖ CANCEL</button>
        <button class="btn" data-act="done">✓ DONE</button></div>
        <div class="picker wood"><h2></h2><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="close">CLOSE</button></div></div></section>`),
      this.el(`<section class="screen dim" id="stats"><div class="wood">
        <h2></h2><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen" id="welcome"><div class="wood">
        <h2>WELCOME!</h2><div class="paper"></div>
        <div class="foot"><button class="btn" data-act="create">CREATE MY PROFILE ▶</button></div></div></section>`),
      this.el(`<section class="screen dim" id="help"><div class="wood">
        <h2>HOW TO PLAY</h2><div class="paper"></div>
        <div class="foot"><button class="btn" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen dim" id="staff"><div class="wood">
        <h2>👥 STAFF &amp; PAY</h2><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen dim" id="account"><div class="wood">
        <h2>👤 PROFILE &amp; SYNC</h2><div class="paper"></div>
        <div class="foot"><button class="btn plain" data-act="back">◀ BACK</button></div></div></section>`),
      this.el(`<section class="screen" id="bye" style="background:#0d0b09">
        <p>Thanks for playing!<br>You can close this page now.</p>
        <button class="btn plain" data-act="back">◀ BACK TO THE MENU</button></section>`),
    );
    const on = (sel, fn) => this.root.querySelector(sel).addEventListener('click', fn);
    on('#menu [data-act=play]', () => { const slot = SaveGame.last(); this.click('bell'); this.startGame(slot || 1, !slot); });
    on('#menu [data-act=load]', () => { this.click(); this.showSlots('load'); });
    on('#menu [data-act=new]', () => { this.click(); this.showSlots('new'); });
    on('#menu [data-act=quit]', () => { this.click(); this.quit(); });
    on('#menu [data-act=account]', () => { this.click(); this.showAccount(); });
    on('#menu [data-act=profile]', () => { this.click(); if (Profile.get()) this.showAccount(); else this.showWelcome(); });
    on('#menu [data-act=help]', () => { this.click(); this.showHelp(); });
    on('#help [data-act=back]', () => { this.click(); this.showMenu(); });
    on('#staff [data-act=back]', () => { this.click(); this.backToHub(); });
    on('#account [data-act=back]', () => { if (!this.cloudBusy) { this.click(); this.showMenu(); } });
    on('#slots [data-act=back]', () => { this.click(); this.showMenu(); });
    on('#stats [data-act=back]', () => { this.click(); this.backToHub(); });
    on('#bye [data-act=back]', () => { this.click(); this.showMenu(); });
    on('#report [data-act=next]', () => {
      this.click();
      if (this.reportFromHub) { this.reportFromHub = false; return this.backToHub(); } // looked at again from the night screen
      this.onNext();
    });
    on('#hub [data-act=go]', () => this.leaveHub());
    on('#shop [data-act=back]', () => { this.click(); this.backToHub(); });
    on('#market [data-act=plan]', () => { this.click(); this.planIngredients(); this.drawMarket(); });
    on('#market [data-act=buy]', () => this.buyIngredients());
    on('#arrange [data-act=cancel]', () => { this.click(); Arrange.finish(false); });
    on('#arrange [data-act=done]', () => { this.click('bell'); Arrange.finish(true); });
    on('#arrange [data-act=close]', () => { this.click(); Arrange.closePicker(); });
    for (const tab of this.root.querySelectorAll('#shop [data-tab]')) {
      tab.addEventListener('click', () => { this.click(); this.showShop(tab.dataset.tab); });
    }

    // Coming back from the shop with new furniture, or from the pause panel's
    // "Main menu": skip the studio logo.
    const take = (key) => { try { const v = sessionStorage.getItem(key); sessionStorage.removeItem(key); return v; } catch (e) { return null; } };
    this.autostart = Number(take('sb.autostart')) || 0;
    this.autoOpen = !!take('sb.autoopen'); // rebuilt on the way to opening: open as soon as it's back
    this.skipSplash = !!take('sb.menu') || !!this.autostart;
    this.started = performance.now();
    this.show(this.skipSplash ? null : 'splash');
    if (this.autostart) this.showLoading(QUICK_LOADING_TIME);
  },

  // Loading the pictures: 0..1.
  progress(value) {
    this.root.querySelector('#splash .bar i').style.width = `${Math.round(value * 100)}%`;
  },

  // Every picture is loaded: after the logo has had its time, on to the menu.
  assetsLoaded() {
    this.progress(1);
    if (this.autostart) return this.startGame(this.autostart, false, QUICK_LOADING_TIME);
    const wait = this.skipSplash ? 0 : Math.max(0, SPLASH_TIME - (performance.now() - this.started));
    setTimeout(() => this.showMenu(), wait);
  },

  // ---------- main menu and save slots ----------

  showMenu() {
    if (!Profile.get()) return this.showWelcome(); // the very first time: make a profile first
    this.drawProfileChip();
    const slot = SaveGame.last(), save = slot && SaveGame.get(slot);
    this.root.querySelector('#menu .play small').textContent = save ? `Continue ${save.name || ''}  ·  Day ${save.day}` : 'Start a new game';
    this.root.querySelector('#menu .corner').textContent = `build ${window.BUILD || 'dev'}  ·  Abir's`;
    this.show('menu');
  },

  // The three save slots: `mode` is 'load' (pick a saved game) or 'new' (pick where the new game goes).
  // Each slot can also be renamed or deleted.
  showSlots(mode) {
    this.slotMode = mode;
    this.root.querySelector('#slots h2').textContent = mode === 'load' ? 'LOAD A SAVED GAME' : 'NEW GAME: CHOOSE A SLOT';
    const list = this.root.querySelector('#slots .paper');
    list.innerHTML = '';
    for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
      const save = SaveGame.get(slot);
      const when = save && save.savedAt ? new Date(save.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
      const row = this.el(`<div class="slot ${save ? '' : 'empty'}"><b>SLOT ${slot}</b><span></span><div class="slot-tools"></div></div>`);
      const text = row.querySelector('span'), tools = row.querySelector('.slot-tools');
      text.innerHTML = save
        ? `${this.escape(save.name || 'Unnamed restaurant')}<small>Day ${save.day}  ·  Restaurant $${save.money}  ·  Wallet $${save.wallet}${when ? `  ·  saved ${when}` : ''}</small>`
        : (mode === 'load' ? 'Empty' : 'Empty: start here');
      if (save) {
        const rename = this.el('<button class="btn plain">RENAME</button>');
        const del = this.el('<button class="btn plain">DELETE</button>');
        rename.addEventListener('click', (e) => { e.stopPropagation(); this.click(); this.nameSlot(row, slot, 'rename'); });
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!del.classList.contains('warn')) { this.click(); del.classList.add('warn'); del.textContent = 'TAP AGAIN TO DELETE'; return; }
          this.click('trash');
          SaveGame.remove(slot);
          this.showSlots(mode);
        });
        tools.append(rename, del);
      }
      text.addEventListener('click', () => {
        if (mode === 'load') {
          if (!save) return;
          this.click('bell');
          return this.startGame(slot, false);
        }
        if (save && !row.classList.contains('warn')) { // a second tap is needed to wipe a save
          this.click();
          row.classList.add('warn');
          text.innerHTML = `Tap again to erase "${this.escape(save.name || 'this game')}" (Day ${save.day}) and start over`;
          return;
        }
        this.click();
        this.nameSlot(row, slot, 'new');
      });
      list.append(row);
    }
    this.show('slots');
  },

  // Asks for a restaurant's name inside a slot's row: for a new game, or to rename one.
  nameSlot(row, slot, why) {
    const save = SaveGame.get(slot);
    row.classList.remove('warn');
    row.innerHTML = `<b>SLOT ${slot}</b><span><label>${why === 'new' ? 'Name your restaurant' : 'New name'}
      <input type="text" maxlength="28" spellcheck="false"></label></span>
      <div class="slot-tools"><button class="btn">${why === 'new' ? 'START ▶' : 'SAVE'}</button></div>`;
    const input = row.querySelector('input');
    input.value = why === 'new' ? 'My Restaurant' : (save && save.name) || '';
    input.focus();
    input.select();
    const done = () => {
      const name = input.value.trim().slice(0, 28) || 'My Restaurant';
      if (why === 'new') { this.click('bell'); return this.startGame(slot, true, name); }
      this.click('coin');
      SaveGame.rename(slot, name);
      this.showSlots(this.slotMode);
    };
    row.querySelector('button').addEventListener('click', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  },

  // Text typed by the player, made safe to show inside the page.
  escape(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  },

  // ---------- account and cloud sync ----------

  // Signed out: email and password, REGISTER or SIGN IN. Signed in: SYNC NOW and SIGN OUT.
  // `message` is shown at the top, e.g. the result of the last sync.
  showAccount(message = '', isError = false) {
    const box = this.root.querySelector('#account .paper');
    const session = Cloud.session();
    const note = message ? `<p class="cloud-msg ${isError ? 'bad' : ''}">${message}</p>` : '';
    const profileBlock = () => {
      const p = Profile.get();
      const block = this.el(`<div class="profile-block">${this.avatar(p.avatar, 'big')}
        <div class="profile-info"><label class="field">Profile name<input type="text" maxlength="20" spellcheck="false" value="${this.escape(p.name)}"></label>
        <div class="user-id">User ID: <b>${p.id}</b> <button class="btn plain small" data-p="copy">COPY</button></div>
        <small>Send your User ID to a friend to play together (multiplayer is coming).</small></div>
        <div class="profile-tools"><button class="btn plain small" data-p="avatar">CHANGE PICTURE</button></div></div>`);
      const name = block.querySelector('input');
      name.addEventListener('change', () => {
        const v = name.value.trim().slice(0, 20);
        if (v) { Profile.save({ ...Profile.get(), name: v }); this.click('coin'); }
      });
      block.querySelector('[data-p=copy]').addEventListener('click', (e) => {
        const b = e.target, done = () => { b.textContent = 'COPIED ✓'; this.click('coin'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p.id).then(done, () => { b.textContent = 'SELECT IT'; });
        else b.textContent = 'SELECT IT';
      });
      block.querySelector('[data-p=avatar]').addEventListener('click', () => {
        this.click();
        const picker = this.avatarPicker(p.avatar, a => { Profile.save({ ...Profile.get(), avatar: a }); this.showAccount('Picture changed.'); });
        block.after(picker);
      });
      return block;
    };
    if (!session) {
      box.innerHTML = `${note}
        <p class="note">An account keeps your saved games in the cloud, so you can carry on
        on another phone or computer. Only ${CLOUD.maxPlayers} players can join while the game is being tested.</p>
        <label>Email<input type="email" id="cloud-email" autocomplete="email" spellcheck="false"></label>
        <label>Password (at least 6 characters)<input type="password" id="cloud-pass" autocomplete="current-password"></label>
        <div class="foot"><button class="btn" data-cloud="signin">SIGN IN</button>
        <button class="btn plain" data-cloud="register">REGISTER</button></div>`;
      box.prepend(profileBlock(), this.el('<h3>ACCOUNT (EMAIL)</h3>'));
      const email = box.querySelector('#cloud-email'), pass = box.querySelector('#cloud-pass');
      email.value = this.lastEmail || '';
      const go = (fn, busyText) => this.cloudTask(busyText, async () => {
        this.lastEmail = email.value.trim();
        const seat = await fn(email.value.trim(), pass.value);
        return [`Welcome! You are player ${seat} of ${CLOUD.maxPlayers}. Press SYNC NOW to copy your saves to the cloud.`];
      });
      box.querySelector('[data-cloud=signin]').addEventListener('click', () => go((e, p) => Cloud.signIn(e, p), 'Signing in...'));
      box.querySelector('[data-cloud=register]').addEventListener('click', () => go((e, p) => Cloud.register(e, p), 'Registering...'));
    } else {
      box.innerHTML = `${note}
        <p>Signed in as <b>${session.email}</b>${session.seat ? ` (player ${session.seat} of ${CLOUD.maxPlayers})` : ''}.</p>
        <p class="note">SYNC NOW brings this device and the cloud level. Each device remembers what it last
        synced: a slot changed on only one side is copied to the other; if a slot was played on both,
        you choose which to keep. Sync after playing, before you switch devices.</p>
        <div class="foot"><button class="btn" data-cloud="sync">☁ SYNC NOW</button>
        <button class="btn plain" data-cloud="signout">SIGN OUT</button></div>
        <p class="note">Your profile is linked to this email account and syncs with your saves.</p>
        ${Cloud.backup() ? `<p class="note">Before the sync on ${new Date(Cloud.backup().at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })},
        this device's saves were backed up. <button class="btn plain small" data-cloud="restore">RESTORE THEM</button></p>` : ''}`;
      box.prepend(profileBlock(), this.el('<h3>ACCOUNT (EMAIL)</h3>'));
      box.querySelector('[data-cloud=sync]').addEventListener('click', () => this.runSync({}));
      const restore = box.querySelector('[data-cloud=restore]');
      if (restore) {
        restore.addEventListener('click', () => {
          if (!restore.classList.contains('warn')) { this.click(); restore.classList.add('warn'); restore.textContent = 'TAP AGAIN: PUT THEM BACK ON THIS DEVICE'; return; }
          this.click('coin');
          Cloud.restoreBackup();
          this.showAccount('The backed-up saves are back on this device. Press SYNC NOW to send them to the cloud.');
        });
      }
      box.querySelector('[data-cloud=signout]').addEventListener('click', () => {
        this.click();
        Cloud.signOut();
        this.showAccount('Signed out. Your saves stay on this device.');
      });
    }
    this.show('account');
  },

  // Syncs; if a slot was played on both this device and elsewhere, asks which to keep, then syncs again.
  runSync(choices) {
    this.cloudTask('Syncing... please wait', async () => {
      const result = await Cloud.sync(choices);
      if (!result.conflicts) return result.lines;
      this.askConflicts(result.conflicts, choices);
      return null;
    });
  },

  askConflicts(conflicts, choices) {
    const box = this.root.querySelector('#account .paper');
    box.innerHTML = `<p class="cloud-msg">Some slots were played on this device AND on another one since they were
      last synced. Choose which one to keep for each (the other is replaced).</p>`;
    for (const c of conflicts) {
      const row = this.el(`<div class="conflict"><b>SLOT ${c.slot}</b>
        <button class="btn plain" data-side="device">KEEP THIS DEVICE'S<small>${this.escape(c.device)}</small></button>
        <button class="btn plain" data-side="cloud">KEEP THE CLOUD'S<small>${this.escape(c.cloud)}</small></button></div>`);
      for (const b of row.querySelectorAll('[data-side]')) {
        b.addEventListener('click', () => {
          this.click();
          choices[c.slot] = b.dataset.side;
          for (const other of row.querySelectorAll('[data-side]')) other.classList.toggle('sel', other === b);
          if (conflicts.every(k => choices[k.slot])) this.runSync(choices);
        });
      }
      box.append(row);
    }
  },

  // Runs a cloud task with a "please wait" message, then shows how it went.
  async cloudTask(busyText, task) {
    if (this.cloudBusy) return;
    this.cloudBusy = true;
    this.click();
    const box = this.root.querySelector('#account .paper');
    for (const b of box.querySelectorAll('button, input')) b.disabled = true;
    box.insertAdjacentHTML('afterbegin', `<p class="cloud-msg">${busyText}</p>`);
    try {
      const lines = await task();
      this.cloudBusy = false;
      if (!lines) return; // (a question is on screen instead)
      this.click('coin');
      this.showAccount(lines.map(line => this.escape(line)).join('<br>'));
    } catch (e) {
      this.cloudBusy = false;
      this.click('putdown');
      this.showAccount(e instanceof CloudError ? e.message : `Something went wrong: ${e.message}`, true);
    }
  },

  // ---------- profile ----------

  // The profile picture: a character's front picture in a round frame.
  avatar(name, size = '') {
    return `<span class="avatar ${size}"><img src="${this.art(`${name}_front`)}" alt=""></span>`;
  },

  // The chip in the menu's top-left corner: avatar and name (tap: profile).
  drawProfileChip() {
    const p = Profile.get(), chip = this.root.querySelector('#menu .profile-chip');
    chip.innerHTML = p ? `${this.avatar(p.avatar)}<span>${this.escape(p.name)}<small>${p.email ? '☁ synced account' : 'not signed in'}</small></span>`
      : '👤 <span>Create profile</span>';
  },

  // A grid of characters to choose from; `onPick(name)` gets the choice.
  avatarPicker(selected, onPick) {
    const grid = this.el(`<div class="avatar-grid">${AVATARS.map(a => `<button class="pick ${a === selected ? 'sel' : ''}" data-a="${a}">${this.avatar(a, 'big')}</button>`).join('')}</div>`);
    for (const b of grid.querySelectorAll('[data-a]')) {
      b.addEventListener('click', () => {
        this.click();
        for (const o of grid.querySelectorAll('.pick')) o.classList.toggle('sel', o === b);
        onPick(b.dataset.a);
      });
    }
    return grid;
  },

  // The first time the game starts: pick a character and a name.
  showWelcome() {
    let avatar = AVATARS[0];
    const box = this.root.querySelector('#welcome .paper');
    box.innerHTML = `<p class="note">Welcome to Street Bites! First, make your profile. Choose the character
      that will be your picture:</p>`;
    box.append(this.avatarPicker(avatar, a => { avatar = a; }));
    box.append(this.el(`<label class="field">Your profile name<input type="text" maxlength="20" spellcheck="false" id="welcome-name"></label>`));
    this.root.querySelector('#welcome [data-act=create]').onclick = () => {
      const name = box.querySelector('#welcome-name').value.trim().slice(0, 20);
      if (!name) { this.click('putdown'); box.querySelector('#welcome-name').focus(); return; }
      this.click('bell');
      Profile.create(name, avatar);
      this.showHelp(true);
    };
    this.show('welcome');
    setTimeout(() => box.querySelector('#welcome-name').focus(), 50);
  },

  // ---------- how to play ----------

  showHelp(first = false) {
    this.helpFromWelcome = first;
    this.root.querySelector('#help .paper').innerHTML = `
      <h3>YOUR TWO JOBS</h3>
      <div class="role-help">${this.avatar('waiter')}<p><b>Waiter.</b> In the restaurant you walk around as the waiter:
        take orders, ring the kitchen, carry the food, clear dirty tables. Tips go into the waiter's wallet.</p></div>
      <div class="role-help"><span class="avatar emoji">📋</span><p><b>Manager.</b> Before opening and after closing you
        run the business: buy ingredients and furniture, arrange the room, set the pay. The manager has a wallet too.</p></div>
      <div class="role-help"><span class="avatar emoji">🔒</span><p><b>Chef, Dishwasher, Cleaner</b> will become playable
        later. For now the computer runs them.</p></div>
      <h3>A DAY</h3>
      <p class="note">1. Morning: buy ingredients (and anything else) &nbsp;→&nbsp; 2. OPEN the restaurant &nbsp;→&nbsp;
        3. serve customers until 10 PM &nbsp;→&nbsp; 4. Night: read the report, shop, rest.</p>
      <h3>CONTROLS</h3>
      <p class="note">Move: the joystick on the left (or W A S D / the arrow keys). Act: the big round button on the
        right (or Space). It always shows what you can do where you stand.</p>
      <h3>HAPPY CUSTOMERS</h3>
      <p class="note">Each customer shows how they feel: 😊 happy, 😐 waiting too long, 😠 about to leave. When they go,
        they give 1 to 5 stars. Good stars bring more customers; bad stars keep them away.</p>
      <h3>SAVING</h3>
      <p class="note">The game saves by itself at the end of each day. To play on another phone or computer, open
        PROFILE &amp; SYNC, sign in with the same email and press SYNC.</p>`;
    this.root.querySelector('#help [data-act=back]').textContent = first ? 'LET\'S PLAY ▶' : '◀ BACK';
    this.show('help');
  },

  // ---------- staff and pay (the manager's window) ----------

  showStaff() {
    const sim = this.sim, P = sim.pay, F = ECONOMY.fixedWages, box = this.root.querySelector('#staff .paper');
    const pct = v => `${Math.round(v * 100)}%`;
    const restaurantShare = 1 - P.waiter.tipShare - (P.manager.tipShare || 0);
    const control = (role, key, label, value, step, show) => `<div class="pay-row"><span>${label}</span>
      <button class="btn plain" data-pay="${role}:${key}:${-step}">−</button><b>${show(value)}</b>
      <button class="btn plain" data-pay="${role}:${key}:${step}">+</button></div>`;
    const card = (avatar, name, who, body, locked) => `<div class="role-card ${locked ? 'locked' : ''}">
      ${avatar}<div class="role-body"><b>${name}</b><small>${who}</small>${body}</div></div>`;
    const fixed = (amount, note) => `<div class="pay-row fixed"><span>Pay per day</span><b>$${amount}</b></div><p class="note">${note}</p>`;
    box.innerHTML = `
      <p class="note">You play the Manager and the Waiter, so you decide their pay. The other staff are run by the
        computer: their pay is set by the game and can't be changed. Pay and tips are shared out at the end of each day.</p>
      ${card(this.avatar('cashier'), 'Manager', 'You · player',
        control('manager', 'salary', 'Pay per day', P.manager.salary, 1, v => `$${v}`)
        + control('manager', 'profitShare', 'Share of the profit', P.manager.profitShare, 0.05, pct)
        + control('manager', 'tipShare', 'Share of the tips', P.manager.tipShare || 0, 0.05, pct)
        + `<p class="note">Manager's wallet: $${sim.managerWallet}</p>`)}
      ${card(this.avatar(sim.outfit || 'waiter'), 'Waiter', 'You · player',
        control('waiter', 'salary', 'Pay per day', P.waiter.salary, 1, v => `$${v}`)
        + control('waiter', 'tipShare', 'Share of the tips', P.waiter.tipShare, 0.05, pct)
        + `<p class="note">Waiter's wallet: $${sim.wallet}</p>`)}
      <p class="cloud-msg">The restaurant keeps ${pct(Math.max(0, restaurantShare))} of the tips. More pay for you means less money for the restaurant's upgrades.</p>
      ${card(this.avatar('chef'), 'Chef', 'Computer · 🔒 playable later', fixed(F.chef, 'Cooks every order.'), true)}
      ${card(this.avatar('cashier'), 'Cashier', 'Computer', fixed(F.cashier, 'Takes the money at the counter.'), true)}
      ${card(this.avatar('cleaner'), 'Cleaner', 'Computer · 🔒 playable later', fixed(F.cleaner, 'Empties the dish bin and washes up.'), true)}
      ${card('<span class="avatar emoji">🧽</span>', 'Dishwasher', '🔒 coming later', '<p class="note">Not in the restaurant yet: the cleaner does the washing up.</p>', true)}
      ${card(this.avatar('greeter'), 'Greeter', sim.staff.greeter ? 'Computer' : 'Not hired (hire in SHOP → DINING)',
        sim.staff.greeter ? fixed(F.greeter, 'Welcomes customers at the door.') : '<p class="note">Customers wait a little longer when someone greets them.</p>', true)}`;
    for (const b of box.querySelectorAll('[data-pay]')) {
      b.addEventListener('click', () => {
        const [role, key, step] = b.dataset.pay.split(':');
        this.click();
        sim.setPay(role, key, (sim.pay[role][key] || 0) + Number(step));
        const keep = box.scrollTop;
        this.showStaff();
        box.scrollTop = keep;
      });
    }
    this.show('staff');
  },

  quit() {
    const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (app && app.exitApp) return app.exitApp();
    this.show('bye');
    window.close(); // only works when the page was opened by a script; otherwise the goodbye screen stays
  },

  // ---------- loading screen, then the game ----------

  showLoading(time) {
    const title = this.root.querySelector('#loading .title');
    title.innerHTML = [...'STREET BITES'].map((ch, i) => (ch === ' ' ? ' '
      : `<span style="animation-delay:${i * 0.09}s${i > 6 ? ';color:#fff6dc' : ''}">${ch}</span>`)).join('');
    this.root.querySelector('#loading .foods').innerHTML = MENU.map((m, i) =>
      `<img src="${this.art('food_' + m.id)}" alt="" style="animation-delay:${(i * 0.37) % 1.5}s">`).join('');
    this.root.querySelector('#loading .tip').textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    const bar = this.root.querySelector('#loading .bar i');
    bar.style.transition = 'none';
    bar.style.width = '0';
    this.show('loading');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `width ${time}ms linear`;
      bar.style.width = '100%';
    }));
  },

  // Play the game in a save slot (`isNew` starts it over from day 1).
  startGame(slot, isNew, time = LOADING_TIME, name) {
    if (typeof time === 'string') [time, name] = [LOADING_TIME, time]; // startGame(slot, true, 'Sanway Restaurant')
    SaveGame.begin(slot, isNew, name);
    if (!this.root.querySelector('#loading').classList.contains('on')) this.showLoading(time);
    setTimeout(() => this.game.scene.start('Restaurant'), time);
  },

  // The restaurant is on screen and ready.
  gameReady() {
    this.show(null);
  },

  // ---------- end-of-day report ----------

  // `report` is what the simulation's 'dayEnd' event carries; `onNext` goes on to the night.
  showReport(report, sim, onNext) {
    const r = report;
    this.sim = sim;
    this.onNext = onNext;
    this.needsRebuild = false;
    const row = (label, value, cls = '') => `<div class="row ${cls}"><span>${label}</span><span>${value}</span></div>`;
    const money = (n, sign) => `<span class="${sign === '+' ? 'plus' : 'minus'}">${sign}$${n}</span>`;
    const signed = n => `<span class="${n < 0 ? 'minus' : 'plus'}">${n < 0 ? '-' : '+'}$${Math.abs(n)}</span>`;
    this.root.querySelector('#report h2').textContent = `DAY ${r.day} IS OVER`;
    this.root.querySelector('#report .paper').innerHTML = `
      <h3>CUSTOMERS</h3>
      ${row('Served', `${r.served} of about ${r.expected} expected`)}
      ${row('😊 Happy customers', r.happy)}
      ${row('😠 Left angry', r.lost)}
      ${r.soldOut ? row('😞 Left because food ran out', r.soldOut) : ''}
      ${row("Today's reviews", r.reviews ? `★ ${r.stars.toFixed(1)} from ${r.reviews} ${r.reviews === 1 ? 'customer' : 'customers'}` : 'none')}
      ${row('Reputation', `★ ${r.reputation.toFixed(1)}  (about ${r.nextCustomers} customers tomorrow)`)}
      ${row('Restaurant level', `${r.rating.stars} (${r.rating.points} points${r.rating.nextAt ? `, next level at ${r.rating.nextAt}` : ''})`)}
      <h3>RESTAURANT: MONEY IN</h3>
      ${row('Sales', money(r.sales, '+'))}
      ${row("The restaurant's share of the tips", money(r.tipShare, '+'))}
      <h3>RESTAURANT: MONEY OUT</h3>
      ${row('Ingredients (bought for today)', money(r.ingredients, '-'))}
      ${row('Rent', money(r.rent, '-'))}
      ${row('Water, licence and other fixed costs', money(r.otherFixed, '-'))}
      ${row('Electricity', money(r.electricity, '-'))}
      ${Object.entries(r.wages).map(([who, pay]) => row(`Wages: ${who}`, money(pay, '-'))).join('')}
      ${row("Manager's share of the profit", money(r.manager, '-'))}
      ${row('Profit today', signed(r.profit), 'total')}
      ${row('Restaurant money now', `${r.money < 0 ? '-' : ''}$${Math.abs(r.money)}`, 'total')}
      <h3>MANAGER'S MONEY</h3>
      ${row('Pay for the day', money(r.managerPay.salary, '+'))}
      ${row('Share of the profit', money(r.managerPay.share, '+'))}
      ${row('Share of the tips', money(r.managerPay.tips, '+'))}
      ${row("Manager's wallet", `$${r.managerPay.wallet}`, 'total')}
      <h3>WAITER'S MONEY</h3>
      ${row('Tips earned', money(r.tips, '+'))}
      ${row('Shared with the restaurant and the manager', money(r.tips - r.tipsKept, '-'))}
      ${row('Pay for the day', money(r.pay, '+'))}
      ${row(`Wasted food${r.wastedDishes ? ` (${r.wastedDishes})` : ''}`, money(r.deduction, '-'))}
      ${row("Waiter's wallet", `$${r.wallet}`, 'total')}
      <h3>KITCHEN LIST</h3>
      <table><tr><th>Dish</th><th>Made</th><th>Served</th><th>Wasted</th><th>Left</th></tr>
      ${r.kitchen.map(k => `<tr><td>${k.name}</td><td>${k.made}</td><td>${k.served}</td><td>${k.wasted}</td><td>${k.unclaimed}</td></tr>`).join('')}
      </table>
      <p class="note">Wasted = thrown away while a customer still wanted it (charged to you).
      Left = made, but its customer had already gone.</p>`;
    this.root.querySelector('#report .paper').scrollTop = 0;
    this.show('report');
  },

  // ---------- night and morning: shop, arrange, ingredients ----------

  // After the day's report ('night') and before opening ('morning'). `actions`:
  // bed() goes on to the morning, open() opens the restaurant.
  showHub(when, sim, actions) {
    this.sim = sim;
    this.hubWhen = when;
    this.hubActions = actions || this.hubActions;
    this.openWarned = false;
    if (this.autoOpen) { // the restaurant was just rebuilt on the way to opening: open straight away
      this.autoOpen = false;
      return this.leaveHub('open');
    }
    const night = when === 'night', rating = Economy.rating(sim.owned, sim.placed);
    const stock = Perks.dishes(sim.owned).reduce((n, m) => n + (sim.stock[m.id] || 0), 0);
    this.root.querySelector('#hub h2').textContent = (night ? `NIGHT · DAY ${sim.day} IS OVER` : `MORNING · DAY ${sim.day}`)
      + (sim.name ? ` · ${sim.name.toUpperCase()}` : '');
    this.root.querySelector('#hub .purse').innerHTML = `<span class="sel">Restaurant $${sim.money}</span>`
      + `<span>Manager $${sim.managerWallet}</span><span>Waiter $${sim.wallet}</span>`
      + `<span>Level ${rating.stars}</span><span>★ ${sim.reputation().toFixed(1)}</span>`;
    this.root.querySelector('#hub .paper').innerHTML = `
      <p class="note">${night ? 'The restaurant is closed for the night.' : 'The restaurant opens when you are ready.'}
      About ${sim.expectedCustomers()} customers are expected ${night ? 'tomorrow' : 'today'}.
      Food in stock: ${stock} ${stock === 1 ? 'dish' : 'dishes'}. ${sim.store.length ? `In the storeroom: ${sim.store.length} ${sim.store.length === 1 ? 'thing' : 'things'} to place.` : ''}</p>
      <div class="hub-buttons">
        <button class="btn plain" data-hub="shop">🛒 SHOP<small>Buy furniture, upgrades, dishes</small></button>
        <button class="btn plain" data-hub="arrange">🪑 ARRANGE<small>Place, move or sell furniture</small></button>
        <button class="btn plain" data-hub="market">🥕 INGREDIENTS<small>Buy food for ${night ? 'tomorrow' : 'today'}</small></button>
        <button class="btn plain" data-hub="staff">👥 STAFF &amp; PAY<small>Set the manager's and waiter's pay</small></button>
        <button class="btn plain" data-hub="stats">📊 STATISTICS<small>Profit, sales, best dishes</small></button>
        ${night ? '<button class="btn plain" data-hub="report">📋 REPORT<small>Today\'s accounts again</small></button>' : ''}
      </div>`;
    const box = this.root.querySelector('#hub .paper');
    box.querySelector('[data-hub=shop]').addEventListener('click', () => { this.click(); this.showShop(this.shopTab || 'dining'); });
    box.querySelector('[data-hub=arrange]').addEventListener('click', () => { this.click(); Arrange.start(sim); });
    box.querySelector('[data-hub=market]').addEventListener('click', () => { this.click(); this.showMarket(); });
    box.querySelector('[data-hub=stats]').addEventListener('click', () => { this.click(); this.showStats(); });
    box.querySelector('[data-hub=staff]').addEventListener('click', () => { this.click(); this.showStaff(); });
    if (night) box.querySelector('[data-hub=report]').addEventListener('click', () => { this.click(); this.reportFromHub = true; this.show('report'); });
    this.root.querySelector('#hub [data-act=go]').textContent = night ? 'GO TO BED ▶' : 'OPEN THE RESTAURANT ▶';
    this.show('hub');
  },

  backToHub() {
    this.showHub(this.hubWhen, this.sim);
  },

  // GO TO BED / OPEN. New furniture, dishes or upgrades mean setting the
  // restaurant up again, which is done by reloading the page into this save.
  leaveHub(how = this.hubWhen === 'night' ? 'bed' : 'open') {
    const sim = this.sim;
    if (how === 'open' && !this.openWarned) { // a second tap opens anyway
      const food = Perks.dishes(sim.owned).some(m => (sim.stock[m.id] || 0) > 0);
      const warning = !sim.seats.length ? 'NO CHAIRS! TAP AGAIN TO OPEN' : !food ? 'NO FOOD! TAP AGAIN TO OPEN' : '';
      if (warning && this.root.querySelector('#hub').classList.contains('on')) {
        this.openWarned = true;
        this.click('putdown');
        this.root.querySelector('#hub [data-act=go]').textContent = warning;
        return;
      }
    }
    this.click('bell');
    if (this.needsRebuild) return this.rebuild(how === 'open');
    this.show(null);
    if (how === 'open') this.hubActions.open(); else this.hubActions.bed();
  },

  // Reloads the game into this save (it comes back in the morning).
  rebuild(thenOpen) {
    try {
      sessionStorage.setItem('sb.autostart', String(SaveGame.slot));
      if (thenOpen) sessionStorage.setItem('sb.autoopen', '1');
    } catch (e) { /* falls back to the menu */ }
    this.showLoading(QUICK_LOADING_TIME);
    location.reload();
  },

  // ---------- shop ----------

  showShop(tab) {
    const sim = this.sim;
    this.shopTab = tab;
    for (const b of this.root.querySelectorAll('#shop [data-tab]')) b.classList.toggle('sel', b.dataset.tab === tab);
    // the waiter's own things are paid from the wallet, everything else from the restaurant's money
    const ownMoney = tab === 'waiter';
    const rating = Economy.rating(sim.owned, sim.placed);
    this.root.querySelector('#shop .purse').innerHTML =
      `<span class="${ownMoney ? '' : 'sel'}">Restaurant $${sim.money}</span><span class="${ownMoney ? 'sel' : ''}">Waiter's wallet $${sim.wallet}</span>`
      + `<span>Level ${rating.stars}</span>`;
    const list = this.root.querySelector('#shop .paper');
    const keep = list.dataset.tab === tab ? list.scrollTop : 0;
    list.dataset.tab = tab;
    list.innerHTML = '';
    if (tab === 'store') return this.drawStoreroom(list, keep);
    const purse = ownMoney ? sim.wallet : sim.money;
    const items = tab === 'waiter'
      ? [{ id: 'classic', name: 'Classic uniform', text: 'The black vest the waiter started with.', outfit: 'waiter', icon: 'waiter_front' }, ...SHOP.waiter]
      : SHOP[tab];
    if (tab === 'dining' || tab === 'decor') {
      list.append(this.el(`<p class="note">Things you buy go to the STOREROOM. Place them with ARRANGE
        (at night or in the morning).${tab === 'decor' ? ' Every decoration makes customers wait a little longer.' : ''}</p>`));
    }
    if (tab === 'menu') list.append(this.el(`<p class="note">On the menu now: ${Perks.dishes(sim.owned).map(m => m.name).join(', ')}.</p>`));
    for (const item of items) {
      if (item.furniture) { list.append(this.furnitureRow(item.furniture)); continue; }
      const owned = item.id === 'classic' || sim.owned.has(item.id);
      const locked = item.needs && !sim.owned.has(item.needs);
      const needsStars = item.stars && rating.stars < item.stars; // a dish for a better restaurant
      // an upgrade shows one line: the next level to buy, or its top level once that is owned
      if (item.chain && (locked || (owned && items.some(next => next.needs === item.id)))) continue;
      const row = this.itemRow(item.icon, item.name, item.text);
      let button;
      if (owned && item.outfit) {
        const wearing = sim.outfit === item.outfit;
        button = this.el(wearing ? '<span class="own">✔ WEARING</span>' : '<button class="btn plain">WEAR</button>');
        if (!wearing) button.addEventListener('click', () => { this.click(); sim.wear(item.outfit); this.showShop(tab); });
      } else if (owned) {
        button = this.el('<span class="own">✔ OWNED</span>');
      } else if (needsStars) {
        button = this.el(`<button class="btn off" disabled>NEEDS LEVEL ${item.stars}</button>`);
        row.querySelector('small').textContent += ' Upgrade and decorate the restaurant to raise its level.';
      } else if (locked) {
        button = this.el('<button class="btn off" disabled>LOCKED</button>');
        row.querySelector('small').textContent += ` (Buy "${SHOP[tab].find(i => i.id === item.needs).name}" first.)`;
      } else {
        const can = purse >= item.price;
        button = this.el(`<button class="btn ${can ? '' : 'off'}">$${item.price}</button>`);
        button.addEventListener('click', () => {
          if (!sim.buy(item, ownMoney ? 'waiter' : 'restaurant')) return this.click('putdown');
          this.click('coin');
          if (item.rebuild) this.needsRebuild = true;
          if (item.outfit) sim.wear(item.outfit);
          this.showShop(tab);
        });
      }
      row.append(button);
      list.append(row);
    }
    list.scrollTop = keep;
    this.show('shop');
  },

  // A shop line: a picture (or emoji), a name and a description.
  itemRow(icon, name, text, emoji) {
    const isPicture = !!ART_FILES[icon];
    return this.el(`<div class="item">
      <div class="pic ${isPicture ? '' : 'emoji'}">${isPicture ? `<img src="${this.art(icon)}" alt="">` : (emoji || icon || '📦')}</div>
      <div class="what">${name}<small>${text}</small></div></div>`);
  },

  // A piece of furniture: one buy button, or one per level (tables and chairs).
  furnitureRow(item) {
    const sim = this.sim;
    const have = [...Object.values(sim.placed), ...sim.store].filter(e => e.id === item.id).length;
    const row = this.itemRow(Furniture.picture({ id: item.id, level: 1 }) || item.icon, item.name,
      `${item.text}${have ? ` You have ${have}.` : ''}`, item.emoji);
    const buttons = this.el('<div class="levels"></div>');
    const levels = item.levels ? item.levels.map((price, i) => ({ id: item.id, level: i + 1 })) : [{ id: item.id }];
    for (const entry of levels) {
      const price = Furniture.price(entry);
      const b = this.el(`<button class="btn ${sim.money >= price ? '' : 'off'}">${entry.level ? `L${entry.level} ` : ''}$${price}</button>`);
      b.addEventListener('click', () => {
        if (!sim.buyFurniture(entry)) return this.click('putdown');
        this.click('coin');
        this.showShop(this.shopTab);
      });
      buttons.append(b);
    }
    row.append(buttons);
    return row;
  },

  // What is in the storeroom, with a SELL button each.
  drawStoreroom(list, keep) {
    const sim = this.sim;
    list.append(this.el(`<p class="note">Bought but not placed yet. Place things with ARRANGE.
      Selling gives back ${Math.round(SELL_BACK * 100)}% of the price.</p>`));
    if (!sim.store.length) list.append(this.el('<p class="note">The storeroom is empty.</p>'));
    sim.store.forEach((entry, i) => {
      const item = FURNITURE_BY_ID[entry.id];
      const row = this.itemRow(Furniture.picture(entry) || item.icon, Furniture.label(entry), item.text, item.emoji);
      const b = this.el(`<button class="btn plain">SELL $${Furniture.sellPrice(entry)}</button>`);
      b.addEventListener('click', () => { this.click('coin'); sim.sellStored(i); this.showShop('store'); });
      row.append(b);
      list.append(row);
    });
    list.scrollTop = keep;
    this.show('shop');
  },

  // ---------- statistics ----------

  // Every finished day of this restaurant: profit, sales, customers and dishes.
  showStats() {
    const sim = this.sim, days = sim.history;
    this.root.querySelector('#stats h2').textContent = `STATISTICS: ${sim.name || 'MY RESTAURANT'}`.toUpperCase();
    const box = this.root.querySelector('#stats .paper');
    if (!days.length) {
      box.innerHTML = '<p class="note">Statistics are kept from the first day you finish from now on. Come back after closing time.</p>';
      return this.show('stats');
    }
    const sum = (list, key) => list.reduce((n, d) => n + (d[key] || 0), 0);
    const week = days.slice(-7);
    const money = n => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n))}`;
    const tile = (label, value, sub) => `<div class="tile"><small>${label}</small><b>${value}</b><small>${sub}</small></div>`;
    const best = days.reduce((a, d) => (d.profit > a.profit ? d : a), days[0]);
    box.innerHTML = `
      <div class="tiles">
        ${tile('Profit, last 7 days', money(sum(week, 'profit')), `${money(sum(days, 'profit'))} in all ${days.length} days`)}
        ${tile('Sales, last 7 days', money(sum(week, 'sales')), `${money(sum(days, 'sales'))} in all`)}
        ${tile('Customers served', sum(week, 'served'), `${sum(week, 'lost') + sum(week, 'soldOut')} left unhappy (7 days)`)}
        ${tile('Reputation', `★ ${sim.reputation ? sim.reputation().toFixed(1) : '-'}`, `${sum(week, 'happy')} happy customers (7 days)`)}
      </div>
      <h3>SALES PER DAY</h3>${this.barChart(days.slice(-14), 'sales', '#8c4a1c', 'sales')}
      <h3>PROFIT PER DAY</h3>${this.barChart(days.slice(-14), 'profit', '#2e7d4f', 'profit')}
      <h3>DISHES</h3>${this.dishTable(days)}
      <h3>WHERE THE MONEY WENT (LAST 7 DAYS)</h3>
      <div class="row"><span>Ingredients</span><span>${money(sum(week, 'ingredients'))}</span></div>
      <div class="row"><span>Wages</span><span>${money(sum(week, 'wages'))}</span></div>
      <div class="row"><span>Rent, electricity, other bills, manager</span><span>${money(sum(week, 'bills'))}</span></div>
      <div class="row total"><span>Tips you earned</span><span>${money(sum(week, 'tips'))}</span></div>`;
    for (const chart of box.querySelectorAll('.chart')) {
      const readout = chart.querySelector('.readout');
      for (const bar of chart.querySelectorAll('[data-tip]')) {
        const showTip = () => { readout.textContent = bar.dataset.tip; };
        bar.addEventListener('mouseenter', showTip);
        bar.addEventListener('click', showTip);
      }
    }
    box.scrollTop = 0;
    this.show('stats');
  },

  // A bar chart of one number per day (bars below the line are losses). Tap a bar to read it.
  barChart(days, key, color, what) {
    const W = 560, H = 150, top = 14, base = 24, values = days.map(d => d[key] || 0);
    const max = Math.max(1, ...values), min = Math.min(0, ...values), span = max - min;
    const zero = top + (H - top - base) * (max / span);   // the $0 line
    const slot = W / Math.max(days.length, 7), bw = Math.min(28, slot - 6);
    const y = v => top + (H - top - base) * ((max - v) / span);
    const bars = days.map((d, i) => {
      const v = values[i], x = i * slot + (slot - bw) / 2, y1 = Math.min(y(v), zero), h = Math.max(2, Math.abs(y(v) - zero));
      const tip = `Day ${d.day}: ${what} ${v < 0 ? '-' : ''}$${Math.abs(v)}`;
      return `<g data-tip="${tip}"><rect x="${i * slot}" y="${top}" width="${slot}" height="${H - top}" fill="transparent"/>
        <rect x="${x}" y="${y1}" width="${bw}" height="${h}" rx="3" fill="${color}" opacity="${v < 0 ? 0.55 : 1}"/>
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${d.day}</text></g>`;
    }).join('');
    const last = days[days.length - 1];
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${what} per day">
      <line x1="0" x2="${W}" y1="${zero}" y2="${zero}" class="axis"/>
      <text x="2" y="${top - 3}" class="scale">$${Math.round(max)}</text>${bars}</svg>
      <div class="readout">Day ${last.day}: ${what} ${last[key] < 0 ? '-' : ''}$${Math.abs(last[key] || 0)} · tap a bar</div></div>`;
  },

  // Every dish ever sold: how many, the money it brought, and its share of all sales.
  dishTable(days) {
    const totals = {}, week = {};
    days.forEach((d, i) => {
      for (const [id, [n, money]] of Object.entries(d.dishes || {})) {
        const t = totals[id] || (totals[id] = [0, 0]); t[0] += n; t[1] += money;
        if (i >= days.length - 7) week[id] = (week[id] || 0) + n;
      }
    });
    const rows = Object.entries(totals).sort((a, b) => b[1][1] - a[1][1]);
    if (!rows.length) return '<p class="note">No dishes sold yet.</p>';
    const all = rows.reduce((n, [, [, money]]) => n + money, 0) || 1;
    return `<table class="dishes"><tr><th>Dish</th><th>Sold (7 days)</th><th>Sold (all)</th><th>Money</th><th>Share</th></tr>
      ${rows.map(([id, [n, money]]) => `<tr><td>${MENU_BY_ID[id] ? MENU_BY_ID[id].name : id}</td><td>${week[id] || 0}</td><td>${n}</td>
        <td>$${money}</td><td><span class="share"><i style="width:${Math.round((money / all) * 100)}%"></i></span>${Math.round((money / all) * 100)}%</td></tr>`).join('')}
    </table>`;
  },

  // ---------- ingredients ----------

  showMarket() {
    this.packs = {};          // packs about to be bought, by dish id
    this.planIngredients();
    this.drawMarket();
    this.show('market');
  },

  // Fills the basket with about enough for the expected customers.
  planIngredients() {
    const sim = this.sim, menu = Perks.dishes(sim.owned);
    const perDish = Math.ceil((sim.expectedCustomers() * 1.8) / menu.length); // customers order about 1.8 dishes each
    this.packs = {};
    for (const m of menu) {
      const short = perDish - (sim.stock[m.id] || 0);
      if (short > 0) this.packs[m.id] = Math.ceil(short / ECONOMY.packSize);
    }
    // never more than the restaurant can pay for (with the supplier's credit)
    while (this.basketCost() > sim.money + ECONOMY.supplierCredit) {
      const most = Object.keys(this.packs).sort((a, b) => this.packs[b] - this.packs[a])[0];
      if (!most) break;
      if (--this.packs[most] <= 0) delete this.packs[most];
    }
  },

  basketCost() {
    return Object.entries(this.packs).reduce((sum, [id, n]) => sum + n * Economy.packPrice(MENU_BY_ID[id]), 0);
  },

  drawMarket() {
    const sim = this.sim, cost = this.basketCost(), left = sim.money - cost;
    this.root.querySelector('#market h2').textContent = 'BUY INGREDIENTS';
    this.root.querySelector('#market .purse').innerHTML =
      `<span class="sel">Restaurant $${sim.money}</span><span>About ${sim.expectedCustomers()} customers expected</span>`;
    const list = this.root.querySelector('#market .paper');
    const keep = list.scrollTop;
    list.innerHTML = `<p class="note">The kitchen can only cook what you buy. One pack is enough for
      ${ECONOMY.packSize} dishes. Whatever is left keeps for the next day.</p>`;
    for (const m of Perks.dishes(sim.owned)) {
      const n = this.packs[m.id] || 0, price = Economy.packPrice(m), stock = sim.stock[m.id] || 0;
      const row = this.el(`<div class="item">
        <div class="pic"><img src="${this.art('food_' + m.id)}" alt=""></div>
        <div class="what">${m.name}<small>In stock: ${stock} ${stock === 1 ? 'dish' : 'dishes'}  ·  $${price} a pack  ·  sells for $${m.price}</small></div>
        <div class="qty"><button class="btn plain" data-d="-1">−</button><b>${n}</b><button class="btn plain" data-d="1">+</button></div></div>`);
      for (const b of row.querySelectorAll('[data-d]')) {
        b.addEventListener('click', () => {
          const d = Number(b.dataset.d);
          if (d > 0 && left - price < -ECONOMY.supplierCredit) return this.click('putdown'); // can't afford it
          this.packs[m.id] = Math.max(0, n + d);
          this.click();
          this.drawMarket();
        });
      }
      list.append(row);
    }
    list.scrollTop = keep;
    this.root.querySelector('#market [data-act=plan]').textContent = `FILL FOR ${sim.expectedCustomers()} CUSTOMERS`;
    this.root.querySelector('#market [data-act=buy]').textContent = cost ? `BUY ($${cost}) ✓` : '◀ BACK';
  },

  buyIngredients() {
    if (this.basketCost()) this.click('coin'); else this.click();
    this.sim.buyIngredients(this.packs);
    this.backToHub();
  },

  // Back to the main menu (from the pause panel).
  toMenu() {
    try { sessionStorage.setItem('sb.menu', '1'); } catch (e) { /* the logo shows again, no harm */ }
    location.reload();
  },
};
