export async function expectNoUnhandledRejection<T>(body: () => Promise<T>): Promise<T> {
  const rejections: unknown[] = [];
  const record = (reason: unknown) => rejections.push(reason);
  process.on('unhandledRejection', record);
  try {
    const result = await body();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(rejections).toEqual([]);
    return result;
  } finally {
    process.off('unhandledRejection', record);
  }
}
