// The player's profile: an avatar (one of the game's characters), a name and
// a User ID. It is made the first time the game starts, kept on this device,
// and, once the player signs in, linked to their email account and synced
// with their saves (see Cloud). The User ID is what a friend will use to find
// them for multiplayer.

const PROFILE_KEY = 'streetBites.profile';
// characters a player can pick as their avatar (their "<name>_front" picture)
const AVATARS = ['waiter', 'chef', 'cashier', 'greeter', 'cleaner',
  'customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6'];

const Profile = {
  get() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) { return null; }
  },

  // Keeps the profile; `touch` marks it as changed now (so syncing sends it on).
  save(profile, touch = true) {
    const p = touch ? { ...profile, updatedAt: Date.now() } : profile;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* not kept */ }
    return p;
  },

  create(name, avatar) {
    return this.save({ id: this.newId(), name, avatar });
  },

  // A User ID that's easy to read out and type: SB-XXXX-XXXX (no 0/O or 1/I to mix up).
  newId() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', pick = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(pick);
    const s = [...pick].map(n => letters[n % letters.length]).join('');
    return `SB-${s.slice(0, 4)}-${s.slice(4)}`;
  },

  // Links the profile to a signed-in account. If the account already has a
  // profile (made on another device), that one is used here too.
  link(cloudProfile, uid, email) {
    if (cloudProfile && cloudProfile.id) return this.save({ ...cloudProfile, uid, email }, false);
    const mine = this.get();
    return mine ? this.save({ ...mine, uid, email }) : null;
  },
};
