import { Config } from '../../src/core/Config';

describe('Config', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    (Config as any).instance = undefined;
  });

  describe('singleton pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = Config.getInstance();
      const instance2 = Config.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should always return the same instance', () => {
      const instances: Config[] = [];
      
      for (let i = 0; i < 5; i++) {
        instances.push(Config.getInstance());
      }
      
      const first = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(first);
      });
    });
  });

  describe('default configuration', () => {
    it('should have default world configuration', () => {
      const config = Config.getInstance();
      
      expect(config.world.width).toBe(1000);
      expect(config.world.height).toBe(1000);
      expect(config.world.chunkSize).toBe(64);
    });

    it('should have default action costs', () => {
      const config = Config.getInstance();
      
      expect(config.actions.MOVE).toBe(100);
      expect(config.actions.ATTACK).toBe(100);
      expect(config.actions.CRAFT).toBe(300);
      expect(config.actions.WAIT).toBe(50);
      expect(config.actions.PICKUP).toBe(50);
      expect(config.actions.DROP).toBe(25);
    });

    it('should have debug flag default to false', () => {
      const config = Config.getInstance();
      
      expect(config.debug).toBe(false);
    });

    it('should expose world defaults', () => {
      const config = Config.getInstance();
      
      expect(config.world.chunkCount).toEqual({ x: 16, y: 16 });
      expect(config.world.maxActiveChunks).toBe(9);
      expect(config.world.fullUpdateDistance).toBe(1);
    });

    it('should have course update schedule', () => {
      const config = Config.getInstance();
      
      expect(config.world.courseUpdateSchedule).toHaveLength(3);
      expect(config.world.courseUpdateSchedule[0]).toEqual({
        minDist: 2,
        maxDist: 3,
        interval: 5
      });
    });
  });

  describe('debug flag', () => {
    it('should get debug flag value', () => {
      const config = Config.getInstance();
      
      const value = config.debug;
      
      expect(typeof value).toBe('boolean');
    });

    it('should set debug flag to true', () => {
      const config = Config.getInstance();
      
      config.debug = true;
      
      expect(config.debug).toBe(true);
    });

    it('should set debug flag to false', () => {
      const config = Config.getInstance();
      
      config.debug = true;
      config.debug = false;
      
      expect(config.debug).toBe(false);
    });

    it('should persist debug flag across singleton access', () => {
      const config1 = Config.getInstance();
      config1.debug = true;
      
      const config2 = Config.getInstance();
      
      expect(config2.debug).toBe(true);
    });
  });

  describe('immutability of configuration', () => {
    it('should return world configuration', () => {
      const config = Config.getInstance();
      
      expect(config.world).toBeDefined();
      expect(config.world.width).toBe(1000);
    });

    it('should return actions configuration', () => {
      const config = Config.getInstance();
      
      expect(config.actions).toBeDefined();
      expect(config.actions.MOVE).toBe(100);
    });
  });
});
