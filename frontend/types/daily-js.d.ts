declare module '@daily-co/daily-js' {
  export interface DailyCallObject {
    join(config: { url: string; token?: string; userName?: string }): Promise<void>;
    leave(): Promise<void>;
    destroy(): Promise<void>;
    setLocalAudio(enabled: boolean): Promise<void>;
    setLocalVideo(enabled: boolean): Promise<void>;
    localAudio(): Promise<boolean>;
    localVideo(): Promise<boolean>;
    participants(): { [key: string]: any; local?: any };
    on(event: string, handler: (event?: any) => void): DailyCallObject;
  }

  export interface DailyIframe {
    createCallObject(): DailyCallObject;
    createFrame(element?: HTMLElement | string, options?: any): any;
  }

  const DailyIframe: DailyIframe;
  export default DailyIframe;
  export { DailyIframe };
}

