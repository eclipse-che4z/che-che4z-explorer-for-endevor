export interface ILogger {
  trace: (msg: string) => void;
  info: (userMsg: string, logMsg?: string) => void;
  warn: (userMsg: string, logMsg?: string) => void;
  error: (userMsg: string, logMsg?: string) => void;
}
