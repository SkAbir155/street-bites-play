// Player accounts and cloud saves, through Google Firebase (free plan).
//
//   Authentication  the list of players (email + password)
//   Firestore       players/<id>   a player's place in the game (only CLOUD.maxPlayers can join)
//                   meta/seats     how many places are taken
//                   saves/<id>     a player's saved games
// The game talks to Firebase directly over the internet (its "REST" web
// addresses), so it needs no extra library and works the same in a browser,
// the Android app and the Windows app. The security rules in Firebase (see
// tools/firebase-rules.txt) make sure each player can only touch their own saves.
//
// Syncing only happens when the player presses SYNC: for each save slot the
// newer copy (on this device or in the cloud) wins.

const CLOUD = {
  maxPlayers: 20, // must match maxPlayers() in the Firebase security rules
  config: {       // from Firebase: Project settings -> Your apps -> Street Bites (safe to be public)
    apiKey: 'AIzaSyAmCOO_ymh87w4IKuGO5Y2G-TAo4VD3pbA',
    projectId: 'street-bites-abir-2026',
  },
};

const SESSION_KEY = 'streetBites.cloud.session';
const SYNCED_KEY = 'streetBites.cloud.synced'; // { player id: { slot: the version both sides had after the last sync } }
const BACKUP_KEY = 'streetBites.saves.beforeSync'; // the device's saves as they were before the last sync

// A problem with a message that can be shown to the player as it is.
class CloudError extends Error {}

