type BatchLoadFn<K, V> = (keys: K[]) => Promise<Array<V | Error>>;

type Options<K, V, C = K> = {
  batch?: boolean;
  maxBatchSize?: number;
  batchScheduleFn?: (callback: () => void) => void;
  cache?: boolean;
  cacheKeyFn?: (key: K) => C;
  cacheMap?: CacheMap<C, Promise<V>> | null;
  name?: string;
};

type CacheMap<K, V> = {
  get(key: K): V | void;
  set(key: K, value: V): any;
  delete(key: K): any;
  clear(): any;
};

type Batch<K, V> = {
  hasDispatched: boolean;
  keys: Array<K>;
  callbacks: Array<{
    resolve: (value: V) => void;
    reject: (error: Error) => void;
  }>;
  cacheHits?: Array<() => void>;
};

// Private: cached resolved Promise instance
let resolvedPromise;

class DataLoader<K, V, C = K> {
  _batchLoadFn: BatchLoadFn<K, V>;
  _batchScheduleFn: (fn: () => void) => void;
  _cacheKeyFn: (key: K) => C;
  _cacheMap: CacheMap<C, Promise<V>> | null;
  _batch: Batch<K, V> | null;

  constructor(batchLoadFn: BatchLoadFn<K, V>, options?: Options<K, V, C>) {
    this._batchLoadFn = batchLoadFn;
    this._batchScheduleFn = function (fn) {
      // 变量声明不赋值，是undefined。不写js，都快忘完了。。。
      // resolvedPromise == undefined;
      if (!resolvedPromise) {
        resolvedPromise = Promise.resolve();
      }
      // 异步执行的，进入微任务队列，通过事件循环，来加入调用栈
      resolvedPromise.then(() => {
        console.log(fn.toString());
        process.nextTick(fn);
      });
      // 同步执行的，直接进入调用栈
      // process.nextTick(fn);
    };
    this._cacheKeyFn = (key) => key as any;
    this._cacheMap = new Map();
    this._batch = null;
  }

  load(key: K): Promise<V> {
    if (key === null || key === undefined) {
      throw new Error("key is required");
    }

    const batch = getCurrentBatch(this);
    const cacheKey = this._cacheKeyFn(key);
    const cacheMap = this._cacheMap;

    if (cacheMap) {
      const cachedPromise = cacheMap.get(cacheKey);
      if (cachedPromise) {
        const cacheHits = batch.cacheHits || (batch.cacheHits = []);
        return new Promise((resolve) => {
          cacheHits.push(() => {
            resolve(cachedPromise);
          });
        });
      }
    }

    batch.keys.push(key);
    const promise: Promise<V> = new Promise((resolve, reject) => {
      batch.callbacks.push({ resolve, reject });
    });

    if (cacheMap) {
      cacheMap.set(cacheKey, promise);
    }

    return promise;
  }

  // remove the key from the cacheMap
  clear(key: K): this {
    if (this._cacheMap) {
      this._cacheMap.delete(this._cacheKeyFn(key));
    }
    return this;
  }
}

// Private: Either returns the current batch, or creates and schedules a
// dispatch of a new batch for the given loader.
function getCurrentBatch<K, V>(loader: DataLoader<K, V, any>): Batch<K, V> {
  // If there is an existing batch which has not yet dispatched and is within
  // the limit of the batch size, then return it.
  const existingBatch = loader._batch;
  if (existingBatch !== null && !existingBatch.hasDispatched) {
    return existingBatch;
  }

  const newBatch = { hasDispatched: false, keys: [], callbacks: [] };
  loader._batch = newBatch;

  // Then schedule a task to dispatch this batch of requests.
  loader._batchScheduleFn(() => {
    dispatchBatch(loader, newBatch);
  });

  return newBatch;
}

function dispatchBatch<K, V>(
  loader: DataLoader<K, V, any>,
  batch: Batch<K, V>
) {
  // Mark this batch as having been dispatched.
  batch.hasDispatched = true;

  // If there's nothing to load, resolve any cache hits and return early.
  if (batch.keys.length === 0) {
    resolveCacheHits(batch);
    return;
  }

  // Call the provided batchLoadFn for this loader with the batch's keys and
  // with the loader as the `this` context.
  let batchPromise;
  try {
    batchPromise = loader._batchLoadFn(batch.keys);
  } catch (e) {
    return failedDispatch(
      loader,
      batch,
      new TypeError(
        "DataLoader must be constructed with a function which accepts " +
          "Array<key> and returns Promise<Array<value>>, but the function " +
          `errored synchronously: ${String(e)}.`
      )
    );
  }

  // Assert the expected response from batchLoadFn
  if (!batchPromise || typeof batchPromise.then !== "function") {
    return failedDispatch(
      loader,
      batch,
      new TypeError(
        "DataLoader must be constructed with a function which accepts " +
          "Array<key> and returns Promise<Array<value>>, but the function did " +
          `not return a Promise: ${String(batchPromise)}.`
      )
    );
  }

  // Await the resolution of the call to batchLoadFn.
  batchPromise
    .then((values) => {
      // Assert the expected resolution from batchLoadFn.
      if (!isArrayLike(values)) {
        throw new TypeError(
          "DataLoader must be constructed with a function which accepts " +
            "Array<key> and returns Promise<Array<value>>, but the function did " +
            `not return a Promise of an Array: ${String(values)}.`
        );
      }
      if (values.length !== batch.keys.length) {
        throw new TypeError(
          "DataLoader must be constructed with a function which accepts " +
            "Array<key> and returns Promise<Array<value>>, but the function did " +
            "not return a Promise of an Array of the same length as the Array " +
            "of keys." +
            `\n\nKeys:\n${String(batch.keys)}` +
            `\n\nValues:\n${String(values)}`
        );
      }

      // Resolve all cache hits in the same micro-task as freshly loaded values.
      resolveCacheHits(batch);

      // Step through values, resolving or rejecting each Promise in the batch.
      for (let i = 0; i < batch.callbacks.length; i++) {
        const value = values[i];
        if (value instanceof Error) {
          batch.callbacks[i].reject(value);
        } else {
          batch.callbacks[i].resolve(value);
        }
      }
    })
    .catch((error) => {
      failedDispatch(loader, batch, error);
    });
}

function resolveCacheHits(batch: Batch<any, any>) {
  if (batch.cacheHits) {
    for (let i = 0; i < batch.cacheHits.length; i++) {
      batch.cacheHits[i]();
    }
  }
}

// Private: do not cache individual loads if the entire batch dispatch fails,
// but still reject each request so they do not hang.
function failedDispatch<K, V>(
  loader: DataLoader<K, V, any>,
  batch: Batch<K, V>,
  error: Error
) {
  // Cache hits are resolved, even though the batch failed.
  resolveCacheHits(batch);
  for (let i = 0; i < batch.keys.length; i++) {
    loader.clear(batch.keys[i]);
    batch.callbacks[i].reject(error);
  }
}

// 判断是否是类数组
function isArrayLike(x: any): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.length === "number" &&
    (x.length === 0 ||
      (x.length > 0 && Object.prototype.hasOwnProperty.call(x, x.length - 1)))
  );
}

export { DataLoader };
