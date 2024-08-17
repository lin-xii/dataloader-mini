// 模拟sleep函数
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleep2(ms: number) {
  return new Promise((resolve) => {
    setTimeout((resolve) => {
      console.log("sleep2");
      resolve();
    }, ms);
  });
}

function createMapping(items: any[] = []): Record<number, string> {
  const mapping = items.reduce((target, item) => {
    target[item.id] = item.name;
    return target;
  }, {});
  return mapping;
}

export { sleep, createMapping, sleep2 };
