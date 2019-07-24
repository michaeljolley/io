import { ICandle } from "../models";
export declare class CandleDb {
    constructor();
    private connect;
    getCandles: () => Promise<ICandle[]>;
}
