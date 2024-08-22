import { DataLoader } from "./src/mini";
import { createMapping } from "./src/util";

const loader = new DataLoader(async (ids: number[]) => {
  console.log("batchFn", ids);
  const lists = await fetcher();
  const mapping = createMapping(lists);
  return ids.map((id) => mapping[id]);
});

async function fetcher() {
  // await sleep(3000);
  console.log("In fetcher");
  const data = [
    { id: 1, name: "fetcher1" },
    { id: 2, name: "fetcher2" },
    { id: 3, name: "fetcher3" },
    { id: 4, name: "fetcher4" },
    { id: 5, name: "fetcher5" },
  ];
  return data;
}

loader.load(1);
loader.load(2).then((res) => {
  console.log("load(2)", res);
});
loader.load(2).then((res) => {
  console.log("load(2)", res);
});
loader.load(3);
loader.load(4).then((res) => {
  console.log("load(4)", res);
});
loader.load(5);
loader.load(6).then((res) => {
  console.log("load(6)", res);
});
