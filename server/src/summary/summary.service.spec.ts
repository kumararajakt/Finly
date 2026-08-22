import { SummaryService } from './summary.service';

const USER_ID = 'user-1';

function makeSelectChain(rows: unknown[]) {
  const then = (
    resolve: (value: unknown[]) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(rows).then(resolve, reject);
  const chain = {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => Promise.resolve(rows)),
        limit: jest.fn(() => Promise.resolve(rows)),
        then,
      })),
      orderBy: jest.fn(() => Promise.resolve(rows)),
    })),
    where: jest.fn(() => ({
      orderBy: jest.fn(() => Promise.resolve(rows)),
      limit: jest.fn(() => Promise.resolve(rows)),
      then,
    })),
    limit: jest.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function dbMock() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeService(
  db: ReturnType<typeof dbMock>,
  opts: {
    netWorthAdjustment?: number;
    getPositions?: jest.Mock;
  } = {},
) {
  return new SummaryService(
    db as never,
    {
      getAll: jest.fn().mockResolvedValue({
        selectedPeriod: 'all-time',
        customDateFrom: null,
        customDateTo: null,
        netWorthAdjustment: opts.netWorthAdjustment ?? 0,
      }),
    } as never,
    {
      getSuggestions: jest.fn().mockResolvedValue([]),
    } as never,
    {
      getPositions: opts.getPositions ?? jest.fn().mockResolvedValue([]),
    } as never,
  );
}

function wireSelects(db: ReturnType<typeof dbMock>, rowsArrays: unknown[][]) {
  let callIndex = 0;
  db.select.mockImplementation(() => {
    const rows = rowsArrays[callIndex] ?? [];
    callIndex++;
    return makeSelectChain(rows);
  });
}

