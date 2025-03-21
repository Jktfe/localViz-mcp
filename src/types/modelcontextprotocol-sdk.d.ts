declare module '@modelcontextprotocol/sdk' {
  export class Server {
    constructor(options: any);
    tool(options: any): void;
    start(): Promise<void>;
    middleware(handler: (request: any, next: (request: any) => Promise<any>) => any): void;
  }

  export class StdioServerTransport {
    constructor();
  }
}
