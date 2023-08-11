const sleep = async (delayMillis: number = 1000) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMillis);
  });

export default sleep;
