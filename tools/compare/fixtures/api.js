/**
 * Minimal mocked Fineract API used by the comparator harness. Only the
 * endpoints the login/home shell touches get a meaningful payload; everything
 * else gets an empty list/object so the UI renders deterministically offline.
 */
const credentials = {
  username: 'mifos',
  userId: 1,
  base64EncodedAuthenticationKey: 'bWlmb3M6cGFzc3dvcmQ=',
  authenticated: true,
  officeId: 1,
  officeName: 'Head Office',
  roles: [{ id: 1, name: 'Super user', description: 'This role provides all application permissions.' }],
  permissions: ['ALL_FUNCTIONS'],
  shouldRenewPassword: false,
  isTwoFactorAuthenticationRequired: false
};

const offices = [
  { id: 1, name: 'Head Office', nameDecorated: 'Head Office', externalId: '1', openingDate: [2009, 1, 1], hierarchy: '.' }
];

const trend = [
  { day: '2024-01-01', count: 1, amount: 100 },
  { day: '2024-01-02', count: 2, amount: 200 }
];

const runReport = {
  columnHeaders: [
    { columnName: 'Series', columnType: 'STRING' },
    { columnName: 'Value', columnType: 'DECIMAL' }
  ],
  data: trend.map((t) => ({ row: [t.day, t.amount] }))
};

function respond(method, apiPath, params) {
  if (apiPath === '/authentication' && method === 'POST') return credentials;
  if (apiPath === '/userdetails') return credentials;
  if (apiPath === '/offices') return offices;
  if (apiPath.startsWith('/runreports/')) return runReport;
  if (apiPath === '/notifications') return { pageItems: [], totalFilteredRecords: 0 };
  if (apiPath === '/search' || apiPath === '/clients') return { pageItems: [], totalFilteredRecords: 0 };
  if (apiPath.startsWith('/configurations')) return { globalConfiguration: [] };
  if (apiPath.startsWith('/currencies')) return { selectedCurrencyOptions: [] };
  if (apiPath.startsWith('/actuator')) return { git: { build: { version: '1.9.0-abc1234' }, commit: { id: 'abc1234' } } };
  if (apiPath.startsWith('/jobs')) return [];
  if (apiPath === '/loans/catch-up' || apiPath.includes('catch-up')) return { isCatchUpRunning: false };
  if (apiPath.startsWith('/twofactor')) return [];
  return method === 'GET' ? [] : {};
}

module.exports = { respond, credentials };
