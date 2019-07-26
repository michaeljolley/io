import "module-alias/register";

import { WebHook } from './webhook';

const webhook: WebHook = new WebHook();
webhook.go();
