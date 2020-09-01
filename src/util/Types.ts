import { Server } from '@hapi/hapi';

export type RouterFn = (route: Server) => void;
