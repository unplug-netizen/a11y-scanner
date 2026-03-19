import { BrowserPool } from '../lib/browser-pool';

// Mock puppeteer
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn().mockResolvedValue(undefined),
        addScriptTag: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockImplementation(() => {
          return Promise.resolve({
            violations: [],
            passes: [],
            incomplete: [],
            inapplicable: [],
          });
        }),
        deleteCookie: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        url: jest.fn().mockReturnValue('https://example.com'),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@sparticuz/chromium', () => ({
  executablePath: jest.fn().mockResolvedValue('/mock/chromium'),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock axe content'),
  existsSync: jest.fn().mockReturnValue(true),
}));

describe('BrowserPool', () => {
  let pool: BrowserPool;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = new BrowserPool({ maxPages: 3 });
  });

  describe('initialization', () => {
    it('should initialize with correct config', () => {
      expect(pool).toBeDefined();
    });

    it('should use default config when not provided', () => {
      const defaultPool = new BrowserPool();
      expect(defaultPool).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = pool.getStats();
      expect(stats).toEqual({
        totalPages: 0,
        inUse: 0,
        idle: 0,
      });
    });
  });

  describe('scanPage', () => {
    it('should scan a page and return results', async () => {
      const result = await pool.scanPage('https://example.com');
      
      expect(result).toHaveProperty('url', 'https://example.com');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(result).toHaveProperty('inapplicable');
      expect(result).toHaveProperty('scanTimeMs');
    });
  });
});

describe('BrowserPool Singleton', () => {
  it('should create singleton instance', async () => {
    const { getBrowserPool } = await import('../lib/browser-pool');
    const pool1 = getBrowserPool();
    const pool2 = getBrowserPool();
    expect(pool1).toBe(pool2);
  });
});
