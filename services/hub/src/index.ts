import "module-alias/register";

import { IOHub } from './socket-io-hub';

const ioHub: IOHub = new IOHub();

ioHub.start();
