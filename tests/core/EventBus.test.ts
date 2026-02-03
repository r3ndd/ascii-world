import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('event registration', () => {
    it('should register an event handler', () => {
      const handler = jest.fn();
      
      eventBus.on('test:event', handler);
      eventBus.emit('test:event', { data: 'value' });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });

    it('should register multiple handlers for the same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      eventBus.emit('test:event', {});
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should register handlers for different events', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('event:a', handler1);
      eventBus.on('event:b', handler2);
      eventBus.emit('event:a', {});
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should return an unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.on('test:event', handler);
      
      unsubscribe();
      eventBus.emit('test:event', {});
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('event emission', () => {
    it('should emit events with data', () => {
      const handler = jest.fn();
      const eventData = { foo: 'bar', number: 42 };
      
      eventBus.on('test:event', handler);
      eventBus.emit('test:event', eventData);
      
      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should emit events with complex data types', () => {
      const handler = jest.fn();
      const complexData = {
        nested: { value: 123 },
        array: [1, 2, 3],
        callback: () => 'test',
      };
      
      eventBus.on('test:event', handler);
      eventBus.emit('test:event', complexData);
      
      expect(handler).toHaveBeenCalledWith(complexData);
    });

    it('should not throw when emitting events with no handlers', () => {
      expect(() => {
        eventBus.emit('nonexistent:event', {});
      }).not.toThrow();
    });

    it('should emit multiple times for multiple emissions', () => {
      const handler = jest.fn();
      
      eventBus.on('test:event', handler);
      eventBus.emit('test:event', { count: 1 });
      eventBus.emit('test:event', { count: 2 });
      eventBus.emit('test:event', { count: 3 });
      
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('event unsubscription', () => {
    it('should remove specific handler using off method', () => {
      const handler = jest.fn();
      
      eventBus.on('test:event', handler);
      eventBus.off('test:event', handler);
      eventBus.emit('test:event', {});
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other handlers when unsubscribing one', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('test:event', handler1);
      eventBus.on('test:event', handler2);
      eventBus.off('test:event', handler1);
      eventBus.emit('test:event', {});
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should safely handle unsubscribing non-existent handler', () => {
      const handler = jest.fn();
      
      expect(() => {
        eventBus.off('test:event', handler);
      }).not.toThrow();
    });

    it('should safely handle unsubscribing from non-existent event', () => {
      const handler = jest.fn();
      
      expect(() => {
        eventBus.off('nonexistent:event', handler);
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.on('event:a', handler1);
      eventBus.on('event:b', handler2);
      eventBus.clear();
      
      eventBus.emit('event:a', {});
      eventBus.emit('event:b', {});
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should allow re-registration after clear', () => {
      const handler = jest.fn();
      
      eventBus.on('test:event', handler);
      eventBus.clear();
      eventBus.on('test:event', handler);
      eventBus.emit('test:event', {});
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler execution context', () => {
    it('should maintain handler execution order', () => {
      const order: number[] = [];
      
      eventBus.on('test:event', () => order.push(1));
      eventBus.on('test:event', () => order.push(2));
      eventBus.on('test:event', () => order.push(3));
      
      eventBus.emit('test:event', {});
      
      expect(order).toEqual([1, 2, 3]);
    });

    it('should allow handlers to access this context if bound', () => {
      const context = { value: 'test' };
      const handler = jest.fn(function(this: typeof context) {
        return this.value;
      });
      const boundHandler = handler.bind(context);
      
      eventBus.on('test:event', boundHandler);
      eventBus.emit('test:event', {});
      
      expect(handler).toHaveBeenCalled();
    });
  });
});
