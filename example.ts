import { DataLoader } from "./src/index";
import { sleep, createMapping } from "./src/util";

const loader = new DataLoader(async (ids: number[]) => {
  console.log("new DataLoader", ids);
  const lists = await fetcher();
  const mapping = createMapping(lists);
  return ids.map((id) => mapping[id]);
});

async function fetcher() {
  // await sleep(3000);
  console.log("fetcher");
  const data = [
    { id: 1, name: "fetcher1" },
    { id: 2, name: "fetcher2" },
    { id: 3, name: "fetcher3" },
    { id: 4, name: "fetcher4" },
    { id: 5, name: "fetcher5" },
  ];
  return data;
}

loader.load(1).then((res) => {
  console.log("res", res);
});
loader.load(2);
loader.load(3);
loader.load(4);
