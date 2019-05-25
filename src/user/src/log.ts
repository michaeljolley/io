
export const log = (level: string, message: string) => {
  const captains: any = console;
  captains[level](message);
};

export const dir = (message: string, obj: any) => {
  const captains: any = console;
  captains.dir(message, obj);
};
