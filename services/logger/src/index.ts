import "module-alias/register";

import { Logger } from './logger';

const logger: Logger = new Logger();

logger.start();
