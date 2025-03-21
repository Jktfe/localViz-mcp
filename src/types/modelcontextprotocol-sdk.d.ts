declare module '@modelcontextprotocol/sdk' {
  export class Server {
    constructor(options: any);
    tool(options: any): void;
    start(): Promise<void>;
  }

  export class StdioServerTransport {
    constructor();
  }
}
