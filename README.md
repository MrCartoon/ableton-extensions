# ableton-extensions

## Unsolved Crashes

```
Heartbeat failed: {
  error: TimeoutError: The command internal.get_prop({"prop":"ping"}) timed out after 3000 ms.
      at Timeout._onTimeout (C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:328:21)
      at listOnTimeout (node:internal/timers:569:17)
      at process.processTimers (node:internal/timers:512:7) {
    payload: {
      uuid: '3c24e7d0-e5b8-4250-b299-81b8811e562a',
      ns: 'internal',
      nsid: undefined,
      name: 'get_prop',
      args: [Object]
    }
  },
  canceled: false
}
Live disconnected { type: 'heartbeat' }
C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:328
                rej(new TimeoutError(`The command ${cls}.${command.name}(${arg}) timed out after ${timeout} ms.`, payload));
                    ^

TimeoutError: The command clip(live_3582581880).get_prop({"prop":"warp_markers"}) timed out after 3000 ms.
    at Timeout._onTimeout (C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:328:21)
    at listOnTimeout (node:internal/timers:569:17)
    at process.processTimers (node:internal/timers:512:7) {
  payload: {
    uuid: 'ab0481c3-9c1c-4971-891f-80b7f3a49e3c',
    ns: 'clip',
    nsid: 'live_3582581880',
    name: 'get_prop',
    args: { prop: 'warp_markers' }
  }
}

Node.js v18.20.4
```

```
C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:285
            return functionCallback.rej(new Error(data.data));
                                        ^

Error: Python argument types in
    None.None(Clip)
did not match C++ signature:
    None(class TPyHandle<class AClip>)
    at Ableton.handleUncompressedMessage (C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:285:41)
    at Ableton.handleIncoming (C:\snapshot\ableton-extensions\node_modules\ableton-js\index.js:264:22)
    at Socket.emit (node:events:517:28)
    at UDP.onMessage [as onmessage] (node:dgram:942:8)

Node.js v18.20.4
```

```
C:\snapshot\ableton-extensions\index.js:138
      return [Math.round(Math.max(...segmentSamples) * RESOLUTION / 2), Math.round(Math.min(...segmentSamples) * RESOLUTION / 2)];
                              ^

RangeError: Maximum call stack size exceeded
    at C:\snapshot\ableton-extensions\index.js:138:31
    at Array.map (<anonymous>)
    at renderWaveforms (C:\snapshot\ableton-extensions\index.js:121:48)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)

Node.js v18.20.4
```