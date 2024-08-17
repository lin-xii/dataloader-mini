function doA() {
  console.log("doA");
}

function doB() {
  console.log("doB");
}

function doC() {
  console.log("doC");
}

function doD() {
  console.log("doD");
}

console.log("start");

setTimeout(() => {
  doA();
  queueMicrotask(doD);
  doC();
}, 0);

setTimeout(() => {
  doB();
}, 0);

console.log("end");