describe('SummaryService — net worth', () => {
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
  });

  // getSummary does 5 select() calls in order:
  // 1. transactions (for getSummary's own income/spending/cashflow)
  // 2. accounts (computeNetWorth)
  // 3. transactions (computeNetWorth)
  // 4. recurring
  // 5. subscriptions

  it('computes cash balance from income and expense transactions', async () => {
    const accounts = [{ name: 'Savings', type: 'cash' }];
    const netWorthTx = [
      { type: 'income', fromAccount: 'Savings', toAccount: null, amount: 5000 },
      {
        type: 'expense',
        fromAccount: 'Savings',
        toAccount: null,
        amount: 2000,
      },
    ];
    // select 1: getSummary tx (empty to avoid buildBuckets complexity)
    // select 2: accounts
    // select 3: computeNetWorth tx
    // select 4: recurring
    // select 5: subscriptions
    wireSelects(db, [[], accounts, netWorthTx, [], []]);

    const service = makeService(db);
    const summary = await service.getSummary(USER_ID);

    expect(summary.netWorthBreakdown.cash).toBe(3000);
    expect(summary.netWorth).toBe(3000);
  });

  it('computes transfer as two-leg: deducts from source, adds to destination', async () => {
    const accounts = [
      { name: 'Savings', type: 'cash' },
      { name: 'Checking', type: 'cash' },
    ];
    const txRows = [
      {
        type: 'transfer',
        fromAccount: 'Savings',
        toAccount: 'Checking',
        amount: 1000,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db);
    const summary = await service.getSummary(USER_ID);

    // Savings: -1000, Checking: +1000 => total cash = 0
    expect(summary.netWorthBreakdown.cash).toBe(0);
  });

  it('computes investment buy as two-leg: deducts from funding, adds to investment account', async () => {
    const accounts = [
      { name: 'Savings', type: 'cash' },
      { name: 'Investment', type: 'investment' },
    ];
    const txRows = [
      {
        type: 'investment',
        fromAccount: 'Savings',
        toAccount: 'Investment',
        amount: 25000,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db, {
      getPositions: jest.fn().mockResolvedValue([
        {
          security: 'RELIANCE.NS',
          units: 10,
          costBasis: 25000,
          marketValue: 28000,
        },
      ]),
    });

    const summary = await service.getSummary(USER_ID);

    // Cash: Savings -25000 = -25000
    expect(summary.netWorthBreakdown.cash).toBe(-25000);
    // Investments: marketValue used
    expect(summary.netWorthBreakdown.investments).toBe(28000);
    // Net worth: -25000 + 28000 = 3000
    expect(summary.netWorth).toBe(3000);
  });

  it('computes credit outstanding from negative credit account balance', async () => {
    const accounts = [{ name: 'Credit Card', type: 'credit' }];
    const txRows = [
      {
        type: 'expense',
        fromAccount: 'Credit Card',
        toAccount: null,
        amount: 5000,
      },
      {
        type: 'income',
        fromAccount: 'Credit Card',
        toAccount: null,
        amount: 2000,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db);
    const summary = await service.getSummary(USER_ID);

    // Credit Card balance: +2000 - 5000 = -3000, outstanding = max(0, -(-3000)) = 3000
    expect(summary.netWorthBreakdown.credit).toBe(3000);
  });

  it('adds netWorthAdjustment from settings as other bucket', async () => {
    const accounts = [{ name: 'Savings', type: 'cash' }];
    wireSelects(db, [[], accounts, [], [], []]);

    const service = makeService(db, { netWorthAdjustment: 50000 });
    const summary = await service.getSummary(USER_ID);

    expect(summary.netWorthBreakdown.other).toBe(50000);
    expect(summary.netWorth).toBe(50000);
  });

  it('combines cash, investments, credit, and other into net worth', async () => {
    const accounts = [
      { name: 'Savings', type: 'cash' },
      { name: 'Credit Card', type: 'credit' },
    ];
    const txRows = [
      {
        type: 'income',
        fromAccount: 'Savings',
        toAccount: null,
        amount: 10000,
      },
      {
        type: 'expense',
        fromAccount: 'Savings',
        toAccount: null,
        amount: 3000,
      },
      {
        type: 'expense',
        fromAccount: 'Credit Card',
        toAccount: null,
        amount: 2000,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db, {
      netWorthAdjustment: 10000,
      getPositions: jest.fn().mockResolvedValue([
        {
          security: 'TCS',
          units: 5,
          costBasis: 15000,
          marketValue: 18000,
        },
      ]),
    });

    const summary = await service.getSummary(USER_ID);

    // Cash: Savings = 10000 - 3000 = 7000
    expect(summary.netWorthBreakdown.cash).toBe(7000);
    // Investments: 18000
    expect(summary.netWorthBreakdown.investments).toBe(18000);
    // Credit: Credit Card balance = -2000, outstanding = 2000
    expect(summary.netWorthBreakdown.credit).toBe(2000);
    // Other: 10000
    expect(summary.netWorthBreakdown.other).toBe(10000);
    // Net worth: 7000 + 18000 + 2000 + 10000 = 37000
    expect(summary.netWorth).toBe(37000);
  });

  it('falls back to costBasis when marketValue is null for investments', async () => {
    const accounts = [{ name: 'Investment', type: 'investment' }];
    wireSelects(db, [[], accounts, [], [], []]);

    const service = makeService(db, {
      getPositions: jest.fn().mockResolvedValue([
        {
          security: 'RELIANCE.NS',
          units: 10,
          costBasis: 20000,
          marketValue: null,
        },
      ]),
    });

    const summary = await service.getSummary(USER_ID);

    // Uses costBasis when marketValue is null
    expect(summary.netWorthBreakdown.investments).toBe(20000);
  });

  it('handles multiple transfers between accounts', async () => {
    const accounts = [
      { name: 'Savings', type: 'cash' },
      { name: 'Checking', type: 'cash' },
      { name: 'Wallet', type: 'cash' },
    ];
    const txRows = [
      {
        type: 'transfer',
        fromAccount: 'Savings',
        toAccount: 'Checking',
        amount: 5000,
      },
      {
        type: 'transfer',
        fromAccount: 'Checking',
        toAccount: 'Wallet',
        amount: 1000,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db);
    const summary = await service.getSummary(USER_ID);

    // Savings: -5000, Checking: +5000 - 1000 = 4000, Wallet: +1000
    expect(summary.netWorthBreakdown.cash).toBe(0);
  });

  it('investment sell reduces investment balance via fromAccount', async () => {
    const accounts = [
      { name: 'Savings', type: 'cash' },
      { name: 'Investment', type: 'investment' },
    ];
    const txRows = [
      {
        type: 'investment',
        fromAccount: 'Savings',
        toAccount: 'Investment',
        amount: 25000,
      },
      {
        type: 'investment',
        fromAccount: 'Investment',
        toAccount: 'Savings',
        amount: 12500,
      },
    ];
    wireSelects(db, [[], accounts, txRows, [], []]);

    const service = makeService(db, {
      getPositions: jest.fn().mockResolvedValue([
        {
          security: 'RELIANCE.NS',
          units: 5,
          costBasis: 10000,
          marketValue: 14000,
        },
      ]),
    });

    const summary = await service.getSummary(USER_ID);

    // Savings: -25000 + 12500 = -12500
    expect(summary.netWorthBreakdown.cash).toBe(-12500);
    // Investments: marketValue = 14000
    expect(summary.netWorthBreakdown.investments).toBe(14000);
    // Net worth: -12500 + 14000 = 1500
    expect(summary.netWorth).toBe(1500);
  });
});
