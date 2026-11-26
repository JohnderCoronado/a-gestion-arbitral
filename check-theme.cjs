const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('dist/theme.js', 'utf8');

function session(storage = new Map(), blocked = false) {
  const meta = {};
  const root = {dataset: {}, style: {}};
  const context = {
    document: {documentElement: root, querySelector: () => ({setAttribute: (key,value) => {meta[key] = value;}})},
    window: {},
    localStorage: {
      getItem(key) {if (blocked) throw Error('Storage blocked'); return storage.get(key) || null;},
      setItem(key,value) {if (blocked) throw Error('Storage blocked'); storage.set(key,value);}
    }
  };
  vm.runInNewContext(source, context);
  return {theme:context.window.ATheme, root, meta, storage};
}

const first = session();
assert.equal(first.theme.get(), 'dark');
assert.equal(first.root.style.colorScheme, 'dark');
assert.equal(first.meta.content, '#101722');
assert.equal(first.theme.toggle(), true);
assert.equal(first.theme.get(), 'light');
assert.equal(session(first.storage).theme.get(), 'light');
assert.equal(first.meta.content, '#f5f6f8');
first.theme.toggle();
assert.equal(session(first.storage).theme.get(), 'dark');
assert.equal(session(new Map([['a-interface-theme','invalid']])).theme.get(), 'dark');
const blocked = session(new Map(), true);
assert.equal(blocked.theme.toggle(), false);
assert.equal(blocked.theme.get(), 'light');
const data = new Map([['arbitra-beta-v1','saved demo records']]);
session(data).theme.toggle();
assert.equal(data.get('arbitra-beta-v1'), 'saved demo records');
console.log('Theme verified: dark default, light and dark persistence, browser control appearance, metadata, invalid preference, blocked storage and independent demo records.');
