type Batch<K, V> = {
  hasDispatched: boolean;
  keys: Array<K>;
  callbacks: Array<{
    resolve: (value: V) => void;
    reject: (error: Error) => void;
  }>;
};

type BatchLoadFn<K, V> = (keys: K[]) => Promise<Array<V | Error>>;

let resolvedPromise: Promise<any>; // 变量声明不赋值，是undefined。不写js，都快忘完了。。。

class DataLoader<K, V> {
  _batch: Batch<K, V> | null;
  _batchLoadFn: BatchLoadFn<K, V>;
  _batchScheduleFn: (fn: () => void) => void;

  constructor(batchLoadFn: BatchLoadFn<K, V>) {
    this._batch = null;
    this._batchLoadFn = batchLoadFn;
    this._batchScheduleFn = function (fn) {
      process.nextTick(fn);
      // if (!resolvedPromise) {
      //   resolvedPromise = Promise.resolve();
      // }
      // // 异步执行的，进入微任务队列，通过事件循环，来加入调用栈
      // resolvedPromise.then(() => {
      //   process.nextTick(fn);
      // });
      // process.nextTick(fn); // 同步执行的，直接进入调用栈
    };
  }

  load(key: K): Promise<V> {
    const batch = getCurrentBatch(this);
    batch.keys.push(key);
    const promise: Promise<V> = new Promise((resolve, reject) => {
      batch.callbacks.push({ resolve, reject });
    });
    return promise;
  }
}

function getCurrentBatch<K, V>(loader: DataLoader<K, V>): Batch<K, V> {
  const existingBatch = loader._batch;
  if (existingBatch !== null && !existingBatch.hasDispatched) {
    return existingBatch;
  }

  const newBatch = { hasDispatched: false, keys: [], callbacks: [] };
  loader._batch = newBatch;
  // 加入微任务队列
  loader._batchScheduleFn(() => {
    dispatchBatch(loader, newBatch);
  });
  return newBatch;
}

function dispatchBatch<K, V>(loader: DataLoader<K, V>, batch: Batch<K, V>) {
  batch.hasDispatched = true; // 标记为true后，再下一次调用getCurrentBatch时，会创建新的batch。相当于clearAll
  loader._batchLoadFn(batch.keys).then((values) => {
    for (let i = 0; i < batch.callbacks.length; i++) {
      const value = values[i];
      if (value instanceof Error) {
        batch.callbacks[i].reject(value);
      } else {
        batch.callbacks[i].resolve(value);
      }
    }
  });
}

export { DataLoader };