const Cloud = {
  // ---------- talking to Firebase ----------

  async request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    } catch (e) {
      throw new CloudError('No internet connection. Connect and try again.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new CloudError(this.explain(body.error || {}));
      err.code = (body.error && (body.error.status || body.error.message)) || response.status;
      err.httpStatus = response.status;
      throw err;
    }
    return body;
  },

  // Firebase's error codes, in plain words.
  explain(error) {
    const code = String(error.message || error.status || '');
    if (code.startsWith('EMAIL_EXISTS')) return 'That email already has an account. Use SIGN IN instead.';
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(code)) return 'Wrong email or password.';
    if (code.startsWith('WEAK_PASSWORD')) return 'The password needs at least 6 characters.';
    if (code.startsWith('INVALID_EMAIL') || code.startsWith('MISSING_EMAIL')) return 'That email address doesn\'t look right.';
    if (code.startsWith('MISSING_PASSWORD')) return 'Type a password.';
    if (code.startsWith('TOO_MANY_ATTEMPTS')) return 'Too many tries. Wait a few minutes and try again.';
    if (code.startsWith('USER_DISABLED')) return 'This account has been switched off.';
    if (code === 'PERMISSION_DENIED') return 'The cloud refused this. (Are the Firebase security rules published?)';
    return `The cloud said: ${code || 'something went wrong'}.`;
  },

  authUrl(action) {
    return `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${CLOUD.config.apiKey}`;
  },

  docsUrl(path = '') {
    return `https://firestore.googleapis.com/v1/projects/${CLOUD.config.projectId}/databases/(default)/documents${path}`;
  },

  docName(path) {
    return `projects/${CLOUD.config.projectId}/databases/(default)/documents/${path}`;
  },

  // A Firestore request as the signed-in player.
  async db(path, options = {}) {
    const token = await this.token();
    return this.request(this.docsUrl(path), { ...options, headers: { Authorization: `Bearer ${token}` } });
  },

  // ---------- the signed-in player (kept on this device) ----------

  session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  },

  keep(auth, email) {
    const session = {
      email: email || auth.email, uid: auth.localId || auth.user_id, refreshToken: auth.refreshToken || auth.refresh_token,
      idToken: auth.idToken || auth.id_token, expiresAt: Date.now() + (Number(auth.expiresIn || auth.expires_in) - 60) * 1000,
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...this.session(), ...session })); } catch (e) { /* not kept */ }
    return session;
  },

  // A fresh sign-in pass (they last an hour; a new one is fetched when needed).
  async token() {
    const s = this.session();
    if (!s) throw new CloudError('Sign in first.');
    if (Date.now() < s.expiresAt) return s.idToken;
    const fresh = await this.request(`https://securetoken.googleapis.com/v1/token?key=${CLOUD.config.apiKey}`, {
      method: 'POST', body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: s.refreshToken }),
    });
    return this.keep(fresh, s.email).idToken;
  },

  signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* already gone */ }
  },

  // ---------- registering and signing in ----------

  async register(email, password) {
    const auth = await this.request(this.authUrl('signUp'), {
      method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    this.keep(auth, email);
    try {
      const seat = await this.join(email);
      await this.linkProfile().catch(() => {});
      return seat;
    } catch (e) {
      // no place for them: remove the account again, so it doesn't linger
      if (e.full) await this.request(this.authUrl('delete'), { method: 'POST', body: JSON.stringify({ idToken: auth.idToken }) }).catch(() => {});
      this.signOut();
      throw e;
    }
  },

  async signIn(email, password) {
    const auth = await this.request(this.authUrl('signInWithPassword'), {
      method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    this.keep(auth, email);
    try {
      const seat = await this.join(email); // (already a player: nothing to do)
      await this.linkProfile().catch(() => {});
      return seat;
    } catch (e) {
      this.signOut();
      throw e;
    }
  },

  // Takes one of the places in the game, unless this player already has one.
  // Returns the player's place number.
  async join(email) {
    const uid = this.session().uid;
    const mine = await this.db(`/players/${uid}`).catch(e => { if (e.httpStatus === 404) return null; throw e; });
    if (mine) return this.saveSeat(Number(mine.fields.seat.integerValue));
    for (let attempt = 0; attempt < 3; attempt++) {
      const seats = await this.db('/meta/seats').catch(e => { if (e.httpStatus === 404) return null; throw e; });
      const taken = seats ? Number(seats.fields.count.integerValue) : 0;
      if (taken >= CLOUD.maxPlayers) throw this.fullError();
      try {
        // both at once: the new player's place, and one more place taken
        await this.db(':commit', {
          method: 'POST',
          body: JSON.stringify({
            writes: [
              { update: { name: this.docName(`players/${uid}`), fields: {
                seat: { integerValue: String(taken + 1) }, email: { stringValue: email },
                joined: { timestampValue: new Date().toISOString() } } },
              currentDocument: { exists: false } },
              { update: { name: this.docName('meta/seats'), fields: { count: { integerValue: String(taken + 1) } } },
                currentDocument: seats ? { updateTime: seats.updateTime } : { exists: false } },
            ],
          }),
        });
        return this.saveSeat(taken + 1);
      } catch (e) {
        if (e.httpStatus === 403 && taken + 1 > CLOUD.maxPlayers) throw this.fullError();
        // someone else joined at the same moment: count again
        if (e.code === 'FAILED_PRECONDITION' || e.code === 'ABORTED' || e.httpStatus === 409) continue;
        throw e;
      }
    }
    throw new CloudError('The cloud is busy. Try again in a moment.');
  },

  // Links this device's profile to the account (or takes the account's profile, if it has one already).
  async linkProfile() {
    const s = this.session();
    const doc = await this.db(`/saves/${s.uid}`).catch(e => { if (e.httpStatus === 404) return null; throw e; });
    const cloud = doc ? JSON.parse(doc.fields.data.stringValue) : {};
    Profile.link(cloud.profile, s.uid, s.email);
  },

  fullError() {
    const e = new CloudError(`Sorry, there are no spaces left in the game for new players (all ${CLOUD.maxPlayers} places are taken).`);
    e.full = true;
    return e;
  },

  saveSeat(seat) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...this.session(), seat })); } catch (e) { /* not kept */ }
    return seat;
  },

  // ---------- syncing ----------

  // A save in a few words, e.g. "Sanway Restaurant, Day 23, $1840 (iPad, 3 Oct)".
  describe(save) {
    if (!save) return 'empty';
    const when = save.savedAt ? new Date(save.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    const where = [save.device, when].filter(Boolean).join(', ');
    if (save.deleted) return `deleted${where ? ` (${where})` : ''}`;
    return `${save.name || 'Unnamed'}, Day ${save.day}, $${save.money}${where ? ` (${where})` : ''}`;
  },

  synced() {
    try { return JSON.parse(localStorage.getItem(SYNCED_KEY)) || {}; } catch (e) { return {}; }
  },

  // Brings this device and the cloud level, slot by slot. This device remembers
  // which version it last synced, so it knows which side has changed since:
  //   only this device changed  -> sent to the cloud
  //   only the cloud changed    -> brought to this device
  //   both changed              -> a conflict: the player chooses (`choices`: { slot: 'device' | 'cloud' })
  // Returns { lines: what happened } or, while conflicts are unanswered, { conflicts: [...] }.
  async sync(choices = {}) {
    const uid = this.session().uid;
    const doc = await this.db(`/saves/${uid}`).catch(e => { if (e.httpStatus === 404) return null; throw e; });
    const cloud = doc ? JSON.parse(doc.fields.data.stringValue) : { slots: {} };
    const local = SaveGame.all();
    const allSynced = this.synced(), synced = allSynced[uid] || {};
    const merged = { last: local.last || cloud.last || null, slots: {} };
    const lines = [], conflicts = [];
    let downloaded = false;
    const version = s => (s && s.savedAt) || 0;
    for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
      const here = local.slots[slot], there = cloud.slots[slot], base = synced[slot] || 0;
      const keep = (side) => {
        if (side === 'cloud') {
          merged.slots[slot] = there;
          if (version(here) !== version(there)) downloaded = true;
          lines.push(`Slot ${slot}: brought from the cloud: ${this.describe(there)}`);
        } else {
          merged.slots[slot] = here;
          lines.push(`Slot ${slot}: sent to the cloud: ${this.describe(here)}`);
        }
      };
      if (!here && !there) { lines.push(`Slot ${slot}: empty`); continue; }
      if (version(here) === version(there)) { merged.slots[slot] = here; lines.push(`Slot ${slot}: already the same: ${this.describe(here)}`); continue; }
      if (!there) keep('device');
      else if (!here) keep('cloud');
      else if (version(here) === base) keep('cloud');      // only the cloud has changed
      else if (version(there) === base) keep('device');    // only this device has changed
      else if (choices[slot]) keep(choices[slot]);          // both changed: the player chose
      else conflicts.push({ slot, device: this.describe(here), cloud: this.describe(there) });
    }
    if (conflicts.length) return { conflicts };
    // the profile (avatar, name, User ID): the one changed last
    const mine = Profile.get(), theirs = cloud.profile;
    merged.profile = !theirs || (mine && (mine.updatedAt || 0) >= (theirs.updatedAt || 0)) ? mine : theirs;
    if (merged.profile && merged.profile !== mine) Profile.save(merged.profile, false);
    // the device's saves are kept as they were, in case a sync replaced the wrong one
    if (downloaded) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), saves: local })); } catch (e) { /* no room */ }
    }
    await this.db(`/saves/${uid}?updateMask.fieldPaths=data&updateMask.fieldPaths=updated`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(merged) }, updated: { timestampValue: new Date().toISOString() } } }),
    });
    SaveGame.write({ last: merged.last, slots: merged.slots });
    allSynced[uid] = Object.fromEntries(Object.entries(merged.slots).map(([slot, s]) => [slot, version(s)]));
    try { localStorage.setItem(SYNCED_KEY, JSON.stringify(allSynced)); } catch (e) { /* not kept: the next sync asks */ }
    return { lines };
  },

  // The saves this device had before the last sync that replaced any of them.
  backup() {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch (e) { return null; }
  },

  // Puts those saves back on this device (the next sync then sends them on, or asks).
  restoreBackup() {
    const b = this.backup();
    if (!b) return false;
    const now = Date.now();
    // stamped as changed now, so the next sync treats them as this device's newest
    for (const s of Object.values(b.saves.slots || {})) if (s) s.savedAt = now;
    SaveGame.write(b.saves);
    return true;
  },
};
