const getJest = () => {
  if (typeof jest === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return { fn: (...args: any[]) => '' as any };
  }

  return jest;
};

export default getJest();
