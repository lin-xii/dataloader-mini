type Batch<K> = {
  keys: Array<K>;
  callbacks: Array<(v: any) => void>;
};
type DataLoadFn<K> = (keys: K[]) => Promise<any[]>;

export class DataLoader<K> {
  _batch: Batch<K> | null;
  _dataLoadFn: DataLoadFn<K>;

  constructor(resolverFn: DataLoadFn<K>) {
    this._batch = null;
    this._dataLoadFn = resolverFn;
  }

  load(key: K) {
    if (!this._batch || this._batch.keys.length === 0) {
      this._batch = { keys: [], callbacks: [] };
      process.nextTick(async () => {
        const res = await this._dataLoadFn(this._batch!.keys);
        this._batch!.callbacks.forEach((callback) => {
          callback(res.shift());
        });
        this._batch = null;
      });
    }
    return new Promise((resolve) => {
      this._batch!.keys.push(key);
      this._batch!.callbacks.push(resolve);
    });
  }
}
