import { EventEmitter } from 'events';

export abstract class IOTManager extends EventEmitter {
  public ip: string | null;
  public port: number | null;
  public deviceType: string;
  public isConnected: boolean;
  public state: Record<string, unknown>;
  protected socket: unknown | null;

  constructor(ip: string | null, port: number | null, deviceType = 'generic') {
    super();
    this.ip = ip;
    this.port = port;
    this.deviceType = deviceType;
    this.isConnected = false;
    this.state = {};
    this.socket = null;
  }

  abstract connect(): Promise<void>;

  abstract disconnect(): Promise<void>;

  abstract sendCommand(method: string, params?: Record<string, unknown>): Promise<void>;

  abstract getState(): Promise<Record<string, unknown> | null>;

  abstract executeCommand(method: string, params?: Record<string, unknown>, newState?: Record<string, unknown>): Promise<boolean>;

  abstract turnOn(): Promise<boolean>;

  abstract turnOff(): Promise<boolean>;

  abstract updateProperties(payload: Record<string, unknown>): Promise<boolean>;

  getDeviceInfo(): {
    ip: string | null;
    port: number | null;
    deviceType: string;
    isConnected: boolean;
    state: Record<string, unknown>;
  } {
    return {
      ip: this.ip,
      port: this.port,
      deviceType: this.deviceType,
      isConnected: this.isConnected,
      state: this.state
    };
  }

  validateConnection(): void {
    if (!this.isConnected) {
      throw new Error(`${this.deviceType} device at ${this.ip} is not connected`);
    }
  }

  updateState(newState: Record<string, unknown>): void {
    Object.assign(this.state, newState);
    this.emit('stateChange', this.state);
  }

  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.deviceType}:${this.ip}] [${level.toUpperCase()}] ${message}`);
  }
}