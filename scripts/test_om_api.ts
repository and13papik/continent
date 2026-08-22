import fetch from 'node-fetch';

async function testOnlyMonster() {
  const token = "om_token_3f1262d1fa72d55bf9c52995576ca3fdff05815013b31b3da8dd97862140f63d";
  const baseUrl = "https://omapi.onlymonster.ai/api/v0";

  console.log('--- 1. Fetching accounts from OM API with x-om-auth-token ---');
  const accRes = await fetch(`${baseUrl}/accounts`, {
    headers: { 
      'Content-Type': 'application/json',
      'x-om-auth-token': token 
    }
  });
  console.log('Accounts HTTP status:', accRes.status);
  const accData: any = await accRes.json();
  
  const accounts = accData.data || accData.accounts || (Array.isArray(accData) ? accData : []);
  console.log(`Discovered ${accounts.length} accounts:`);
  accounts.forEach((a: any) => {
    console.log(`- ID: ${a.id}, Platform ID: ${a.platform_account_id || a.platform_id || a.user_id}, Name: ${a.name || a.username}`);
  });

  const mermaid = accounts.find((a: any) => (a.name || '').toLowerCase().includes('mermaid') || (a.username || '').toLowerCase().includes('mermaid'));
  console.log('\n--- Mermaid Account details ---');
  console.log(mermaid);

  // Also check if there are webhooks registered or if we can fetch webhook list
  console.log('\n--- 2. Fetching webhooks from OM API ---');
  const whRes = await fetch(`${baseUrl}/webhooks`, {
    headers: { 'x-om-auth-token': token }
  });
  console.log('Webhooks HTTP status:', whRes.status);
  const whData: any = await whRes.json();
  console.log('Webhooks list:', JSON.stringify(whData, null, 2));
}

testOnlyMonster().catch(console.error);
