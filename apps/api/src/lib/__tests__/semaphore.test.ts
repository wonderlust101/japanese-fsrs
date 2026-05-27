import { describe, it, expect } from 'bun:test'

import { Semaphore } from '../semaphore.ts'

// Phase 4 — edge-case & determinism matrix, the concurrency / cancellation cell.
// The Semaphore is the bulkhead in front of OpenAI (`openaiSemaphore`): it caps
// in-flight calls and is meant to drop a queued waiter when the originating
// request's `AbortSignal` fires (client disconnect). That cancellation path had
// no coverage. These tests are deterministic — they drive admission, FIFO
// ordering, and abort cleanup directly, with no timers or network.

describe('Semaphore — slot admission and FIFO ordering', () => {
  it('grants up to `max` slots immediately, then queues the next caller until a release', async () => {
    const sem = new Semaphore({ max: 2, label: 'test' })
    const r1 = await sem.acquire()
    const r2 = await sem.acquire()

    // The third caller has no slot — its acquire stays pending.
    let thirdGranted = false
    const third = sem.acquire().then((rel) => { thirdGranted = true; return rel })
    await Promise.resolve() // flush microtasks: a wrongly-synchronous grant would flip the flag
    expect(thirdGranted).toBe(false)

    // Releasing one slot hands it to the queued waiter (FIFO).
    r1()
    const r3 = await third
    expect(thirdGranted).toBe(true)

    r2(); r3()
  })
})

describe('Semaphore — AbortSignal cancellation', () => {
  it('rejects a queued acquire whose signal is already aborted, without ever running the work', async () => {
    const sem = new Semaphore({ max: 1, label: 'test' })
    const held = await sem.acquire() // saturate the single slot

    const ac = new AbortController()
    ac.abort(new Error('client gone'))

    let ran = false
    const p = sem.run({ signal: ac.signal }, async () => { ran = true; return 'x' })

    await expect(p).rejects.toThrow('client gone')
    expect(ran).toBe(false) // short-circuited at acquire, before fn

    held()
  })

  it('dequeues and rejects a waiter when its signal aborts mid-wait, leaving the slot for the next caller', async () => {
    const sem = new Semaphore({ max: 1, label: 'test' })
    const held = await sem.acquire()

    const ac = new AbortController()
    const aborting = sem.acquire({ signal: ac.signal }) // queues first

    // A second, signal-less waiter queues behind the abortable one.
    let secondGranted = false
    const second = sem.acquire().then((rel) => { secondGranted = true; return rel })

    ac.abort(new Error('aborted mid-wait'))
    await expect(aborting).rejects.toThrow('aborted mid-wait')

    // The aborted waiter spliced itself out of the queue. Releasing the held
    // slot must therefore hand it to the SECOND waiter — proving the removal
    // didn't corrupt the queue or strand the freed slot.
    expect(secondGranted).toBe(false)
    held()
    const rel = await second
    expect(secondGranted).toBe(true)
    rel()
  })

  it('runs immediately on a free slot even with an aborted signal (cancellation gates queued waiters, not idle admission)', async () => {
    // The bulkhead exists to shed *queued* work when a client disconnects; a
    // slot that is free is granted without consulting the signal. Pinning this
    // documents the boundary so a future change to admission is a conscious one.
    const sem = new Semaphore({ max: 1, label: 'test' })
    const ac = new AbortController()
    ac.abort()

    let ran = false
    await sem.run({ signal: ac.signal }, async () => { ran = true })
    expect(ran).toBe(true)
  })
})

describe('Semaphore — run() release semantics', () => {
  it('releases the slot even when the work throws, so the next caller proceeds', async () => {
    const sem = new Semaphore({ max: 1, label: 'test' })

    await expect(sem.run(undefined, async () => { throw new Error('boom') }))
      .rejects.toThrow('boom')

    // If the finally-release regressed, this second run would deadlock (never
    // resolve) because the only slot would still be held by the thrown call.
    let granted = false
    await sem.run(undefined, async () => { granted = true })
    expect(granted).toBe(true)
  })
})
