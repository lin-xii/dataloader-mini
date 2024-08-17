const p = new Promise((resolve, reject) => {
  console.log("Promise is created");
  // resolve("resolved");
  return "111";
});

// p.then((r) => {
//   console.log(r);
// });

async function asyncFunction() {
  // const result = await p;
  const result = await p;
  console.log(result);
}
asyncFunction();

console.log("Promise is called");
