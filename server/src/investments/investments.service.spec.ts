import { InvestmentsService } from './investments.service';

const USER_ID = 'user-1';
const ACCOUNT_ID = 'acc-inv-1';

function makeSelectChain(rows: unknown[]) {
  const orderBy = jest.fn(() => Promise.resolve(rows));
  const limit = jest.fn(() => Promise.resolve(rows));
  const where = jest.fn(() => ({ orderBy, limit }));
  const from = jest.fn(() => ({ where, orderBy }));
  return { from, where, orderBy, limit };
}

function dbMock() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
}

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
    service = new InvestmentsService(db as never);
  });

  describe('createTrade', () => {
    it('creates a buy trade', async () => {
      const tradeRow = {
        id: 'trade-1',
        accountId: ACCOUNT_ID,
        security: 'RELIANCE.NS',
        side: 'buy',
        units: 10,
        price: 2500,
        amount: 25000,
        fee: 20,
      };

      db.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValueOnce([tradeRow]),
        })),
      });

      const result = await service.createTrade(USER_ID, {
        accountId: ACCOUNT_ID,
        date: '2026-01-15',
        security: 'RELIANCE.NS',
        side: 'buy',
        units: 10,
        price: 2500,
        fee: 20,
      });

      expect(result).toEqual(tradeRow);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('computes amount as units * price rounded to 2 decimals', async () => {
      const tradeRow = { id: 'trade-5', amount: 3333.33 };

      db.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValueOnce([tradeRow]),
        })),
      });

      const result = await service.createTrade(USER_ID, {
        accountId: ACCOUNT_ID,
        date: '2026-05-01',
        security: 'ITC',
        side: 'buy',
        units: 10,
        price: 333.333,
      });

      expect(result.amount).toBe(3333.33);
    });

    it('defaults fee to 0 when not provided', async () => {
      const tradeRow = { id: 'trade-7', fee: 0 };

      let captured: { fee?: number } | undefined;
      db.insert.mockImplementationOnce(() => ({
        values: jest.fn((values: { fee?: number }) => {
          captured = values;
          return {
            returning: jest.fn().mockResolvedValue([tradeRow]),
          };
        }),
      }));

      await service.createTrade(USER_ID, {
        accountId: ACCOUNT_ID,
        date: '2026-07-01',
        security: 'TCS',
        side: 'buy',
        units: 5,
        price: 3000,
      });

      expect(captured?.fee).toBe(0);
    });
  });

  describe('deleteTrade', () => {
    it('deletes a trade owned by the user', async () => {
      db.delete.mockReturnValueOnce({
        where: jest.fn(() => ({
          returning: jest.fn().mockResolvedValueOnce([{ id: 'trade-1' }]),
        })),
      });

      await expect(
        service.deleteTrade(USER_ID, 'trade-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFound when the trade does not exist', async () => {
      db.delete.mockReturnValueOnce({
        where: jest.fn(() => ({
          returning: jest.fn().mockResolvedValueOnce([]),
        })),
      });

      await expect(service.deleteTrade(USER_ID, 'missing')).rejects.toThrow(
        'Trade not found.',
      );
    });
  });

  describe('getTrades', () => {
    it('returns all trades for the user', async () => {
      const rows = [
        { id: 't1', security: 'RELIANCE.NS', side: 'buy' },
        { id: 't2', security: 'TCS', side: 'sell' },
      ];
      db.select.mockReturnValue(makeSelectChain(rows));

      const result = await service.getTrades(USER_ID, {});
      expect(result).toEqual(rows);
    });

    it('filters by accountId when provided', async () => {
      const rows = [{ id: 't1', accountId: ACCOUNT_ID }];
      const chain = makeSelectChain(rows);
      db.select.mockReturnValue(chain);

      await service.getTrades(USER_ID, { accountId: ACCOUNT_ID });

      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });

    it('filters by security when provided', async () => {
      const rows = [{ id: 't1', security: 'RELIANCE.NS' }];
      const chain = makeSelectChain(rows);
      db.select.mockReturnValue(chain);

      await service.getTrades(USER_ID, { security: 'RELIANCE.NS' });

      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });

    it('applies orderBy descending on date and createdAt', async () => {
      const chain = makeSelectChain([]);
      db.select.mockReturnValue(chain);

      await service.getTrades(USER_ID, {});

      expect(chain.orderBy).toHaveBeenCalled();
    });
  });

  describe('getPositions', () => {
    it('computes AVCO from buy trades', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 5,
          price: 2400,
          amount: 12000,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].security).toBe('RELIANCE.NS');
      expect(positions[0].units).toBe(15);
      expect(positions[0].costBasis).toBe(32000);
      expect(positions[0].avgCost).toBeCloseTo(2133.3333, 3);
    });

    it('computes realized P/L on sell using AVCO', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 5,
          price: 2500,
          amount: 12500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].units).toBe(5);
      expect(positions[0].costBasis).toBe(10000);
      expect(positions[0].avgCost).toBe(2000);
    });

    it('returns empty positions when all units are sold', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 10,
          price: 2500,
          amount: 25000,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});
      expect(positions).toHaveLength(0);
    });

    it('includes current price from securities table', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
      ];
      const sec = { name: 'RELIANCE.NS', currentPrice: 2800 };

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([sec]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions[0].currentPrice).toBe(2800);
      expect(positions[0].marketValue).toBe(28000);
      expect(positions[0].unrealizedPL).toBe(8000);
    });

    it('returns null marketValue when no price is set', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions[0].currentPrice).toBeNull();
      expect(positions[0].marketValue).toBeNull();
      expect(positions[0].unrealizedPL).toBeNull();
    });

    it('includes dividend in realized P/L without affecting units', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'dividend',
          units: 0,
          price: 0,
          amount: 500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].units).toBe(10);
      expect(positions[0].costBasis).toBe(20000);
    });

    it('includes interest in realized P/L without affecting units', async () => {
      const trades = [
        {
          security: 'BANK-FD',
          side: 'buy',
          units: 1,
          price: 100000,
          amount: 100000,
          fee: 0,
        },
        {
          security: 'BANK-FD',
          side: 'interest',
          units: 0,
          price: 0,
          amount: 1200,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].units).toBe(1);
      expect(positions[0].costBasis).toBe(100000);
    });

    it('accounts for sell fees reducing proceeds', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 5,
          price: 2500,
          amount: 12500,
          fee: 100,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].units).toBe(5);
      expect(positions[0].costBasis).toBe(10000);
    });

    it('handles buy fees adding to cost basis', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 100,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].costBasis).toBe(20100);
      expect(positions[0].avgCost).toBeCloseTo(2010, 3);
    });

    it('handles multiple securities separately', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'TCS',
          side: 'buy',
          units: 5,
          price: 3000,
          amount: 15000,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(2);
      const reliance = positions.find((p) => p.security === 'RELIANCE.NS');
      const tcs = positions.find((p) => p.security === 'TCS');
      expect(reliance!.units).toBe(10);
      expect(reliance!.costBasis).toBe(20000);
      expect(tcs!.units).toBe(5);
      expect(tcs!.costBasis).toBe(15000);
    });

    it('handles partial sell with remaining cost basis', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 3,
          price: 2500,
          amount: 7500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});

      expect(positions).toHaveLength(1);
      expect(positions[0].units).toBe(7);
      expect(positions[0].costBasis).toBeCloseTo(14000, 2);
      expect(positions[0].avgCost).toBeCloseTo(2000, 3);
    });

    it('returns empty when all positions are fully sold across securities', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 10,
          price: 2500,
          amount: 25000,
          fee: 0,
        },
        {
          security: 'TCS',
          side: 'buy',
          units: 5,
          price: 3000,
          amount: 15000,
          fee: 0,
        },
        {
          security: 'TCS',
          side: 'sell',
          units: 5,
          price: 3500,
          amount: 17500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const positions = await service.getPositions(USER_ID, {});
      expect(positions).toHaveLength(0);
    });

    it('applies accountId filter when provided', async () => {
      const chain = makeSelectChain([]);
      db.select.mockReturnValueOnce(chain);
      db.select.mockReturnValueOnce(makeSelectChain([]));

      await service.getPositions(USER_ID, { accountId: ACCOUNT_ID });

      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });

    it('sorts positions by security then date ascending', async () => {
      const chain = makeSelectChain([]);
      db.select.mockReturnValueOnce(chain);
      db.select.mockReturnValueOnce(makeSelectChain([]));

      await service.getPositions(USER_ID, {});

      expect(chain.orderBy).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('computes total invested and realized P/L', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 10,
        },
        {
          security: 'RELIANCE.NS',
          side: 'sell',
          units: 5,
          price: 2500,
          amount: 12500,
          fee: 5,
        },
        {
          security: 'RELIANCE.NS',
          side: 'dividend',
          units: 0,
          price: 0,
          amount: 500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.totalInvested).toBe(20010);
      // avgCost = 20010/10 = 2001, costOfSold = 2001*5 = 10005
      // realized from sell = (12500 - 5) - 10005 = 2490
      // + dividend 500 = 2990
      expect(summary.realizedPL).toBe(2990);
    });

    it('computes market value and unrealized P/L when prices exist', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
      ];
      const sec = { name: 'RELIANCE.NS', currentPrice: 2800 };

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([sec]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.marketValue).toBe(28000);
      expect(summary.unrealizedPL).toBe(8000);
    });

    it('returns null marketValue when no prices are set', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.marketValue).toBeNull();
      expect(summary.unrealizedPL).toBeNull();
    });

    it('filters by accountId when provided', async () => {
      const chain = makeSelectChain([]);
      db.select.mockReturnValueOnce(chain);
      db.select.mockReturnValueOnce(makeSelectChain([]));

      await service.getSummary(USER_ID, ACCOUNT_ID);

      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });

    it('returns zero totals when there are no trades', async () => {
      db.select.mockReturnValueOnce(makeSelectChain([]));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.totalInvested).toBe(0);
      expect(summary.realizedPL).toBe(0);
      expect(summary.marketValue).toBeNull();
      expect(summary.unrealizedPL).toBeNull();
    });

    it('counts dividend as realized P/L', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'dividend',
          units: 0,
          price: 0,
          amount: 1500,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.totalInvested).toBe(0);
      expect(summary.realizedPL).toBe(1500);
    });

    it('counts interest as realized P/L', async () => {
      const trades = [
        {
          security: 'BANK-FD',
          side: 'interest',
          units: 0,
          price: 0,
          amount: 800,
          fee: 0,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.totalInvested).toBe(0);
      expect(summary.realizedPL).toBe(800);
    });

    it('adds buy fees to total invested', async () => {
      const trades = [
        {
          security: 'RELIANCE.NS',
          side: 'buy',
          units: 10,
          price: 2000,
          amount: 20000,
          fee: 50,
        },
      ];

      db.select.mockReturnValueOnce(makeSelectChain(trades));
      db.select.mockReturnValueOnce(makeSelectChain([]));

      const summary = await service.getSummary(USER_ID);

      expect(summary.totalInvested).toBe(20050);
    });
  });

  describe('updateSecurity', () => {
    it('inserts a new security price', async () => {
      db.select.mockReturnValueOnce(makeSelectChain([]));
      db.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          returning: jest
            .fn()
            .mockResolvedValueOnce([
              { name: 'RELIANCE.NS', currentPrice: 2800 },
            ]),
        })),
      });

      const result = await service.updateSecurity(USER_ID, 'RELIANCE.NS', {
        currentPrice: 2800,
      });

      expect(result).toEqual({ name: 'RELIANCE.NS', currentPrice: 2800 });
    });

    it('updates an existing security price', async () => {
      db.select.mockReturnValueOnce(
        makeSelectChain([{ name: 'RELIANCE.NS', currentPrice: 2500 }]),
      );
      db.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn().mockResolvedValue(undefined),
        })),
      });

      const result = await service.updateSecurity(USER_ID, 'RELIANCE.NS', {
        currentPrice: 2800,
      });

      expect(result).toEqual({ name: 'RELIANCE.NS', currentPrice: 2800 });
    });

    it('trims the security name', async () => {
      db.select.mockReturnValueOnce(makeSelectChain([]));
      db.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          returning: jest
            .fn()
            .mockResolvedValueOnce([
              { name: 'RELIANCE.NS', currentPrice: 2800 },
            ]),
        })),
      });

      const result = await service.updateSecurity(USER_ID, '  RELIANCE.NS  ', {
        currentPrice: 2800,
      });

      expect(result.name).toBe('RELIANCE.NS');
    });
  });
});
