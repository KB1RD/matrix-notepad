import chai from 'chai'
import { LogootPosition, Document } from '../dist/logootish-js.js'

chai.expect()

const expect = chai.expect

describe('LogootPosition', () => {
  it('should default to [0]', () => {
    const pos = new LogootPosition()
    expect(pos.levels).to.be.equal(0)
    expect(pos.level(0).js_int).to.be.equal(0)
  })

  describe('offsets, levels=0', () => {
    it('should return new position with positive offset', () => {
      const pos = new LogootPosition()
      const pos2 = pos.offsetLowest(1)
      expect(pos2.levels).to.be.equal(0)
      expect(pos2.level(0).js_int).to.be.equal(1)
      expect(pos.level(0).js_int).to.be.equal(0)
    })
    it('should return new position with negative offset', () => {
      const pos = new LogootPosition()
      const pos2 = pos.inverseOffsetLowest(1)
      expect(pos2.levels).to.be.equal(0)
      expect(pos2.level(0).js_int).to.be.equal(-1)
      expect(pos.level(0).js_int).to.be.equal(0)
    })
  })

  describe('creation', () => {
    it('should allocate after position correctly', () => {
      const pos = new LogootPosition().offsetLowest(1)
      const pos2 = new LogootPosition(1, pos)
      expect(pos2.levels).to.be.equal(0)
      expect(pos2.level(0).js_int).to.be.equal(1)
    })
    it('should allocate before position correctly', () => {
      const pos = new LogootPosition().offsetLowest(1)
      const pos2 = new LogootPosition(2, undefined, pos)
      expect(pos2.levels).to.be.equal(0)
      expect(pos2.level(0).js_int).to.be.equal(-1)
    })
    describe('between-node allocation', () => {
      it('should allocate more levels than just 2', () => {
        const pos = new LogootPosition().offsetLowest(1)
        const pos2 = pos.offsetLowest(1)
        const pos3 = new LogootPosition(2, pos, pos2).offsetLowest(2)
        const pos4 = new LogootPosition(1, pos3, pos3)
        expect(pos4.levels).to.be.equal(2)
        expect(pos4.level(0).js_int).to.be.equal(1)
        expect(pos4.level(1).js_int).to.be.equal(2)
        expect(pos4.level(2).js_int).to.be.equal(0)
      })
    })
  })

  describe('offsets, more levels', () => {
    it('should return new position with positive offset', () => {
      const pos = new LogootPosition(1, new LogootPosition(), new LogootPosition())
      const pos2 = pos.offsetLowest(1)
      expect(pos2.levels).to.be.equal(1)
      expect(pos2.level(0).js_int).to.be.equal(0)
      expect(pos2.level(1).js_int).to.be.equal(1)
    })
    it('should return new position with negative offset', () => {
      const pos = new LogootPosition(1, new LogootPosition(), new LogootPosition())
      const pos2 = pos.inverseOffsetLowest(1)
      expect(pos2.levels).to.be.equal(1)
      expect(pos2.level(0).js_int).to.be.equal(0)
      expect(pos2.level(1).js_int).to.be.equal(-1)
    })
  })

  describe('creation', () => {
    it('should allocate after position correctly', () => {
      const pos = new LogootPosition(1, new LogootPosition(), new LogootPosition())
      const pos2 = new LogootPosition(1, pos)
      expect(pos2.levels).to.be.equal(1)
      expect(pos2.level(0).js_int).to.be.equal(0)
      expect(pos2.level(1).js_int).to.be.equal(0)
    })
    it('should allocate before position correctly', () => {
      const pos = new LogootPosition(1, new LogootPosition(), new LogootPosition())
      const pos2 = new LogootPosition(1, undefined, pos)
      expect(pos2.levels).to.be.equal(1)
      expect(pos2.level(0).js_int).to.be.equal(0)
      expect(pos2.level(1).js_int).to.be.equal(-1)
    })
    describe('between-node allocation', () => {
      it('should allocate more levels than just 2', () => {
        const pos = new LogootPosition().offsetLowest(1)
        const pos2 = pos.offsetLowest(1)
        const pos3 = new LogootPosition(2, pos, pos2).offsetLowest(2)
        const pos4 = new LogootPosition(1, pos3, pos3)
        expect(pos4.levels).to.be.equal(2)
        expect(pos4.level(0).js_int).to.be.equal(1)
        expect(pos4.level(1).js_int).to.be.equal(2)
        expect(pos4.level(2).js_int).to.be.equal(0)
      })
    })
  })
})
