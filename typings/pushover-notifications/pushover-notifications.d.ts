// Type definitions for Pushover v0.2.2
// Project: https://github.com/qbit/node-pushover
// Definitions by: Pascal Vomhoff


declare module "pushover-notifications" {
    class PushoverNotifications {

        constructor(opts:Options);
        send(msg:Message, callback:Function):void;
        updateSounds():void;
        private errors(d:any);

    }

    interface Options {
        token:string;
        user:string;
        httpOptions?:any;
        debug?:boolean;
        onerror?:Function;
        update_sounds?:boolean
    }

    interface Message {
        message:string;
        title:string;
        device?:string;
        url?:string;
        url_title?:string;
        sound?:string;
        priority?:Number;
        timestamp?:Number;
    }

    export = PushoverNotifications;


}
