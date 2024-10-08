// 模拟sleep函数
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMapping(items: any[] = []): Record<any, string> {
  const mapping = items.reduce((target, item) => {
    target[item.id] = item.name;
    return target;
  }, {});
  return mapping;
}

export { createMapping, sleep };
