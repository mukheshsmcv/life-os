// mock AsyncStorage for test
global.AsyncStorage = {
  store: {},
  getItem: async (key) => global.AsyncStorage.store[key] || null,
  setItem: async (key, val) => { global.AsyncStorage.store[key] = val; }
};

jest = { mock: () => {} };

require('ts-node').register({ transpileOnly: true });

const { loadMessengerStorageState, saveMessengerStorageState } = require('../src/lib/storage/messenger-storage');

async function runTest() {
  console.log('--- STARTING MESSENGER STORAGE TESTS ---');
  let passed = 0;
  let failed = 0;

  try {
    const emptyLoad = await loadMessengerStorageState();
    if (emptyLoad === null) passed++; else failed++;
    
    const convs = [{
      id: 'c1', type: 'direct', participantIds: ['u1', 'u2'], createdAt: 1, updatedAt: 1
    }];
    const msgs = [{
      id: 'm1', conversationId: 'c1', senderId: 'u1', text: 'hello', createdAt: 1
    }];
    
    const saveRes = await saveMessengerStorageState(convs, msgs);
    if (saveRes) passed++; else failed++;

    const loadRes = await loadMessengerStorageState();
    if (loadRes && loadRes.conversations.length === 1 && loadRes.messages.length === 1) passed++; else failed++;

    console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  } catch (e) {
    console.error('Test script failed:', e);
  }
}

runTest();
